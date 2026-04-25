# Codex Prompt — YPT++ v24「我的班級」action handlers 實作

## 要改的檔案（唯一）
`C:\Users\hengy\OneDrive\Documents\Claude\Projects\Learning\YPT++ v24.html`

**只動一個 script 區塊**：`<script id="ypt-v24-class-module">`（在檔尾、`</body>` 之前）。

**其他 script 區塊一律禁止碰**：
- 兩個 `<script type="module" src="...">`（React bundle 外部引入）
- 前兩個 inline `<script>`（第一個是 early-accent hydration、第二個是 React main compiled bundle）
- `<script id="lerna-ai-sidecar">`（已修好、AI 助手）
- `<script id="ypt-v23-upgrade">`（群組 sidecar，已完成）

**絕對規則**：
- 不可改 React bundle、不可改 v23 sidecar、不可改主 app 的 `localStorage` schema (`ypt_app_state_v6`)。
- v24 自己的資料繼續存 `ypt_v24_class_v1`，其他資料全部 read-only。
- 改完存回原檔 `YPT++ v24.html`，**不要另存檔**。
- 每個 inline script block 必須通過 `node --check`；`<html>/<head>/<body>` 各 1/1/1；`<script>` 8 開 7 閉（第 8 個 open 在 JS string literal 裡、合法）。

---

## 背景：sidecar 的運作方式

整個 v24 班級模組是一個 IIFE，狀態流如下：

```
頁面載入 → boot() → injectStyle() + observe() + ensureMount()
  ensureMount() 找到主 app 「我的班級」panel → 把其他子節點 hide → 插入 <div class="v24c-root">
  render(host) 依 getState() 的 uiRole / uiScreen 挑 SCREENS[uiScreen](role, cls) 產生 innerHTML
  bindEvents(host) 用事件委派 attach click / submit
  使用者點按鈕 → 取 data-action="class:<name>" + data-payload (JSON) → dispatch(action, payload, el)
```

目前 `dispatch()` 只 `console.log` + toast `[<action>] 尚未實作`。你要把它改成實作。

暴露給你的 helper（`window.__ypt_v24_class.*`，也是 IIFE 內同名 function，直接呼叫）：

| helper | 用途 |
|---|---|
| `getState()` | 讀 `ypt_v24_class_v1` 並補預設值，回傳 `{ uiRole, uiScreen, meId, activeClassId, classes: [...] }` |
| `updateState(patch)` | `Object.assign(state, patch)` 再 `writeV24` |
| `activeClass()` | 回傳當前 class 物件（classes 裡 id === activeClassId 的那個） |
| `writeV24(state)` | 寫 localStorage（整個 state object） |
| `readV24()` | 讀 localStorage（raw） |
| `T(key)` | i18n 字串，key 在 STR table（自動依 app state.settings.lang 切 zh-TW / en） |
| `toast(msg)` | 顯示右下角 toast（用來回饋 success / error） |
| `SCREENS` | 所有畫面 template function map，用 key 取值後傳 `(role, cls)` 就會回 HTML string |
| `NAV` | 側邊選單結構（5 group，每個含 items[]） |
| `DEFAULT_CLASS` | 初次建立 class 時的模板，不要直接 mutate |
| `render(host)` | 整塊 v24c-root 的 rerender，修改 state 後呼叫它 |
| `dispatch(action, payload, el)` | ← **你要改的這個** |

找 host element 的慣用法（在 dispatch 內用）：
```js
const host = el && el.closest('.v24c-root');
```

---

## 狀態 schema（`ypt_v24_class_v1`）

