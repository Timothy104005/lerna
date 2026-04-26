const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "dist", "site");
const outputAssetsDir = path.join(outputDir, "assets");

const rootFiles = [
  "Lerna.html",
  "lerna.webmanifest",
  "service-worker.js"
];

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
    `  window.__LERNA_SUPABASE_CONFIG = ${JSON.stringify({ url, anonKey })};`,
    "</script>"
  ].join("\n");
}

function cleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

cleanDir(outputDir);
fs.mkdirSync(outputAssetsDir, { recursive: true });

for (const file of rootFiles) {
  const outputFile = path.join(outputDir, file === "Lerna.html" ? "index.html" : file);
  if (file !== "Lerna.html") {
    copyFile(path.join(rootDir, file), outputFile);
    continue;
  }
  const configScript = supabaseConfigScript();
  let html = fs.readFileSync(path.join(rootDir, file), "utf8");
  if (configScript) {
    html = html.replace(
      '<script src="./assets/lerna-cloud-sync.js"></script>',
      `${configScript}\n    <script src="./assets/lerna-cloud-sync.js"></script>`
    );
  }
  fs.writeFileSync(outputFile, html, "utf8");
}

for (const file of assetFiles) {
  copyFile(path.join(rootDir, "assets", file), path.join(outputAssetsDir, file));
}
