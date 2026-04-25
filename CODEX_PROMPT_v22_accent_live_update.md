# Codex Prompt — YPT++ v22 accent color 無法即時更新 UI

## 使用者回報
在 Settings → 「主題副色調 (Accent)」把顏色改掉以後，UI 顏色沒有跟著變。必須要重新整理頁面（或完全不會變）。

## 檔案
- `C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v22.html`
- 大小約 1.46MB，單檔 React 編譯 bundle（非原始碼）
- 有 3 個 inline script：
  1. `<script>` — early hydration（React 掛載前從 localStorage 讀 accent 套到 `:root`）
  2. `<script type="module">` — 編譯後的 React bundle（~1.26MB，變數命名已混淆：`e`, `t`, `n`, `ie` 等）
  3. `<script id="lerna-ai-sidecar">` — AI 側邊欄獨立 Shadow-DOM 模組
  4. `<script id="lerna-accent-runtime">` — 每 500 ms 輪詢 localStorage，把 accent 套到 `:root` CSS 變數

## 已經做對的部份（不要改壞）
1. `state.settings.accent` 預設值 `#4a7c74`，型別是 hex string
2. Settings page 有一個 color picker + 文字輸入 + Reset 按鈕，呼叫 `n({ accent: value })` 更新 state
3. `<style id="lerna-accent-overrides">` 覆寫了 Tailwind arbitrary classes `[#4a7c74]`, `[#3d6960]`, `[#3d6b63]`, `[#f0f7f5]`, `[#d4e7e4]`, `[#c8e0db]` → `var(--accent)` 等
4. `<script id="lerna-accent-runtime">` 每 500 ms 檢查 `localStorage['ypt_app_state_v6'].state.settings.accent` 是否變動，變動時呼叫 `apply(hex)` 把 `--accent` / `--accent-dark` / `--accent-soft` / `--accent-border` 寫到 `document.documentElement.style`

## 仍然會導致顯示不變的殘餘問題

### A. 編譯 bundle 內硬碼的 hex 沒被 CSS override 蓋掉

ripgrep 確認以下數量（不會被 `.bg-[#4a7c74]` 這種 class-level override 影響）：

| 類型 | 數量 | 例子 |
|---|---|---|
| JSX `style={{ ... '#4a7c74' }}` | 7 | `style: { color: '#4a7c74' }` |
| inline `color: '#4a7c74'` | 3 | 編譯後的 ReactElement style prop |
| CSS 文字 `color: #4a7c74` | 4 | 在 template-literal CSS 裡 |
| JS template literal `` `#4a7c74` `` | 20 | e.g. 預設 state 初始化、fallback 值 |
| JS 字串 `'#4a7c74'` | 1 | |

這些必須把 literal `'#4a7c74'` 換成 `var(--accent)` 或動態讀 `state.settings.accent` 傳進去。

### B. React state 寫回 localStorage 可能有 debounce/throttle

bundle 用類 zustand `persist` middleware。若 persist 不是同步寫 localStorage，輪詢腳本會有 500ms+ 的延遲（但使用者不應感覺到）。

若要 100% 即時，最好在 state setter `ie`（混淆後的設定 setter）更新 `settings.accent` 之後，**立即**同步套 CSS 變數。可以用 React 的 `useEffect` 監聽 `settings.accent`。

## 要做的事情（排序）

### 步驟 1 — 找出 state setter 並加 useEffect 同步 CSS 變數
在 React bundle 裡搜 `ie = (e)` 或 `settings: {...e}` 找到 settings setter。找到 App 根元件（應該是 main render root 附近），加上：

```js
(0, t.useEffect)(function () {
  var hex = state?.settings?.accent || '#4a7c74';
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  var root = document.documentElement;
  root.style.setProperty('--accent', hex);
  // 重新算 dark / soft / border
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  var pad = function(x){ return x.toString(16).padStart(2,'0'); };
  var dark = '#' + [r,g,b].map(function(c){ return pad(Math.max(0, Math.round(c * 0.82))); }).join('');
  var soft = '#' + [r,g,b].map(function(c){ return pad(Math.round(c + (255-c) * 0.92)); }).join('');
  var border = '#' + [r,g,b].map(function(c){ return pad(Math.round(c + (255-c) * 0.70))); }).join('');
  root.style.setProperty('--accent-dark', dark);
  root.style.setProperty('--accent-soft', soft);
  root.style.setProperty('--accent-border', border);
}, [state?.settings?.accent]);
```

⚠️ 因 bundle 被混淆，`state` / `t` (React) 的實際變數名要先從上下文確認。

### 步驟 2 — 硬碼 hex 全面改用 CSS 變數

在 bundle 裡，把下列**寫在 JSX style prop 或字串**的 hex 全部換成 `var(--accent)` / `var(--accent-dark)` / `var(--accent-soft)` / `var(--accent-border)`：

- `'#4a7c74'`, `` `#4a7c74` ``, `"#4a7c74"` → `'var(--accent)'`
- `'#3d6960'`, `` `#3d6960` ``, `'#3d6862'` → `'var(--accent-dark)'`
- `'#f0f7f5'`, `` `#f0f7f5` `` → `'var(--accent-soft)'`
- `'#d4e7e4'`, `` `#d4e7e4` ``, `'#c8e0db'` → `'var(--accent-border)'`

**例外：** 不要換掉定義 default state 的 `accent: '#4a7c74'`（這是預設值，不是樣式）。只換樣式用途的字串。

用 sed / Python 做批次替換時要小心 context：只換 `style:` / `color:` / `background:` / `fill:` / `stroke:` / CSS template literal 內的。

### 步驟 3 — `<style id="lerna-accent-overrides">` 區塊加上 `accent-color` 屬性支援

Tailwind `accent-[#4a7c74]` 對應的是 HTML `accent-color` 屬性（input 勾選框顏色）。目前的 override 只改了 `color`，要新增：

```css
.accent-\[\#4a7c74\] { accent-color: var(--accent) !important; }
```

### 步驟 4 — 驗證

1. 提取 script，`node --check` 應全部 pass
2. 用 jsdom 或在瀏覽器 DevTools 執行：
   ```js
   // 模擬使用者改顏色
   const s = JSON.parse(localStorage.getItem('ypt_app_state_v6'));
   s.state.settings.accent = '#ff5722';
   localStorage.setItem('ypt_app_state_v6', JSON.stringify(s));
   ```
   最多 500ms 後 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 應該回傳 `#ff5722`。

3. 打開 app，改 Settings 裡的 accent，應該**立刻**（<100ms）看到主畫面所有綠色按鈕、邊框、底色都變成新顏色，**包括** hover 狀態。

## 注意
- 不要改 `<script id="lerna-ai-sidecar">` 裡面的 Shadow DOM styles — 它已經有自己的 accent sync 機制（讀 `state.settings.accent` 並用 `--lerna-accent`）。
- 不要改 `<style id="lerna-accent-overrides">` 裡面已有的規則，只**新增**缺少的。
- 不要動 `accent: '#4a7c74'` 這個 default state 初始化字串。

## 本檔案路徑
`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\CODEX_PROMPT_v22_accent_live_update.md`

結束後請驗證並把變動過的 hex 數量、新增/修改的 useEffect 位置回報。