```ts
{
  uiRole: 'teacher' | 'student' | 'captain' | 'parent',  // 目前預覽身份
  uiScreen: string,                                       // SCREENS 的 key
  meId: string,                                           // 當前使用者 member.id
  activeClassId: string,
  classes: Array<{
    id: string,
    name: string,
    subtitle: string,
    motto: string,
    crest: string,          // emoji 或 data-URL
    color: string,          // hex
    code: string,           // 加入代碼
    term: string,
    termStart: string,      // ISO date
    termEnd: string,
    joinMode: 'code' | 'invite' | 'qr' | 'parent',
    archived: boolean,
    teacherId: string,

    members: Array<{
      id: string,
      name: string,
      role: 'teacher' | 'captain' | 'student' | 'parent',
      subjectRoles?: string[],  // 例如 ['英文科代']
      seat?: string | null,
      weeklyFocus: number,      // 小時
      childOf?: string,         // 家長指向學生 id
    }>,

    tasks: Array<{
      id: string,
      title: string,
      subject: string,          // 英文 / 數學 / 自然 / 社會 / 國文
      kind: 'image' | 'pdf' | 'text' | 'quiz',
      points: number,
      due: string,              // ISO datetime
      description: string,
      status: 'open' | 'closed',
      createdBy: string,        // member.id
      createdAt: string,
    }>,

    announcements: Array<{
      id: string,
      title: string,
      body: string,
      category: 'exam' | 'event' | 'admin' | 'study',
      pinned: boolean,
      due?: string,
      author: string,
      createdAt: string,
      reads: string[],          // 已讀的 member.id list
    }>,

    qa: Array<{
      id: string,
      title: string,
      body: string,
      author: string,
      createdAt: string,        // ISO
      replies: Array<{ id: string, author: string, body: string, at: string }>,
      answered: boolean,
      taskId?: string,          // 關聯作業
    }>,

    calendar: Array<{
      id: string,
      title: string,
      kind: 'task' | 'exam' | 'event',
      date: string,             // ISO date
    }>,

    resources: Array<{
      id: string,
      title: string,
      subject: string,
      kind: 'pdf' | 'image' | 'link' | 'doc',
      tier: 'teacher' | 'captain' | 'peer',
      uploader: string,
      downloads: number,
    }>,

    weeklyGoalHours: number,

    // 以下 dispatch 會大量寫入
    attendance: { [dateISO: string]: { [memberId: string]: 'present' | 'absent' | 'late' | 'leave' } },
    submissions: { [taskId: string]: { [memberId: string]: {
      status: 'draft' | 'submitted' | 'graded' | 'returned',
      at?: string,
      text?: string,
      attachments?: Array<{ name: string, kind: string, dataUrl?: string }>,
      grade?: { score?: number, snippet?: string, by?: string, at?: string },
    } } },
    reviews: { [taskId: string]: { [reviewerId: string]: { [revieweeId: string]: { score: number, comment: string, at: string } } } },
  }>,
}
```

---

## 要實作的 action 列表（一律 `class:<name>`）

實作方法的統一模板：
```js
function dispatch(action, payload, el) {
  try { console.log('[v24 class] dispatch', action, payload); } catch (e) {}
  const host = el && el.closest('.v24c-root');
  const cls = activeClass();
  const me = (cls.members || []).find(m => m.id === getState().meId);

  switch (action) {
    case 'class:goto': {
      if (payload && payload.screen) {
        updateState({ uiScreen: payload.screen });
        if (host) render(host);
      }
      break;
    }
    // … 以下每個 action 都依照下表實作
    default:
      toast('[' + action + '] ' + T('notImpl'));
  }
}
```

> **重要**：`class:goto` 已經在 `bindEvents` 裡內建一次處理（為了不破壞導航），你在 dispatch 裡也重寫一次一樣正確，兩條路徑一致即可。

### 導航 / Meta
- `class:goto` — `payload = { screen: string }`. 切換 `uiScreen`、re-render。**（已示範）**
- `class:openMyCard` — 切到 `home` 並顯示個人貢獻卡 highlight。若 home 已有 `#my-card` 區塊則 scroll 過去。

