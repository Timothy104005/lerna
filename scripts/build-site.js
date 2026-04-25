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
  copyFile(path.join(rootDir, file), path.join(outputDir, file === "Lerna.html" ? "index.html" : file));
}

for (const file of assetFiles) {
  copyFile(path.join(rootDir, "assets", file), path.join(outputAssetsDir, file));
}
