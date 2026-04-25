# Codex Task — Lerna AI 面板 i18n：跟隨 App 語言切換 (zh / en)

## 背景 / 觀察
- 檔案：`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v21.html`
- 問題：主程式 (`<script type="module">` 的 React bundle) 有完整 zh/en i18n，透過 `state.settings.lang` 切換；但 Lerna AI sidecar (`<script id="lerna-ai-sidecar">`) 所有 UI 字串（頁籤標籤、標題、提示語、錯誤訊息、按鈕文字、送給 Gemini 的 system prompt）都是**硬編 zh-TW**。
- 使用者回報：把 app 切換成 English 後，AI 面板仍然是中文，沒有同步。

## 事實（先 grep 再改；以下只是起手點）
- Sidecar 位置：`<script id="lerna-ai-sidecar">` … `</script>` 區塊（約 v21 原始碼 35247–36498 行）。
- Sidecar 透過 `loadYPT()` 讀取主程式 localStorage key `ypt_app_state_v6`，可以取得 `settings.lang`（值為 `'zh'` 或 `'en'`）。
- 主程式寫入 settings.lang 時會呼叫 setState → persist → localStorage。Sidecar 目前**沒有**監聽 `storage` 事件，所以就算 i18n 加好，切換語言時 AI 面板也不會自動 re-render。

## 修改目標

### 1) 建立 i18n 表
在 sidecar 頂端（`defaultAI` 之後）建立：
```js
const I18N = {
  zh: { /* 所有字串 */ },
  en: { /* 對應英文字串 */ }
};
const getLang = () => (loadYPT()?.settings?.lang === 'en' ? 'en' : 'zh');
const t = (key) => {
  const L = getLang();
  return (I18N[L] && I18N[L][key]) ?? I18N.zh[key] ?? key;
};
```

### 2) 要翻譯的字串（最少清單，請自己從 sidecar 內再掃一遍補齊）

| Key | zh | en |
|---|---|---|
| `ai.title` | `✨ Lerna AI` | `✨ Lerna AI` |
| `ai.close` | `關閉` | `Close` |
| `tabs.tutor` | `家教` | `Tutor` |
| `tabs.cards` | `字卡` | `Cards` |
| `tabs.notes` | `筆記` | `Notes` |
| `tabs.mistakes` | `錯題` | `Mistakes` |
| `tabs.plan` | `計畫` | `Plan` |
| `tabs.reflect` | `反思` | `Reflect` |
| `tabs.report` | `週報` | `Report` |
| `tabs.ocr` | `OCR` | `OCR` |
| `tabs.voice` | `語音` | `Voice` |
| `tabs.buddy` | `Buddy` | `Buddy` |
| `tabs.settings` | `⚙︎` | `⚙︎` |
| `key.missing` | `尚未設定 Gemini API Key` | `No Gemini API key yet` |
| `key.go` | `前往設定` | `Open settings` |
| `ocr.title` | `OCR / 圖片助手` | `OCR / Image assistant` |
| `ocr.hint` | `上傳講義/筆記/題目照片,AI 幫你轉文字、解題、做字卡。` | `Upload lecture, notes, or question photos — AI will transcribe, solve, or turn them into cards.` |
| `ocr.remove` | `移除圖片` | `Remove image` |
| `ocr.doWhat` | `要做什麼` | `What to do` |
| `ocr.mode.transcribe` | `📝 純轉文字` | `📝 Transcribe only` |
| `ocr.mode.summary` | `📑 轉文字 + 摘要` | `📑 Transcribe + summary` |
| `ocr.mode.solve` | `🧮 把題目解出來` | `🧮 Solve the problem` |
| `ocr.mode.cards` | `📚 直接生成字卡` | `📚 Generate flashcards` |
| `ocr.run` | `執行` | `Run` |
| `ocr.running` | `OCR 中…` | `Running OCR…` |
| `voice.title` | `語音單字` | `Voice vocabulary` |
| `voice.hint` | `對麥克風說一個單字，或輸入 → AI 給定義/例句，按🔊聽發音。` | `Speak a word into the mic, or type it — AI will define and exemplify. Tap 🔊 to hear it.` |
| `voice.input` | `輸入或聽…` | `Type or speak…` |
| `voice.query` | `📖 查詢` | `📖 Look up` |
| `voice.saving` | `已加入單字本` | `Added to vocabulary` |
| `voice.book` | `單字本` | `Vocabulary book` |
| `voice.empty` | `還沒存單字` | `No words yet` |
| `voice.mic.stop` | `🔴 停止` | `🔴 Stop` |
| `common.running` | `查詢中…` | `Looking up…` |
| `common.delete` | `刪` | `Delete` |
| `common.failed` | `失敗` | `Failed` |
| …（其他 tab 自行補齊） | | |

