# Codex Task — Fix: PronounceButton 觸發 Flashcard 翻面

## 目標
在 `YPT++ v20.html`（或目前主版本）中，Flashcard 學習模式裡，使用者按下語音/朗讀按鈕 (🔊 / Mic icon) 時，卡片會**同時翻面**。需把按鈕點擊與翻面事件分離，按語音**不可**觸發翻面。

## 事實
- 檔案：`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v20.html`
- 相關元件：`PronounceButton`（大約行 24982）
- 被 `PronounceButton` 包住的外層卡片（含 `onClick={() => setFlipped((e) => !e)}`）出現位置（至少 6 處）：約行 26179、26268、26297、26374、26426、27351、27382（`lerna-study-pronounce` / `lerna-card-pronounce` 類別）
- 外層 `<div className="lerna-study-card ...">` 行 26168 有 `onClick: () => setFlipped((e) => !e)`
- `PronounceButton` 目前的 `onClick` 定義（壓縮後）：
  ```js
  onClick: () => { speakCardText(e, t); }
  ```
  參數 `e` 為 React 事件？**請先閱讀該函式確認** — 目前命名看起來像 text (prop) 而不是 event，因為外層結構是 `function PronounceButton({ text: e, lang: t, ... })`，所以 `e` 是 **text prop**，不是事件物件。

## 修正方式（請依序執行）

1. **讀檔確認**：用 Read/grep 定位 `function PronounceButton`，確認 prop destructuring 是 `{ text: e, lang: t, label: n, ...}`，在閉包內 `e` 指 prop text。

2. **修改 onClick 取得事件物件並阻擋冒泡**：
   - 把 `onClick: () => { speakCardText(e, t); }` 改成：
     ```js
     onClick: (evt) => {
       evt.stopPropagation();
       evt.preventDefault();
       speakCardText(e, t);
     }
     ```
   - 注意：因為此按鈕可能在非 Flashcard 的 context 也使用（例如 DeckDetail / NoteEditor），`stopPropagation` 應該是安全的（按鈕本身的功能不依賴父層事件）。

3. **同時修補所有被 `<button>` 包住的內部結構**：
   - 確認 `PronounceButton` 只 render 單一 `<button type="button">`，沒有 nested clickable wrapper。

4. **驗證**：
   - 搜尋整個檔案：`grep -n "setFlipped" YPT++\ v20.html` — 每個 onClick setFlipped 的父層都不應被 PronounceButton 的點擊觸發。
   - 用 `node --check` 確認無語法錯誤（註：此為 HTML 檔，可把 `<script type="module">` 內容抽出到 .mjs 後檢查，或以 `jsdom` 載入測試）。
   - 測試：Chrome 開檔 → Library → 選任一 Deck → 進學習模式 → 按 🔊 → 期望：**聽到語音但卡片不翻面**；再點卡片主體 → 期望：**翻面**。

5. **補充 a11y**：
   - 為 `<button>` 加上 `aria-label={label}`（若已有 `title={label}` 保留）。
   - 按鈕 `type="button"` 必須存在（避免 submit 預設行為）— 這點已在原碼中，確認保留。

## 驗收條件
- [ ] Flashcard 學習模式按語音 → 只播音，**不翻面**
- [ ] 卡片主體點擊 → 翻面正常
- [ ] DeckDetail 頁的 PronounceButton → 仍可播音，無 regression
- [ ] NoteEditor / 其他 context 的 PronounceButton → 無 regression
- [ ] `node --check` 對 module script 通過
- [ ] 所有 TTS 語音（中文、英文、其他語言）仍可播放

## 不要做的事
- 不要拔掉 Flashcard 的翻面邏輯
- 不要把 `PronounceButton` 移出卡片外（保留在卡片內部）
- 不要大幅改 PronounceButton 的視覺（v20 已有新 icon 設計，不要再改）
- 不要把 `pointer-events` 關掉（會讓按鈕完全無法點）

## 若發現其他 nested clickable → event bubble bug
同樣模式套用 `stopPropagation + preventDefault` 即可。
