# Codex Prompt — YPT++ v23 群組功能重整 (layout / 注入點 / 狀態同步)

## 你要改的檔案
`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v23.html`

**只能動一個 script 區塊**：`<script id="ypt-v23-upgrade">` (大約 line 37075 開始，到檔尾 `})();` 結束前的 `</script>`)。

**不要動** 這些區塊：
- React bundle (`<script type="module">` / 外部 `src=` 那兩個)
- `<script id="lerna-ai-sidecar">` (已修好)
- `<style>` / `<head>` / React 掛載點 `<div id="root">`

**驗證指令**：修完後 `node --check` 每一個 inline script block 都必須 pass，`<html>/<head>/<body>` 各保持 1 開 1 閉，script 標籤 7 開 6 閉 (第 7 個 open 在 JS string literal 裡，合法)。

---

## 已知的 root cause（照順序修）

### 1. 頁面偵測誤判
`isGroupsPage(panelEl)` 目前用 `panelEl.textContent.indexOf('學習小組')` 之類的字串 match。只要其他頁面（例如 Profile、Settings、Stats）文字裡出現「學習小組」四個字，這個 function 就回 true，導致 v23 panel 被注入到錯的頁面底部。

**修法**：改用更穩的 marker
- 優先抓主 app header / breadcrumb 的 text (通常是短 string，不會誤判)
- 或改用 `location.hash` / `window.history.state` 如果主 app 有用 router
- 若上面兩個都抓不到，fallback 用「page panel 的第一個 `<h1>` / `<h2>` 文字等於 Groups 標題」而不是 textContent 全文 indexOf
- zh-TW / en 的標題常數寫進一個 `GROUP_PAGE_TITLES = ['學習小組','Study Group','Study Groups']` array

### 2. 選中 group 偵測不可靠
`getSelectedGroup()` 現在用 `[class*="border-[#4a7c74]"]` 找被 highlight 的 group card，失敗時 fallback 到 `groups[0]`。問題：
- React 重渲染時 class 可能瞬間不存在 → panel 閃到 `groups[0]`
- 使用者若進入 group detail 頁（不是 list 頁），選擇邏輯完全不 work

**修法**：
- 如果 v23 panel 只在 **group detail 頁** 顯示（建議這樣，見下面第 3 點），選中 group 就等於當前 detail 頁的那個 group —— 從 detail 頁面上的 group 名稱 / ID 抓，不需要 selection 狀態
- 偵測「是否在 detail 頁」：找 panel 內的 back button、或 group 名稱 `<h1>`、或 URL hash
- 拿到 group 名稱後用 `groups.find(g => g.name === name)` 對回 app state
- 如果抓不到 group → **不要 render**，不要 fallback 到 `groups[0]`

### 3. 注入位置 → 改到 group detail 頁
目前 panel 是被 append 到整個 Groups list 頁的底部。使用者在 list 頁就看到一堆公告 / chat / 排行疊在 group 列表下方 → 亂。

**修法**：v23 panel 只在 **單一 group 的 detail 頁** 顯示。進入 detail 頁 → inject 在 group header 下方、member list 上方（或最底 tab）。離開 detail 頁（回 list / 切別的 tab） → remove host 節點。

### 4. 整塊 innerHTML 重畫 → 輸入時閃爍、動畫失效
`renderGroupUpgradePanel` 每次被叫就 `hostEl.innerHTML = ...`，造成：
- 打字到一半 input 失焦 / 游標跑掉 (現在只擋了 `#v23-chat-text` focus，其他 input 沒擋)
- rank tab 切換感覺卡卡
- chat feed 不會 auto-scroll 到最底

**修法**：改成**區塊式更新**
- 初次 render：build 一次完整 DOM，cache 每個 section 的 node ref (`annNode`, `chNode`, `chatFeedNode`, `rankNode`)
- 後續更新：只改受影響的那一塊
  - 發訊息 → 只 append 新訊息到 `chatFeedNode`，scroll to bottom
  - 切 rank tab → 只重畫 `rankNode` 內容
  - 編公告 → 只改 `annNode.textContent`
- MutationObserver 的 callback 只在「當前 group 變了」或「detail 頁離開」時才整塊 rebuild / teardown

### 5. Chat UX
- 沒 auto-scroll 到最新訊息
- 沒相對時間（「剛剛」/「3 分鐘前」/「昨天」）
- 沒「我 vs 別人」視覺區分（我的訊息靠右、accent 色底；別人靠左、灰底）
- 沒頭貼（可以用 v23 已經實作的 `renderAvatarInto` 把訊息左邊放一個 24×24 圓形頭像）
- Enter 送出、Shift+Enter 換行 (目前只做了 Enter 送出)

### 6. 排行數值都是 0 的問題
現在排行靠 `member.focusMinutesToday / focusMinutesThisWeek / longestSessionMinutes / daysActive7`。主 app 的 `group.members[]` 物件可能根本沒這幾個 field → 所有人分數都是 0，排行沒用。