### 3) Gemini prompt 本身也要雙語
例：OCR 的 `prompts` dict 目前全部要求「繁體中文」輸出。若 `getLang() === 'en'`：
```js
const prompts = getLang() === 'en' ? {
  transcribe: 'Transcribe all text in the image exactly, preserving layout with line breaks and indentation.',
  summary: 'First transcribe fully, then produce 3-5 bullet summary points.',
  solve: 'Identify the problem, then solve it step by step. Reply in English.',
  cards: 'Output a JSON array [{"front":"q","back":"a"}] of at least 8 flashcards in English.'
} : {
  transcribe: '把圖片中的文字完整轉成繁體中文文字,保留原排版 (用換行/縮排)。',
  // …existing…
};
```
同樣規則套到：`tutor` 的 system prompt（目前寫死「用繁體中文回答」）、`voice` 的字典 prompt（目前寫死「繁中精簡定義」）、`reflect`、`plan`、`report` 的 system prompt 與 JSON 指示。

### 4) 監聽語言切換
在 sidecar 的初始化段落加：
```js
window.addEventListener('storage', (e) => {
  if (e.key === YPT_KEY) {
    // re-render whole panel when language or other YPT state changes
    render();
  }
});
```
另外因為同一個 tab 內的 React setState 不會觸發同源 `storage` 事件，再補一條 polling（低成本、已存在類似機制 — 見 sidecar 末段 `setInterval(..., 5000)`）：把最後看到的 lang 記在 closure，和目前不同時呼叫 `render()`。

### 5) DOM lang attr
在 `panel` 最外層 div 加 `lang` 屬性（輔助 a11y / CSS `:lang()`）：
```js
panel.setAttribute('lang', getLang() === 'en' ? 'en' : 'zh-Hant');
```

## 不要做的事
- 不要改主程式 React bundle 的 i18n（它已正常運作）。
- 不要把 sidecar 翻譯檔外部化成 JSON 另建檔案，保持單一 HTML。
- 不要改 `YPT_KEY` / `AI_KEY` 等 localStorage key。
- 不要修改使用者已儲存的 `voiceWords` / `mistakes` / `weeklyReports` — 這些是使用者資料，不翻譯。
- 不要把現有 zh 字串刪掉；英譯是新增。
- 不要一次重構超出 i18n 範圍（不要順便改樣式 / 換 tab 順序 / 加新功能）。

## 驗收條件
- [ ] 進 Settings → 切語言 zh → en → AI 面板立即（≤5 秒）切成英文（tab 名稱、所有提示、錯誤訊息、Gemini 回覆語言都是英文）。
- [ ] 切回 zh → 全部回中文。
- [ ] 使用者已存的單字 / 錯題中原語言（例如中文定義）不會被強改。
- [ ] 任何一個 tab（家教、字卡、筆記、錯題、計畫、反思、週報、OCR、語音、Buddy、設定）在英文模式下沒有漏字（沒有「原樣留中文」的情況）。
- [ ] Gemini 的 JSON schema 欄位鍵名 (`front` / `back` / `word` / `ipa` / `definition` / `examples`) 保持不變（只翻譯內容，不翻譯 key）。
- [ ] `node --check` 對抽出的 sidecar script 通過。
- [ ] HTML 結尾 `</style></head><body><div id="root"></div></body></html>` 結構完整（v21 易裂處）。

## 測試 checklist
1. 開啟 v21 → 設定 → 語言切 English → 右下 AI 球 → 展開面板。所有 tab 名是英文，內容是英文。
2. 在 OCR tab 上傳圖 → 執行（mode = Transcribe only）→ Gemini 回英文轉寫結果。
3. 在 Voice tab → 查詢 "apple" → 回英文定義 & 例句。
4. 把語言切回中文 → 面板即時變中文；再查同一個詞回中文定義。
5. 重新整理頁面 → 語言設定 persist，AI 面板初始即為正確語言。