### 作業 Task
- `class:openTask` — `payload = { taskId }`. `updateState({ uiScreen: 'submissions', filterTaskId: taskId })`.
- `class:taskCreate` — 切 `uiScreen: 'taskCreate'`，clear `draftTask`.
- `class:taskKind` — `payload = { kind }`. 把 `state.draftTask.kind = kind` 寫入；re-render 保留其他欄位（從 form DOM 讀）。
- `class:taskSave` — 從 form (`host.querySelector('[data-field=title]')` 等)讀值、組 `task` 物件、push 到 `cls.tasks`、updateState、toast 成功、切回 `uiScreen: 'tasks'`。檢核：`title` 非空、`due` valid ISO；驗證失敗用 `toast(T('err') + ': ' + msg)`、不寫 state。
- `class:remind` — `payload = { taskId, memberId? }`. 無論有無 memberId，都 append 到 `cls.reminders` array（沒有就建立），並 toast `已提醒 <name>`。
- `class:remindAll` — `payload = { taskId }`. 對所有 status !== submitted/graded 的 member 呼叫 `remind` 邏輯。
- `class:submissionsFor` — `payload = { taskId }`. 切 `uiScreen: 'submissions'`、`filterTaskId = taskId`。
- `class:submissionsFilter` — `payload = { filter: 'all' | 'submitted' | 'missing' | 'late' }`. 寫到 state 後 re-render。
- `class:viewGrade` — `payload = { taskId, memberId }`. 切 `uiScreen: 'grading'`、設 `state.gradingCursor = { taskId, memberId }`.
- `class:exportCsv` — `payload = { taskId }`. 生 CSV string、`URL.createObjectURL(new Blob([csv],{type:'text/csv'}))`、`<a download>` 模擬點擊。CSV columns: `memberId, name, status, submitAt, score, snippet`.

### 評分 Grading
- `class:gradePrev` / `class:gradeNext` — 依 `state.gradingCursor` 移到上一 / 下一個學生（以 tasks[].members 排序）。
- `class:gradeSubmit` — `payload = { taskId, memberId, score, snippet }`. 寫入 `cls.submissions[taskId][memberId].grade = { score, snippet, by: me.id, at: now }`、status 改 `graded`、自動 next。
- `class:gradeSnippet` — `payload = { taskId, memberId, snippetId }`. append 常用評語片段到輸入框（read 片段 from `state.snippets`）。
- `class:gradeSnippetManage` — 切到 `settings` screen，scroll 到 `#snippet-editor` section。

### 繳交 Submit (學生)
- `class:submitDraft` — `payload = { taskId, text?, attachments? }`. 寫 `cls.submissions[taskId][me.id] = { status: 'draft', text, attachments, at: now }`. toast `已存草稿`.
- `class:submitSend` — 和 submitDraft 一樣但 status `submitted`。要檢核 task 是否過期 → 過期仍可送但 submission 加 `late: true`。
- `class:submitUpload` — `payload = { taskId }`. 開 `<input type="file" accept=...>`、讀成 dataURL、push 到 `state.draftSub[taskId].attachments`. 注意容量：單張 > 2 MB 先 resize (canvas → JPEG 0.8)。pdf/doc 直接存 dataURL 但 warn 若 > 5 MB.

### 出席 Attendance
- `class:attendanceToggle` — `payload = { date, memberId, to: 'present'|'absent'|'late'|'leave' }`. 寫 `cls.attendance[date][memberId] = to`.
- `class:attendanceSave` — 持久化（已在 toggle 時寫了，這裡單純 toast 成功）。
- `class:attendanceSubmit` — 同 Save 但把 `cls.attendance[date].locked = true`（之後禁修）。
- `class:attendanceView` — `payload = { memberId }`. `uiScreen: 'history'`、`historyFilter = { memberId, kind: 'attendance' }`.
- `class:attendanceExport` — 匯出 CSV（header: date,member,status）。
- `class:rosterTemplate` — 下載空白 roster CSV template。

### 成員 Members
- `class:memberInvite` — 開 dialog（可以用 `prompt()`）問 email / 代碼，push 成員至 `cls.members`，role 預設 `student`.
- `class:memberEdit` — `payload = { memberId }`. 切 `uiScreen: 'members'`、設 `editingMemberId`. 允許改 name / subjectRoles / seat / role。
- `class:memberImportCsv` — 開 file input 吃 CSV（header: name,seat,role）parse 並 merge。

