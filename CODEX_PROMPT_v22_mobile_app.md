# Codex Prompt — YPT++ v22 → Mobile App (Capacitor + PWA, iOS + Android, 公開上架)

## 目標
把單檔 React bundle `YPT++ v22.html` 同時打包成：
1. **原生 iOS + Android app**（用 Capacitor，上架 App Store 與 Google Play Store）
2. **PWA**（加 manifest + service worker，使用者可以「加到主畫面」）

同一份 codebase、同一份 UI、同一份 localStorage 資料持久化。

## 已知事實（以 v22 為來源，請先確認不要假設）

### 檔案位置
- 原始 HTML：`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v22.html`
- 大小約 1.46 MB / 37,085 行
- 結構：
  - `<head>` 含內嵌 Tailwind CSS、早期 accent hydration script、`<style id="lerna-accent-overrides">`
  - `<script src="./assets/ypt-tools-graph-core-v18.js">` + `<script src="./assets/ypt-tools-react-v18.js">` ← **必須一起打包**
  - `<script type="module">` — 編譯 React bundle（~1.26 MB）
  - `<script id="lerna-ai-sidecar">` — Shadow-DOM AI 助手（~84 KB）
  - `<script id="lerna-accent-runtime">` — 主題色 runtime sync

### 需要的權限（從 bundle 行為確認）
| 功能 | 權限 | iOS Info.plist key | Android permission |
|---|---|---|---|
| Voice vocabulary（語音單字輸入） | 麥克風 | `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` | `RECORD_AUDIO`、`INTERNET` |
| OCR（拍照辨識題目） | 相機 + 相簿 | `NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`（若有從相簿選圖） | `CAMERA`、`READ_EXTERNAL_STORAGE`（API 32 以下）、`READ_MEDIA_IMAGES`（API 33+） |
| Gemini AI 呼叫 | 網路 | 預設允許 | `INTERNET`（預設允許，無需宣告權限但 AndroidManifest 仍需列） |
| localStorage 持久化 | 無 | 無 | 無 |

### 資料儲存
- 主要 key：`ypt_app_state_v6`（React 狀態機）
- AI key：`lerna_ai_v1`（Lerna 側邊欄）
- **重要**：必須保留 localStorage 行為 —— WebView 的 localStorage 不會被系統清掉，但 App 重新安裝會失去。之後可考慮改用 `@capacitor/preferences` 雙寫。**v1 先不換**。

### 網路
- Gemini API 在 runtime 由使用者輸入自己的 API key（存在 localStorage）。沒有硬碼。
- App 只發 HTTPS 請求到 Google 域名 + CDN（cdnjs）→ iOS ATS 預設允許。

## 目錄結構（要建立）

```
YPT++ Mobile/
├── package.json
├── capacitor.config.json
├── www/                          # ← Capacitor 會把這個複製到 iOS/Android bundle
│   ├── index.html               # 從 YPT++ v22.html 複製並改名
│   ├── assets/
│   │   ├── ypt-tools-graph-core-v18.js
│   │   ├── ypt-tools-react-v18.js
│   │   └── ypt-tools-v18.css   # 如果 HTML 有 <link> 到它
│   ├── manifest.webmanifest    # PWA manifest
│   ├── sw.js                   # PWA service worker
│   └── icons/                  # 所有尺寸的 icon
├── ios/                        # Capacitor 產生
├── android/                    # Capacitor 產生
├── resources/
│   ├── icon.png               # 1024x1024 source
│   └── splash.png             # 2732x2732 source
└── store-assets/
    ├── ios-screenshots/
    ├── android-screenshots/
    ├── privacy-policy.md
    └── store-listing.md
```

---

## 步驟 1 — 建立專案骨架（在新資料夾）

```bash
cd "C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning"
mkdir "YPT++ Mobile"
cd "YPT++ Mobile"
npm init -y
npm install --save @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install --save @capacitor/splash-screen @capacitor/status-bar @capacitor/app @capacitor/preferences @capacitor/haptics
npm install --save-dev @capacitor/assets
```

### `package.json` 要加的 scripts
```json
{
  "scripts": {
    "sync": "npx cap sync",
    "ios": "npx cap open ios",
    "android": "npx cap open android",
    "assets": "npx capacitor-assets generate",
    "build:ios": "npx cap sync ios",
    "build:android": "npx cap sync android"
  }
}
```

