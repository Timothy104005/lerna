const fs = require("fs");
const path = require("path");

const projectDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(projectDir, "..");
const sourceHtmlPath = path.join(repoDir, "YPT++ v22.html");
const sourceAssetsDir = path.join(repoDir, "assets");
const outputDir = path.join(projectDir, "www");
const outputAssetsDir = path.join(outputDir, "assets");

const assetFiles = [
  "ypt-tools-graph-core-v18.js",
  "ypt-tools-react-v18.js",
  "ypt-tools-v18.css"
];

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(fromPath, toPath) {
  ensureFile(fromPath);
  ensureDir(path.dirname(toPath));
  fs.copyFileSync(fromPath, toPath);
}

function replaceOnce(source, searchValue, replaceValue) {
  if (!source.includes(searchValue)) {
    throw new Error(`Expected snippet not found: ${searchValue}`);
  }
  return source.replace(searchValue, replaceValue);
}

function buildIndexHtml() {
  ensureFile(sourceHtmlPath);
  let html = fs.readFileSync(sourceHtmlPath, "utf8");

  html = replaceOnce(html, "<title>Lerna</title>", "<title>YPT++</title>");
  html = replaceOnce(
    html,
    '<meta name="theme-color" content="#6f9f92" />',
    '<meta name="theme-color" content="#4a7c74" />'
  );
  html = replaceOnce(
    html,
    '<meta name="apple-mobile-web-app-title" content="Lerna" />',
    [
      '<meta name="apple-mobile-web-app-title" content="YPT++" />',
      '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />'
    ].join("\n")
  );
  html = replaceOnce(
    html,
    '<link rel="manifest" href="./lerna.webmanifest" />',
    '<link rel="manifest" href="./manifest.webmanifest" />'
  );
  html = replaceOnce(
    html,
    '<link rel="icon" href="./assets/favicon.ico" sizes="any" />',
    '<link rel="icon" href="./icons/favicon.ico" sizes="any" />'
  );
  html = replaceOnce(
    html,
    'href="./assets/lerna-icon-192.png"',
    'href="./icons/icon-192.png"'
  );
  html = replaceOnce(
    html,
    '<link rel="apple-touch-icon" href="./assets/apple-touch-icon.png" />',
    '<link rel="apple-touch-icon" href="./icons/apple-touch-icon-180.png" />'
  );
  html = replaceOnce(
    html,
    "navigator.serviceWorker.register(`./service-worker.js`).catch(() => {});",
    "navigator.serviceWorker.register('./sw.js').catch(() => {});"
  );

  const safeAreaStyle = [
    '    <style id="ypt-mobile-shell-style">',
    "      html, body {",
    "        overscroll-behavior: contain;",
    "      }",
    "      @supports (padding-top: env(safe-area-inset-top)) {",
    "        body {",
    "          padding-top: env(safe-area-inset-top);",
    "          padding-bottom: env(safe-area-inset-bottom);",
    "        }",
    "      }",
    "    </style>"
  ].join("\n");

  if (!html.includes('id="ypt-mobile-shell-style"')) {
    html = replaceOnce(html, "  </head>", `${safeAreaStyle}\n  </head>`);
  }

  const runtimeScript = [
    '    <script id="ypt-mobile-shell-runtime">',
    "      window.addEventListener('load', function () {",
    "        setTimeout(function () {",
    "          try {",
    "            var plugins = window.Capacitor && window.Capacitor.Plugins;",
    "            var splash = plugins && plugins.SplashScreen;",
    "            if (splash && typeof splash.hide === 'function') {",
    "              splash.hide();",
    "            }",
    "          } catch (err) {",
    "            console.warn('Splash hide failed:', err);",
    "          }",
    "        }, 1200);",
    "      });",
    "    </script>"
  ].join("\n");

  if (!html.includes('id="ypt-mobile-shell-runtime"')) {
    html = replaceOnce(html, "  </body>", `${runtimeScript}\n  </body>`);
  }

  fs.writeFileSync(path.join(outputDir, "index.html"), html, "utf8");
}

function copyAssets() {
  ensureDir(outputAssetsDir);
  for (const assetFile of assetFiles) {
    copyFile(
      path.join(sourceAssetsDir, assetFile),
      path.join(outputAssetsDir, assetFile)
    );
  }
}

function main() {
  ensureDir(outputDir);
  copyAssets();
  buildIndexHtml();
  console.log("Prepared YPT++ v22 mobile web shell.");
}

main();
