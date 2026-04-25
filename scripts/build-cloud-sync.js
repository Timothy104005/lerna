const path = require("path");
const esbuild = require("esbuild");

const rootDir = process.cwd();

esbuild
  .build({
    entryPoints: [path.join(rootDir, "cloud", "lerna-cloud-sync.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome114", "safari15"],
    outfile: path.join(rootDir, "assets", "lerna-cloud-sync.js"),
    sourcemap: false,
    minify: false
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