### 同儕互評 Peer
- `class:peerRead` — `payload = { taskId, revieweeId }`. 切 `uiScreen: 'peer'`、設 `peerCursor = { taskId, revieweeId, mode: 'read' }`.
- `class:peerWrite` — 同上但 `mode: 'write'`. submit 時寫 `cls.reviews[taskId][me.id][revieweeId]`.

### Q&A
- `class:qaNew` — `payload = { taskId? }`. 開 dialog 取 title/body，push 至 `cls.qa`, author = me.id.
- `class:qaOpen` — `payload = { qaId }`. 切到 qa screen，打開該題並顯示 replies。
- `class:qaFilter` — `payload = { filter: 'all'|'open'|'answered'|'mine' }`. 存 `state.qaFilter`.

### 行事曆 Calendar
- `class:calPrev` / `class:calNext` — 月份切換。寫 `state.calCursor = 'YYYY-MM'`.
- `class:calOpenDay` — `payload = { date }`. 開 dialog（`alert` fallback）列當天事件。
- `class:calExport` — CSV 匯出：date,title,kind.
- `class:calExportIcs` — 生 ICS 字串（VCALENDAR/VEVENT），download 為 `class-<code>.ics`。
- `class:calSubscribeGoogle` — 組 Google Calendar URL `https://calendar.google.com/calendar/u/0/r?cid=...`、`window.open(url, '_blank')`.

### 座位表 Seats
- `class:seatSelect` — `payload = { row, col }`. 把 me.id 寫進對應 seat（檢查 seat 是否已被人佔、已佔則 toast）。
- `class:seatEdit` — teacher 身份 open drag mode（設 `state.seatEditMode = true`）。
- `class:seatReshuffle` — teacher 身份：random shuffle members 的 seat，toast 確認。

### 共筆 CoEdit
- `class:coeditSave` — 從 `<textarea>` 讀 content、寫 `cls.coedit[docId].content`、append to history。
- `class:coeditLock` — toggle `cls.coedit[docId].locked`.
- `class:coeditHistory` — `uiScreen: 'history'`、filter kind: 'coedit'。

### 資源 Resources
- `class:resourceUpload` — file picker → 存 base64 或 link → push。
- `class:resourceDownload` — `payload = { resId }`. `downloads += 1`、trigger download (`<a href=dataUrl download>`).
- `class:resourceFilter` — `payload = { subject?, kind?, tier? }`. 寫 `state.resFilter`.

### 加入 / 邀請 Join
- `class:joinByCode` — 取 input code → 呼叫 `prompt` 或 form → 新增到 state.classes 的 pending。demo 可以直接把使用者加為 student。
- `class:joinScanQr` — 暫用 `prompt('貼上 QR 解碼')`、同 joinByCode。
- `class:joinParentConsent` — 家長模式：寫 `cls.parentConsents[me.id] = { at: now }`.
- `class:joinLiveRoom` — `window.open('#', '_blank')` placeholder.

### 公告 Announce
- `class:announceCreate` — form → push `cls.announcements`.
- `class:announcePin` — `payload = { id }`. toggle pinned。同 category 同時只能 3 個 pin，超出 toast warn。
- `class:announceRead` — `payload = { id }`. push me.id to reads unless 已讀。
- `class:announceFilter` — `payload = { category }`.
- `class:announceToTask` — `payload = { announcementId }`. 切 `uiScreen: 'taskCreate'`、pre-fill `draftTask` from announcement body。

### 歷史 / 匯出 / 封存
- `class:historyExport` — `payload = { kind }`. CSV 匯出。
- `class:archive` — 確認後 `cls.archived = true`、updateState、`uiScreen: 'archive'`.
- `class:archiveOpen` — `payload = { classId }`. 切 activeClassId、read-only view。
- `class:archiveExport` — 下載整個 class JSON：`Blob([JSON.stringify(cls, null, 2)], {type:'application/json'})`.

### 設定
- `class:settingsSave` — form → 把 cls.* 欄位 overwrite。
- `class:settingsJoinMode` — `payload = { mode }`. `cls.joinMode = mode`.
- `class:settingsCrestUpload` — file picker → resize to 256×256 JPEG base64 → `cls.crest = dataUrl`.
- `class:openAllRanks` — `uiScreen: 'home'`、scroll 到排行區段。

