# Codex Task — Fix: Lerna AI「語音」頁麥克風未實裝

## 背景 / 觀察
- 檔案：`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v21.html`
- 功能位置：Lerna AI sidecar → 「語音」tab（`renderers.voice`，約 v21 原始碼行 36272 附近，位於 `<script id="lerna-ai-sidecar">` 區塊內）。
- 使用者回報：進到「語音」頁，按🎤按鈕（`#v-mic`）沒有反應。看起來像是沒實作 / 沒啟動麥克風。

## 事實（請自行用 Read 再核對一次；不要憑記憶改）
- 目前 `#v-mic` 的 click handler 大致如下（壓縮過的片段）：
  ```js
  body.querySelector('#v-mic').onclick = () => {
    if (!canListen) return;
    if (d.listening && window.__recog) { window.__recog.stop(); return; }
    const r = new SR();
    r.lang = /[\u4e00-\u9fa5]/.test(d.word) ? 'zh-TW' : 'en-US';
    r.onresult = (e) => { d.word = e.results[0][0].transcript; };
    r.onend = () => { d.listening = false; window.__recog = null; render(); };
    r.start(); window.__recog = r; d.listening = true; render();
  };
  ```
- `SR = window.SpeechRecognition || window.webkitSpeechRecognition`
- `canListen` 由 `!!SR` 判斷

## 推測的根因（請在動手前驗證，用 console 實測）
1. **沒有 `onerror` handler** → 麥克風權限被拒、`network` 錯誤、`no-speech` 錯誤都會靜默失敗，使用者看到「什麼都沒發生」。
2. **沒有 interim result** → `onresult` 只在「最終結果」觸發，短字或使用者停頓不到 threshold 時看不到任何文字，感覺像壞掉。
3. **render() 會把整個 `#v-mic` 重建** → 按下按鈕後 `r.start()` 成功啟動，但 `render()` 立刻把 DOM 取代 (panel.innerHTML = ...)，使用者視覺上看到按鈕變「🔴 停止」，可是若 browser async 還沒跳權限 prompt（或 prompt 被關），整個 state 會錯亂。此點請實測確認是否為問題。
4. **file:// 協議下 Chrome / Opera 可能直接拒絕 Web Speech API**（使用者打開的是 `file:///C:/Users/.../YPT++ v21.html`）。需顯示清楚提示而不是靜默。

## 修改目標

改寫 `#v-mic` 相關邏輯，讓它：

1. **明確的錯誤訊息**：
   - 加 `r.onerror = (ev) => { ... }`，把 `ev.error` 轉成可讀文字（`not-allowed` / `no-speech` / `audio-capture` / `network` / `service-not-allowed` / `aborted`），透過現有 `toast()` 顯示。
   - 若是 `not-allowed`，toast 說明「麥克風權限被拒，請在瀏覽器網址列點鎖頭重新授權」。
   - 若是 `no-speech`，toast 說「沒偵測到聲音，請再試一次」。
   - 若 `canListen === false`，在 render 時顯示一則提示：「此瀏覽器不支援 Web Speech API — 請用 Chrome / Edge，或直接輸入」；不要只讓按鈕 disabled 讓人摸不著頭緒。

2. **Interim results**：
   - 設 `r.interimResults = true; r.continuous = false;`
   - `onresult` 改成合併所有 result：
     ```js
     r.onresult = (e) => {
       let final = '', interim = '';
       for (let i = e.resultIndex; i < e.results.length; i++) {
         const txt = e.results[i][0].transcript;
         if (e.results[i].isFinal) final += txt; else interim += txt;
       }
       d.word = (final + interim).trim();
       // update only the input value to avoid tearing down the recognizer
       const el = body.querySelector('#v-word');
       if (el) el.value = d.word;
     };
     ```
   - 這樣使用者邊說邊看到文字出現。

3. **不要每次都 render() 摧毀 DOM**：
   - 開始/停止時只更新按鈕狀態與 input，不要呼叫 `render()`。改成：
     ```js
     const setMicState = (on) => {
       d.listening = on;
       const mic = body.querySelector('#v-mic');
       if (mic) mic.textContent = on ? '🔴 停止' : '🎤';
     };
     ```
   - `onend` 呼叫 `setMicState(false)`，不 call `render()`。
   - 這樣 recognizer 的 async 權限流程不會被中途 `innerHTML = ...` 破壞。

4. **語言偵測強化**：
   - 目前只看是否含中日韓字元來決定 `zh-TW` / `en-US`。請讀取 YPT 狀態的 `settings.lang`（`loadYPT()?.settings?.lang`），若是 `'en'` 預設 `en-US`，若是 `'zh'` 預設 `zh-TW`；input 為空時用 app 語言，非空時才用現有字元偵測。

5. **保險：非 https/localhost 明確警告**：
   - 若 `location.protocol !== 'https:'` 且 `location.hostname !== 'localhost'` 且 `location.protocol !== 'file:'` — 目前使用者跑 `file://`，實測多數 Chromium 瀏覽器允許 file:// 使用 Web Speech API，但若仍然失敗（觸發 `not-allowed` / `service-not-allowed`），toast 要建議：「file:// 可能被瀏覽器阻擋，可改用本地 web server（如 `npx serve`）載入」。

6. **停止時正確釋放**：
   - 在 handler 的「if already listening」分支把 `r.onresult/onerror/onend` 清掉，避免殘留。

## 實作邊界（不要做的事）

- 不要改動其他 renderers（tutor / ocr / buddy…）。
- 不要把 Lerna AI sidecar 拆成多個 `<script>` — 保持單一 inline module。
- 不要修改 `defaultAI()` 或 storage schema。
- 不要引入外部套件 / CDN。
- 不要刪除 `🔊 發音` 按鈕邏輯。
- 保留現有 `ui.drafts.voice = { word, listening }` 結構；若要加新欄位（例如 `interim`）要向下相容（hydration 用 default 補齊）。

## 驗收條件

- [ ] Chrome / Edge 中按🎤 → 瀏覽器跳出麥克風權限 prompt → 授權後說「apple」→ 輸入框即時顯示「apple」。
- [ ] 拒絕權限 → toast 明確告知原因，按鈕自動回到🎤狀態。
- [ ] 不支援 Web Speech API 的瀏覽器 → 顯示替代提示，不是按鈕灰掉無訊息。
- [ ] 沒有 console error 出現（除了瀏覽器的權限資訊訊息）。
- [ ] 原有「🔊 發音」與「📖 查詢」功能無 regression。
- [ ] 把 `<script id="lerna-ai-sidecar">` 內容抽到 `.js` 後 `node --check` 通過。
- [ ] HTML 尾部 `</style></head><body><div id="root"></div>` 與 `</body></html>` 結構維持完整（v21 繼承自 v18/v19，此為易裂處）。

## 測試 checklist

1. 開啟 v21 檔 → 按畫面右下 AI 圓球 → 切到「語音」tab → 輸入 API key 後能進入畫面。
2. 按🎤 → 權限 prompt 出現 → 允許。
3. 說「pineapple」→ 輸入框實時顯示文字（interim + final）。
4. 按「🔴 停止」→ 按鈕回到🎤，文字保留。
5. 按📖 查詢 → AI 回傳單字 JSON。
6. 切到「家教」tab 再切回「語音」→ 狀態不爆。
7. 把瀏覽器語言 / app 語言切成 English → 再按🎤說 "hello" → 辨識 `en-US`。