---

## 步驟 2 — `capacitor.config.json`

```json
{
  "appId": "com.timothychen.yptplus",
  "appName": "YPT++",
  "webDir": "www",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "ios": {
    "contentInset": "always",
    "backgroundColor": "#faf9f6",
    "limitsNavigationsToAppBoundDomains": false
  },
  "android": {
    "backgroundColor": "#faf9f6"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1500,
      "backgroundColor": "#faf9f6",
      "showSpinner": false,
      "androidSpinnerStyle": "small",
      "iosSpinnerStyle": "small"
    }
  }
}
```

**⚠️ appId 是 bundle identifier**，一旦上架不能改，請確認 `com.timothychen.yptplus` 可接受。若不行，改成使用者自己的反向 domain。

---

## 步驟 3 — 把 v22.html 搬進 `www/index.html`

1. 複製 `YPT++ v22.html` → `www/index.html`
2. 複製 `assets/ypt-tools-graph-core-v18.js`、`assets/ypt-tools-react-v18.js`（這兩個檔應該在原 Learning 資料夾）→ `www/assets/`
3. 檢查 `www/index.html` 裡的 `<script src="./assets/...">` 路徑可達

### 需要對 index.html 做的最小修改

#### 3a. 在 `<head>` 最後加 PWA meta + manifest link
```html
<link rel="manifest" href="./manifest.webmanifest" />
<meta name="theme-color" content="#4a7c74" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="YPT++" />
<link rel="apple-touch-icon" href="./icons/apple-touch-icon-180.png" />
```

#### 3b. 在 `<body>` 結束前加 service worker 註冊
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function(err){
        console.warn('SW registration failed:', err);
      });
    });
  }