### 其他
- `class:delete` — `payload = { kind, id }`. kind 可為 task / announcement / qa / resource / member。確認後從對應 array remove、updateState、re-render。含 confirm prompt。

---

## 共用工具（自己寫或用既有 helper）

自己補這些（寫在 dispatch 外、IIFE 內，方便每個 case 用）：

```js
function uuid() {
  return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
function nowIso() { return new Date().toISOString(); }
function patchClass(fn) {               // 改當前 class + persist + rerender
  const s = getState();
  const i = s.classes.findIndex(c => c.id === s.activeClassId);
  if (i < 0) return;
  fn(s.classes[i]);
  writeV24(s);
}
function rerender(el) {
  const host = el ? el.closest('.v24c-root') : document.querySelector('.v24c-root');
  if (host) render(host);
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function readFormFields(host, attrKey) {
  // 回傳 { field_name: value }，掃 host 裡的 [data-<attrKey>="xxx"] input / textarea / select
  const out = {};
  host.querySelectorAll('[data-' + attrKey + ']').forEach(el => {
    const k = el.getAttribute('data-' + attrKey);
    out[k] = el.value;
  });
  return out;
}
```

---

## 角色權限（必做）

每個 case 起頭先判斷 role：

```js
const role = getState().uiRole;
const isTeacher = role === 'teacher';
const isCaptain = role === 'captain';
const isStudent = role === 'student';
const isParent  = role === 'parent';
```

- 建立 / 刪除 / 出席 / 評分 / 封存：**只老師**（+ 班長對出席、提醒可有限權限）
- 繳交 / 互評 / 提問 / 加入：學生
- 家長：唯讀 + parent consent
- 違規時 `toast(T('noPerm'))` 並 return

---

## i18n

`T('key')` 找 key，加新字串時**兩個語言都要補**（`STR['zh-TW']` + `STR['en']`）。

最低限度新增 key（Codex 請一併補）：
- `notImpl` → 『尚未實作』/『Not implemented』（已有）
- `saved`, `deleted`, `sent`, `err`, `noPerm`
- `confirm`, `cancel`, `ok`
- 每個 toast 用到的字串

---

## 驗證 checklist（全部要過）

1. `node --check` 對 v24.html 每個 inline `<script>` 區塊都 pass（目前有 5 塊）。
2. HTML tag balance：`<html>/<head>/<body>` 各 1/1/1；`<script>` 8 開 7 閉（第 8 個 open 在 JS string literal 裡）。
3. 開 `YPT++ v24.html` 在瀏覽器：
   - 進「我的班級」頁面 → v24 班級 UI 正常顯示（topbar、role switcher、左側 nav、右側 screen）。
   - 切換 role（teacher/student/captain）→ 左側 nav 項目依角色過濾。
   - 每個按鈕按下去：
     - 預期會改 state 的 → 實際改 state（DevTools 檢查 `localStorage.getItem('ypt_v24_class_v1')`）且頁面 re-render 反映。
     - 匯出類（CSV / ICS / JSON）→ 實際下載檔案。
     - 沒權限的 role → 顯示 `無權限` toast，state 不變。
   - 其他頁面（Focus / Plan / Stats / Groups / Profile / Settings / Learn）**完全不受影響**。
   - Lerna AI 浮動按鈕、v23 群組 sidecar 正常運作。
4. 離開 class 頁 → 回來 → v24c-root 不殘留、不重複掛載。
5. 切語言 zh-TW ↔ en，v24 字串全部跟著變。

---

## 回報格式

修完後用 ≤200 字中文回報：
1. dispatch 實作了幾個 case（多少個還是 toast-only）。
2. 新加 helper function 名字 + 新增 STR key 數量。
3. node --check 結果 + tag balance 結果。
4. 你無法驗證的部分（例如某些 UI 流程需要真正上傳檔案）。
5. 任何你覺得 schema 或 sidecar 架構需要使用者做 trade-off 的決定。
