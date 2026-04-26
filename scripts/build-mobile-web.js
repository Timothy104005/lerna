const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const rootDir = process.cwd();
const sourceHtmlPath = path.join(rootDir, "Lerna.html");
const outputDir = path.join(rootDir, "dist", "mobile-web");
const outputAssetsDir = path.join(outputDir, "assets");

const rootFiles = ["lerna.webmanifest"];

const assetFiles = [
  "ypt-tools-v18.css",
  "ypt-tools-react-v18.js",
  "ypt-tools-graph-core-v18.js",
  "lerna-cloud-sync.js",
  "lerna-mark.svg",
  "lerna-icon-192.png",
  "lerna-icon-512.png",
  "lerna-icon-32.png",
  "apple-touch-icon.png",
  "favicon.ico"
];

function supabaseConfigScript() {
  const url = String(process.env.LERNA_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.LERNA_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) return "";
  return [
    "<script>",
    `      window.__LERNA_SUPABASE_CONFIG = ${JSON.stringify({ url, anonKey })};`,
    "    </script>"
  ].join("\n");
}

function cleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileRelative(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function buildMobileHtml() {
  const sourceHtml = fs.readFileSync(sourceHtmlPath, "utf8");
  const configScript = supabaseConfigScript();
  const bridgeInjection = [
    "<script>",
    "      window.__YPT_PLATFORM__ = `android_app`;",
    "      window.__LERNA_TARGET__ = `android_app`;",
    "    </script>",
    '    <script type="module" src="./capacitor-bridge.js"></script>'
  ].join("\n");

  let html = sourceHtml;
  if (configScript) {
    html = html.replace(
      '<script src="./assets/lerna-cloud-sync.js"></script>',
      `${configScript}\n    <script src="./assets/lerna-cloud-sync.js"></script>`
    );
  }

  html = html.replace(
    '<script src="./assets/ypt-tools-react-v18.js"></script>',
    `<script src="./assets/ypt-tools-react-v18.js"></script>\n${bridgeInjection}`
  );

  fs.writeFileSync(path.join(outputDir, "index.html"), html, "utf8");
}

async function buildBridgeBundle() {
  await esbuild.build({
    entryPoints: [path.join(rootDir, "mobile", "capacitor-bridge.js")],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome114"],
    outfile: path.join(outputDir, "capacitor-bridge.js"),
    sourcemap: false,
    minify: false
  });
}

async function main() {
  cleanDir(outputDir);
  fs.mkdirSync(outputAssetsDir, { recursive: true });

  for (const rootFile of rootFiles) {
    copyFileRelative(
      path.join(rootDir, rootFile),
      path.join(outputDir, rootFile)
    );
  }

  for (const assetFile of assetFiles) {
    copyFileRelative(
      path.join(rootDir, "assets", assetFile),
      path.join(outputAssetsDir, assetFile)
    );
  }

  buildMobileHtml();
  await buildBridgeBundle();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