</script>
```

#### 3c.（可選）加一段 iOS safe-area CSS
```html
<style>
  /* iOS safe area — 主容器加 padding 避開瀏海 / Home indicator */
  @supports (padding-top: env(safe-area-inset-top)) {
    body {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
  }
</style>
```

---

## 步驟 4 — PWA manifest + service worker

### `www/manifest.webmanifest`
```json
{
  "name": "YPT++",
  "short_name": "YPT++",
  "description": "Minimalist study app with Lerna AI tutor",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#faf9f6",
  "theme_color": "#4a7c74",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "lang": "zh-Hant",
  "categories": ["education", "productivity"]
}
```

### `www/sw.js`（minimal offline-first）
```js
const CACHE = 'yptplus-v22-1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/ypt-tools-graph-core-v18.js',
  './assets/ypt-tools-react-v18.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 不快取 Gemini API 或其他外部 API
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      // 只快取同源
      if (url.origin === location.origin && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
```

**注意**：測試完確認能離線開啟，再上架。

---

## 步驟 5 — 初始化 Capacitor

```bash
npx cap init "YPT++" "com.timothychen.yptplus" --web-dir="www"
npx cap add ios
npx cap add android
npx cap sync
```

---

## 步驟 6 — 產生 icon + splash

1. 準備兩張 source 圖：
   - `resources/icon.png` — **1024×1024**，PNG，不要透明，內容是 v22 那個「棕色鉛筆 + 橫桿 L」logo，留 ~10% 邊界 safe area
   - `resources/splash.png` — **2732×2732**，中間置中 logo，底色 `#faf9f6`

2. 執行：
```bash
npx capacitor-assets generate --iconBackgroundColor "#faf9f6" --splashBackgroundColor "#faf9f6"
```

這會自動產生 iOS/Android 所有尺寸 + PWA 用的 192/512/180 icon。

3. 把產生的 PWA icon 複製到 `www/icons/` 資料夾（如果 tool 沒自動放）。

---

## 步驟 7 — iOS 權限與設定

### `ios/App/App/Info.plist`（Xcode 打開後在 Signing & Capabilities 旁邊編）
加入以下 key（string value 用中文 + 英文描述更清楚）：

```xml
<key>NSMicrophoneUsageDescription</key>
<string>YPT++ uses the microphone so you can dictate vocabulary in the Voice tab. 允許麥克風以使用「語音單字」功能。</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>YPT++ uses speech recognition to turn your voice into text for vocabulary practice. 允許語音辨識以便把你念的單字轉為文字。</string>

<key>NSCameraUsageDescription</key>
<string>YPT++ uses the camera so you can snap a question for OCR. 允許相機以拍攝題目做 OCR 辨識。</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>YPT++ reads photos from your library when you pick an existing image for OCR. 允許存取相簿以選擇既有圖片做 OCR。</string>
```

### Xcode 專案設定
- **Bundle Identifier**：`com.timothychen.yptplus`
- **Display Name**：`YPT++`
- **Deployment Target**：iOS 15.0（Capacitor 6.x 要求）
- **Signing**：Automatic，Team 選你的 Apple Developer 帳號
- **Device Orientation**：只勾 Portrait + Portrait Upside Down（若 v22 沒做 landscape UI）
- **Status Bar Style**：Default

### iOS 14+ 需要
- 移除 `UISceneDelegate` 如果有衝突（Capacitor template 已處理）
- `limitsNavigationsToAppBoundDomains` 已在 capacitor.config.json 設 false（否則 Gemini API 會被擋）

---

## 步驟 8 — Android 權限與設定

### `android/app/src/main/AndroidManifest.xml`
在 `<manifest>` 標籤下、`<application>` 前加：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />

<!-- Android 13+ 分離權限 -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- Android 12 及以下向下相容 -->
<uses-permission
  android:name="android.permission.READ_EXTERNAL_STORAGE"
  android:maxSdkVersion="32" />

<uses-feature android:name="android.hardware.microphone" android:required="false" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### `android/app/build.gradle`
確認：
- `applicationId "com.timothychen.yptplus"`
- `minSdkVersion 23`（Capacitor 6 最低）
- `targetSdkVersion 34`（Play 規定 2024+）
- `versionCode 1`、`versionName "1.0.0"`

### 簽章
```bash
keytool -genkey -v -keystore yptplus-release.jks -alias yptplus -keyalg RSA -keysize 2048 -validity 10000
```
然後在 `android/app/build.gradle` 加 `signingConfigs`（Codex 請寫完整 block）。
**keystore 絕對不能進 git**（加 `.gitignore`）。密碼另存。

---

## 步驟 9 — 店面素材 + 隱私權政策

### 截圖（store-assets/）
每個平台至少 3 張必要截圖：
- **iOS**：
  - 6.7" iPhone（1290×2796，iPhone 15 Pro Max）
  - 5.5" iPhone（1242×2208）
  - 13" iPad Pro（2048×2732）— 若要支援 iPad
- **Android**：
  - 手機：1080×1920 或 1080×2400（至少 2 張）
  - 7" 平板 + 10" 平板（若支援）

建議畫面：(1) Focus 計時 (2) Plan 月檢視 (3) AI 助手面板 (4) Settings accent 色選擇器

### 隱私權政策（必填）
Apple + Google 都要求 app 提供公開 URL 的隱私權政策。**重點要涵蓋**：
- Gemini API key 由使用者輸入，**儲存在本機 localStorage**（不上傳我方伺服器）
- 所有 flashcard / note / session data **只存本機**
- 麥克風資料**不錄音儲存**，只即時轉文字經由 Web Speech API
- OCR 拍攝的圖片**上傳至 Google Gemini API**（使用者自己的 key），由 Google 處理
- 不收集任何分析 / 廣告 / crash data（如果確實沒接）

請 Codex 產生 `store-assets/privacy-policy.md`，內容雙語（中英）。託管方式：GitHub Pages / 個人網站 / Notion public page 都可以。

### Store Listing（store-assets/store-listing.md）
- **App 名稱**：YPT++（30 字元以內）
- **副標題** (iOS only，30 字元)：Minimalist study app
- **簡短描述** (Play, 80 字元以內)
- **完整描述** (4000 字元以內，雙語建議分開列)
- **關鍵字** (iOS, 100 字元)：study, pomodoro, flashcard, learn, AI tutor
- **Category**：Education（主）、Productivity（次）
- **年齡分級**：4+（iOS）/ Everyone（Android）— 如果 AI 會產生文字，可能要 12+，請 Codex 判斷
- **Support URL**、**Marketing URL**（個人網站或 GitHub 都行）

### App Store / Play 特殊宣告
**iOS App Review**：
- App Privacy 表要填「Audio Data」「User Content」「Diagnostics」— 選「Not Collected」除非 YOU 收
- 若 AI 相關被質疑，要準備文字說明「使用者需自備 API key，本 app 不代理任何內容」

**Google Play Data Safety**：
- 同樣宣告「No data collected」
- 敏感權限（麥克風、相機）要在 Play Console 填理由

---

## 步驟 10 — 測試流程

### PWA（先測試最簡單）
```bash
cd www
npx serve  # 或 python -m http.server
# 手機瀏覽器開 http://<電腦 IP>:5000/index.html
# 按「加到主畫面」→ 確認 icon 正確、啟動無瀏覽器 UI、離線能用
```

### iOS
```bash
npx cap sync ios
npx cap open ios
# Xcode 選實機 → Run
# 第一次連接要信任 profile（iPhone Settings → General → VPN & Device Management）
# 測麥克風 / 相機權限對話框
# TestFlight 上傳：Xcode → Product → Archive → Distribute → App Store Connect
```

### Android
```bash
npx cap sync android
npx cap open android
# Android Studio 選實機 / emulator → Run
# release 版簽章 + AAB：./gradlew bundleRelease → android/app/build/outputs/bundle/release/
# 上傳到 Play Console → Internal testing track 先測
```

---

## 步驟 11 — 常見陷阱

1. **Web Speech API 在 iOS WebView 不支援**。iOS 的 `SpeechRecognition` 只在 Safari 可用，WKWebView（Capacitor 用的）沒有。
   - **處理方式**：寫 wrapper，偵測 `window.webkit?.messageHandlers?.speechBridge` 存在就透過 native plugin（要自己寫 Capacitor plugin 用 `SFSpeechRecognizer`），否則 fallback 到 Web Speech API。
   - **v1 解法**：第一版先 detect `navigator.userAgent` 含 `WebKit` 且非 Safari 時，在 Voice tab 顯示「此功能需要 Safari 瀏覽器，Capacitor wrapper v1 不支援」提示。之後再補 native bridge。

2. **Gemini API 在 WebView 的 CORS**：Capacitor WebView 預設以 `capacitor://` 或 `ionic://` scheme 載入，Google API 會回 CORS 拒絕。解法：
   - `capacitor.config.json` 的 `server.hostname` 設成 `localhost`（Capacitor 6 預設已是）
   - 若還有問題，改用 `@capacitor/http` plugin 做原生 HTTP 請求，繞開 WebView CORS

3. **localStorage 被系統清**：iOS 有 7 天沒用會清 WebView 快取。**v2 要做**：用 `@capacitor/preferences` 雙寫（存 + 讀同步）。v1 可以先不做，但要在 README 標註。

4. **Splash screen 卡住**：Capacitor 預設 splash 要 app 呼叫 `SplashScreen.hide()` 才會消失。在 index.html 的 bundle 最前面加：
```js
import { SplashScreen } from '@capacitor/splash-screen';
SplashScreen.hide().catch(() => {});
```
但因為 v22 是 compiled bundle 不是 import 化，改用 script tag + polling：
```js
setTimeout(() => { window.Capacitor?.Plugins?.SplashScreen?.hide(); }, 1200);
```

5. **Android back button**：Capacitor 預設會在 root 頁按返回直接退出。若要攔截，用 `@capacitor/app` 的 `addListener('backButton')`。v1 可不動。

6. **iOS 14 下拉 pull-to-refresh**：WKWebView 預設會 bounce。在 index.html 的 CSS 加：
```css
html, body { overscroll-behavior: contain; }
```

---

## 驗收清單

- [ ] `npm install` 成功，`node_modules/@capacitor/*` 存在
- [ ] `www/index.html` 用瀏覽器開可正常運作（= PWA 部分 OK）
- [ ] iOS: `npx cap open ios` 開得了 Xcode，按 Run 裝機後能看到首頁
- [ ] Android: `npx cap open android` 開得了 Android Studio，能安裝到實機
- [ ] 麥克風對話框會跳（有權限 plist）
- [ ] 相機對話框會跳
- [ ] 計時器可運作、localStorage 能存
- [ ] AI 面板能打開（Lerna AI icon 點得到）
- [ ] Settings accent 色改了畫面有反應（假設 CODEX_PROMPT_v22_accent_live_update.md 那邊也做了）
- [ ] 所有 icon + splash 產生了（iOS 20+ 尺寸，Android adaptive + legacy）
- [ ] App Store Connect + Play Console 兩個 app record 建立好
- [ ] 隱私權政策 URL 可 access
- [ ] 準備 3+ 張截圖 per platform

---

## 回報給使用者的清單
完成後請回報：
1. `YPT++ Mobile/` 實際建立位置
2. `capacitor.config.json` 的最終 `appId`
3. iOS signing team ID（若已設定）
4. Android keystore 位置 + 是否已 backup（強烈建議**離線**備份，遺失 = 無法再更新 Play 上的 app）
5. PWA 自測結果（能否安裝、能否離線）
6. 已知無法在 iOS WebView 運作的功能清單（至少 Voice 那塊）
7. 尚未處理的 TODO（建議至少：native speech bridge、`@capacitor/preferences` 資料雙寫、crash 收集）

---

## 不要做的事

- **不要**修改 `YPT++ v22.html` 本身 — 只複製到 `www/index.html` 做最小修改
- **不要**用 Expo / React Native 重寫 — 那是另一條路線
- **不要**用 Ionic 框架包裝（雖然常跟 Capacitor 一起出現，但我們只要 Capacitor runtime，不要 Ionic UI）
- **不要**在 v1 就做 push notification / in-app purchase / crash analytics — scope 太大
- **不要**修改 Gemini API 呼叫邏輯 — 保留使用者自備 key 的模式

---

## 本檔案路徑
`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\CODEX_PROMPT_v22_mobile_app.md`

執行完後請更新此檔最後一段「已完成 / 待辦」清單。

---

## 已完成 / 待辦（2026-04-20）

### 已完成

- 已在 `C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ Mobile` 建立獨立的 Capacitor + PWA 專案。
- 已建立 `scripts/prepare-web.js`，會從 `..\YPT++ v22.html` 重新產生 `www/index.html`，並同步 `ypt-tools-graph-core-v18.js`、`ypt-tools-react-v18.js`、`ypt-tools-v18.css`。
- 已建立 `www/manifest.webmanifest`、`www/sw.js`、`www/icons/*`、`resources/icon.png`、`resources/splash.png`。
- 已建立 `store-assets/privacy-policy.md` 與 `store-assets/store-listing.md` 雙語草稿，以及 iOS / Android 截圖清單資料夾。
- 已成功執行 `npm install`、`npx cap add ios`、`npx cap add android`、`npm run assets`、`npm run sync`。
- 已補上 iOS `Info.plist` 權限說明（麥克風、語音辨識、相機、相簿）與 portrait-only 方向設定。
- 已補上 Android `AndroidManifest.xml` 權限 / feature 宣告，並在 `android/app/build.gradle` 加入 release signing placeholder block。
- 已用本機 HTTP server + Playwright 驗證 `www/index.html` 可正常載入，service worker 註冊為 `sw.js`，離線 reload 首頁 shell 可正常開啟。

### 待辦

- iOS Signing / Team ID 尚未設定；目前環境沒有 Xcode，無法完成 `Run`、`Archive`、`TestFlight` 驗證。
- Android release keystore 尚未建立與離線備份；仍需建立 `keystore.properties` 與 `.jks`。
- App Store Connect / Google Play Console 的 app record 尚未建立。
- 實機上的麥克風 / 相機權限對話框尚未驗證。
- 手機與平板截圖尚未產出；`store-assets/ios-screenshots/`、`store-assets/android-screenshots/` 目前只有 checklist。
- `privacy-policy.md` 尚未託管成公開 URL；`store-listing.md` 內的 Support URL / Marketing URL 仍為 TODO。
- iOS `WKWebView` 仍不支援目前 Voice tab 使用的 Web Speech API；v1 仍需要 Safari 提示或後續 native speech bridge。
- 本版仍使用 `localStorage`；`@capacitor/preferences` 雙寫與 crash collection 仍屬後續 TODO。
- 實際 scaffold 使用的是目前解析到的 Capacitor 8.3.1 模板；若必須嚴格鎖定 Capacitor 6.x，仍需額外降版與重建原生專案。
