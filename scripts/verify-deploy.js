#!/usr/bin/env node
/**
 * verify-deploy.js — Smoke-test a deployed Lerna site.
 *
 * Usage:
 *   node scripts/verify-deploy.js https://example.netlify.app
 *   npm run verify:deploy -- https://example.netlify.app
 *
 * Checks:
 *   1. GET /                            HTTP 200, HTML, contains <title>Lerna</title>
 *   2. GET /                            body references ./assets/lerna-cloud-sync.js
 *   3. GET /assets/lerna-cloud-sync.js  HTTP 200, js MIME
 *   4. GET /assets/ypt-tools-react-v18.js  HTTP 200, js MIME
 *   5. GET /assets/ypt-tools-graph-core-v18.js  HTTP 200, js MIME
 *   6. GET /assets/ypt-tools-v18.css    HTTP 200, css MIME
 *   7. GET /lerna.webmanifest           HTTP 200
 *   8. GET /service-worker.js           HTTP 200, js MIME
 *
 * Exits 0 if all pass, 1 otherwise.
 *
 * Requires Node 18+ (uses global fetch).
 */

const target = process.argv[2];

if (!target) {
  console.error("Usage: node scripts/verify-deploy.js <url>");
  console.error("  e.g. node scripts/verify-deploy.js https://example.netlify.app");
  process.exit(2);
}

let baseUrl;
try {
  baseUrl = new URL(target);
  if (!/^https?:$/.test(baseUrl.protocol)) {
    throw new Error("protocol must be http or https");
  }
} catch (error) {
  console.error(`Invalid URL: ${target}`);
  console.error(`  ${error.message}`);
  process.exit(2);
}

function join(path) {
  const base = baseUrl.href.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

const checks = [
  {
    name: "index.html",
    path: "/",
    mime: /text\/html/i,
    bodyMatches: [
      { pattern: /<title>\s*Lerna\s*<\/title>/i, label: "<title>Lerna</title>" },
      { pattern: /assets\/lerna-cloud-sync\.js/, label: "cloud-sync script tag" },
      { pattern: /assets\/ypt-tools-react-v18\.js/, label: "react bundle script tag" },
      { pattern: /lerna\.webmanifest/, label: "web manifest link" }
    ]
  },
  {
    name: "cloud-sync bundle",
    path: "/assets/lerna-cloud-sync.js",
    mime: /(application|text)\/(javascript|x-javascript|ecmascript)/i
  },
  {
    name: "react bundle",
    path: "/assets/ypt-tools-react-v18.js",
    mime: /(application|text)\/(javascript|x-javascript|ecmascript)/i
  },
  {
    name: "graph-core bundle",
    path: "/assets/ypt-tools-graph-core-v18.js",
    mime: /(application|text)\/(javascript|x-javascript|ecmascript)/i
  },
  {
    name: "main stylesheet",
    path: "/assets/ypt-tools-v18.css",
    mime: /text\/css/i
  },
  {
    name: "web manifest",
    path: "/lerna.webmanifest",
    mime: /(application\/manifest\+json|application\/json|text\/)/i
  },
  {
    name: "service worker",
    path: "/service-worker.js",
    mime: /(application|text)\/(javascript|x-javascript|ecmascript)/i
  }
];

async function run() {
  console.log(`Verifying: ${baseUrl.href}`);
  console.log("");

  let failures = 0;

  for (const check of checks) {
    const url = join(check.path);
    const prefix = `  ${check.name.padEnd(22, " ")}`;
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "lerna-verify-deploy/1.0" }
      });
      const status = response.status;
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();

      if (status !== 200) {
        console.log(`${prefix} FAIL  HTTP ${status}  ${check.path}`);
        failures += 1;
        continue;
      }
      if (check.mime && !check.mime.test(contentType)) {
        console.log(
          `${prefix} FAIL  MIME "${contentType || "(empty)"}" doesn't match ${check.mime}  ${check.path}`
        );
        failures += 1;
        continue;
      }
      if (check.bodyMatches) {
        const missing = check.bodyMatches.filter((match) => !match.pattern.test(body));
        if (missing.length > 0) {
          console.log(`${prefix} FAIL  body missing: ${missing.map((m) => m.label).join(", ")}`);
          failures += 1;
          continue;
        }
      }
      const kb = Math.round(body.length / 102.4) / 10;
      console.log(`${prefix} OK    HTTP 200  ${kb.toFixed(1)} KB  ${contentType.split(";")[0] || "?"}`);
    } catch (error) {
      console.log(`${prefix} FAIL  fetch error: ${error.message || error}`);
      failures += 1;
    }
  }

  console.log("");
  if (failures === 0) {
    console.log(`PASS  all ${checks.length} checks green for ${baseUrl.host}`);
    process.exit(0);
  } else {
    console.log(`FAIL  ${failures} of ${checks.length} checks failed`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(`unexpected error: ${error?.stack || error}`);
  process.exit(1);
});