**修法**：
- 先在 console log 一次真實的 `group.members[0]` 看實際有哪些 field
- 用實際存在的 field 換算。如果主 app 完全沒有每個 member 的即時資料（很可能，因為這是本機 demo），就用 **「目前本機用戶」自己的資料** (從 `app.sessions`, `app.dailyStats` 計算)，其他 member 用 v23 自訂的 mock 或直接顯示「—」
- 把「我」的這張 card 做成**個人貢獻卡**，顯眼地放在排行上方：本週專注分鐘、本週參與挑戰 %、角色 badge、連續天數

### 7. weeklyChallenge.contrib 從來沒被寫入
現在 challenge object 有 `contrib: {}` field，但整份 code 沒有一個地方寫入它。進度條用 `members.reduce((a,m) => a + (m.focusMinutesThisWeek || ...))` 算，只要 member 欄位是 0 → 永遠 0%。

**修法**：
- 當前用戶開新 session / 結束 session 時（監聽 localStorage `ypt_app_state_v6` 變化），把 `focusMinutes - prevFocusMinutes` delta 累加到 `ext.weeklyChallenge.contrib[myId]`
- 進度條改用 `sum(Object.values(contrib))` 而不是 member field
- 跨週自動 reset: 偵測到 `weekStart !== mondayOfWeek(now)` → 清掉 contrib (現在有做但沒用在進度)

### 8. Admin UX 幾乎看不見
Admin 提權隱藏在「點 member row → member profile modal」。新使用者根本不會發現自己有權限。

**修法**：
- 小組建立者預設 admin (建立時寫 `ext.roles[creatorId] = 'admin'`)
- admin 身份時，在 panel 最上方顯示一個小的 role badge (「你是管理員」)
- admin 專屬動作 (編公告 / 設挑戰目標 / 提權其他 member) 要有明顯按鈕，不要藏

### 9. 樣式統整
現在 `style.cssText` 用 inline CSS 硬塞色碼 (`#d4e7e4`, `#4a7c74`, `#6b7280`...)，跟主 app 已經有的 `--accent` CSS variable 不同步。

**修法**：
- 所有顏色一律 `var(--accent, #4a7c74)` / `var(--accent-soft)` / `var(--accent-border)` — 這四個變數 v22 的 accent runtime 已經在 `:root` 注入
- 圓角、padding、字型大小照主 app 的 cream `#faf9f6` / brown border 風格
- 每張 card 的 shadow 用同樣的 `box-shadow` token

### 10. 語言同步
現在 sidecar 自己有 `isEn / T()` 的 i18n table。確認它真的有從 `settings.lang` 讀 + 在語言切換時會重畫 (`storage` event listener + MutationObserver)。如果切 language 後 v23 panel 還是舊語言 → teardown + rebuild。

---

## 驗證 checklist（全部要過）

1. `node --check` 對 v23.html 的 **所有** inline `<script>` 區塊都 pass
2. HTML tag balance：`<html>/<head>/<body>` 各 1/1/1；`<script>` 7 開 6 閉
3. 瀏覽器開 v23.html：
   - **Focus / Plan / Stats / Profile / Settings** 頁面 **看不到** v23 群組 panel
   - 進 **Groups list** 頁面 也看不到 (不再是整頁底部疊一坨)
   - 點進某個 **group detail** 頁 才看到 v23 panel（公告 / 挑戰 / chat / 排行）
   - 切到別的 group → panel 內容換成新 group 的資料，不會閃一下別的 group
   - chat 打字中，MutationObserver 再觸發時 input 不會失焦、游標不會跳
   - 發訊息 → auto scroll 到底、自己的訊息靠右 accent 色、別人的靠左
   - admin 能看到「編公告 / 設挑戰」按鈕；非 admin 看不到
   - 週挑戰進度條：自己開一個 focus session 結束後，進度條百分比 > 0
4. 離開 Groups → 回 Groups list → 再點 detail → v23 panel 正常顯示，沒殘留舊 host 節點
5. 切語言 (zh-TW ↔ en)，v23 panel 所有字串都跟著變

---

## 硬規矩

- **不要**把 v23 sidecar 拆成多檔：inline script 保持一塊
- **不要**動 React bundle 或 lerna-ai-sidecar
- **不要**改主 app 的 localStorage schema (`ypt_app_state_v6`)；v23 自己的資料繼續存 `ypt_v23_upgrade_v1`
- **不要**把 v23 做成全域 sidebar / 浮動視窗 —— 它就是 group detail 頁的內嵌區段
- 改完後把更新寫回原檔 `YPT++ v23.html`，**不要**另存成 v24
- 使用者操作過程中如果你不確定某個 main app 的 DOM 結構 / 欄位名稱，**log 一次實際值到 console**、用 observed shape 寫 parser，不要猜

---

## 回報格式
修完後用 ≤150 字中文回報：
1. 改了幾個 function / 加了幾個 helper
2. node --check 結果 (每個 script block 的 status)
3. 目前還有哪些部分你無法驗證（例如沒辦法實機跑瀏覽器看動畫）
4. 任何你覺得這個 sidecar 架構本身有缺陷、需要使用者決定的 trade-off
