
/* ============================================================
   YPT++ v24 Class Feature Module
   - Layered on top of YPT++ v23 (does NOT modify React bundle)
   - Takes over the "我的班級 / Classes" page and renders a full
     class-management UI: teacher tools, student learning loop,
     identity, calendar, seats, roles, archive, etc.
   - Reads app state (read-only hints): "ypt_app_state_v6"
   - Stores v24 class additions in:        "ypt_v24_class_v1"
   - Every button carries a data-action="class:<name>" hook.
     The dispatch() function is a STUB — Codex will wire handlers.
   ============================================================ */
(() => {
  'use strict';

  const APP_KEY = 'ypt_app_state_v6';
  const V24_KEY = 'ypt_v24_class_v1';

  // ========== localStorage helpers ==========
  function readV24() { try { return JSON.parse(localStorage.getItem(V24_KEY)) || {}; } catch (e) { return {}; } }
  function writeV24(s) { try { localStorage.setItem(V24_KEY, JSON.stringify(s)); } catch (e) {} }
  function readApp() { try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; } catch (e) { return {}; } }

  // ========== Default mock data ==========
  const DEFAULT_MEMBERS = [
    { id: 'm-teacher', name: '王老師', role: 'teacher', seat: null, weeklyFocus: 0 },
    { id: 'm01', name: '陳 O 妤', role: 'captain', subjectRoles: ['英文科代'], seat: '01', weeklyFocus: 24.5 },
    { id: 'm03', name: '林 O 翰', role: 'student', seat: '03', weeklyFocus: 22.1 },
    { id: 'm07', name: '張 O 安', role: 'student', seat: '07', weeklyFocus: 14.0 },
    { id: 'm12', name: '陳 O 安', role: 'student', seat: '12', weeklyFocus: 20.8 },
    { id: 'm15', name: '王 O 寧', role: 'student', seat: '15', weeklyFocus: 12.5 },
    { id: 'm18', name: '李 O 淇', role: 'student', seat: '18', weeklyFocus: 9.0 },
    { id: 'm21', name: '黃 O 永', role: 'student', seat: '21', weeklyFocus: 6.4 },
    { id: 'm24', name: '吳 O 宣', role: 'student', seat: '24', weeklyFocus: 11.3 },
    { id: 'm27', name: '周 O 昀', role: 'student', seat: '27', weeklyFocus: 8.2 },
    { id: 'm-p1', name: '林爸爸', role: 'parent', childOf: 'm03', seat: null, weeklyFocus: 0 },
  ];

  const DEFAULT_TASKS = [
    { id: 't1', title: '英文 Ch 5 單字默寫', subject: '英文', kind: 'image', points: 10, due: '2026-04-24T22:00', description: '默寫 Ch 5 單字表 40 字', status: 'open', createdBy: 'm-teacher', createdAt: '2026-04-20' },
    { id: 't2', title: '數學 P.120–125 練習', subject: '數學', kind: 'image', points: 15, due: '2026-04-21T22:00', description: '拍照上傳寫完的題目', status: 'open', createdBy: 'm-teacher', createdAt: '2026-04-19' },
    { id: 't3', title: '自然 光學實驗報告', subject: '自然', kind: 'pdf', points: 30, due: '2026-04-26T22:00', description: '繳交實驗 PDF 報告', status: 'open', createdBy: 'm-teacher', createdAt: '2026-04-18' },
    { id: 't4', title: '社會 讀後心得 500 字', subject: '社會', kind: 'text', points: 10, due: '2026-04-27T22:00', description: '讀完指定文本後寫心得 500 字', status: 'open', createdBy: 'm-teacher', createdAt: '2026-04-17' },
    { id: 't5', title: '國文週測', subject: '國文', kind: 'quiz', points: 20, due: '2026-04-24T08:00', description: '班級共同應試', status: 'open', createdBy: 'm-teacher', createdAt: '2026-04-16' },
  ];

  const DEFAULT_ANNOUNCEMENTS = [
    { id: 'a1', title: '週五段考座位表公布', body: '段考採新座位表，詳見附圖。', category: 'exam', pinned: true, due: '2026-04-24', author: 'm-teacher', createdAt: '2026-04-20', reads: [] },
    { id: 'a2', title: '班級共讀時段：週三晚 19:00', body: '本週共讀英文 Ch 5。', category: 'event', pinned: false, author: 'm-teacher', createdAt: '2026-04-19', reads: [] },
  ];

  const DEFAULT_QA = [
    { id: 'q1', title: '數學 P.123 第 5 題的解法卡住', body: '我試著用平方差公式但答案對不到。', author: 'm03', createdAt: '2026-04-21T09:00', replies: [], answered: false, taskId: 't2' },
    { id: 'q2', title: 'Ch 5 第 28 個單字發音怎麼拼？', body: 'analytic 那個怎麼念？', author: 'm01', createdAt: '2026-04-20T14:00', replies: [{ id: 'r1', author: 'm-teacher', body: 'əˈnælɪtɪk', at: '2026-04-20T15:00' }], answered: true, taskId: 't1' },
  ];

  const DEFAULT_CALENDAR = [
    { id: 'e1', title: '英文 Ch 5 默寫截止', kind: 'task', date: '2026-04-24' },
    { id: 'e2', title: '國文週測', kind: 'task', date: '2026-04-24' },
    { id: 'e3', title: '自然實驗繳交', kind: 'task', date: '2026-04-26' },
    { id: 'e4', title: '第二次段考', kind: 'exam', date: '2026-04-27' },
    { id: 'e5', title: '第二次段考', kind: 'exam', date: '2026-04-28' },
    { id: 'e6', title: '第二次段考', kind: 'exam', date: '2026-04-29' },
  ];

  const DEFAULT_RESOURCES = [
    { id: 'r1', title: 'Ch 5 重點整理.pdf', subject: '英文', kind: 'pdf', tier: 'teacher', uploader: 'm-teacher', downloads: 28 },
    { id: 'r2', title: '109 指考英文考古', subject: '英文', kind: 'link', tier: 'captain', uploader: 'm01', downloads: 15 },
    { id: 'r3', title: '數學公式速記', subject: '數學', kind: 'image', tier: 'peer', uploader: 'm03', downloads: 9 },
  ];

  const DEFAULT_CLASS = {
    id: 'class-default',
    name: '高三甲班',
    subtitle: '2026 春季',
    motto: '穩。專注。不比速度，比持續。',
    crest: '🦊',
    color: '#4a7c74',
    code: 'HS3A-2026',
    term: '2026 春季',
    termStart: '2026-02-01',
    termEnd: '2026-06-30',
    joinMode: 'code',
    archived: false,
    teacherId: 'm-teacher',
    members: DEFAULT_MEMBERS,
    tasks: DEFAULT_TASKS,
    announcements: DEFAULT_ANNOUNCEMENTS,
    qa: DEFAULT_QA,
    calendar: DEFAULT_CALENDAR,
    resources: DEFAULT_RESOURCES,
    weeklyGoalHours: 300,
    attendance: {},
    submissions: {},
    reviews: {}
  };

  function getState() {
    const s = readV24();
    s.uiRole = s.uiRole || 'teacher';
    s.uiScreen = s.uiScreen || 'home';
    s.meId = s.meId || 'm03';
    if (!s.classes || !s.classes.length) s.classes = [DEFAULT_CLASS];
    s.activeClassId = s.activeClassId || s.classes[0].id;
    return s;
  }
  function updateState(patch) {
    const s = getState();
    Object.assign(s, patch);
    writeV24(s);
    return s;
  }
  function activeClass() {
    const s = getState();
    return s.classes.find(c => c.id === s.activeClassId) || s.classes[0];
  }

  // ========== i18n ==========
  const STR = {
    'zh-TW': {
      title: '我的班級', brand: 'YPT++', roleTeacher: '老師', roleStudent: '學生', roleCaptain: '班長',
      navCore: '核心 (P0)', navTeacher: '老師 / 管理端', navStudent: '學生 / 學習產出',
      navCommon: '共通', navSettings: '設定 / 流程', newTag: 'new',
      home: '班級首頁', tasks: '作業板', announce: '公告中心', taskCreate: '發派作業',
      submissions: '繳交狀態', grading: '批改介面', attendance: '點名 / 出席', members: '成員 / 角色',
      submit: '繳交作業', history: '我的繳交歷史', peer: '同儕互評', qa: '問答區',
      calendar: '班級行事曆', seats: '座號 / 花名冊', coedit: '共筆協作', resources: '資源中心',
      join: '加入班級', settings: '班級設定', archive: '歷史班級',
      todo: '你今天要做什麼', teacherTodo: '老師今日待辦', captainTodo: '班長任務',
      pendingGrade: '待批改作業', unreadQa: '未讀問題', absentToday: '今日未到',
      nextExam: '下一個考試', pinned: '置頂公告', live: '正在專注的同學',
      weeklyGoal: '本週共同目標', subjects: '科目入口', rankingPreview: '本週排行榜摘要',
      notImpl: '尚未實作', toggleLang: '切換語言', currentClass: '目前班級',
      enterClass: '進入班級', editing: '編輯中',
      saved: '已儲存', deleted: '已刪除', sent: '已送出', err: '錯誤', noPerm: '無權限',
      confirm: '確認', cancel: '取消', ok: '確定', created: '已建立', updated: '已更新',
      reminded: '已提醒', remindedAll: '已提醒所有未交成員', draftSaved: '已存草稿',
      uploaded: '已上傳', imported: '已匯入', exported: '已匯出', archived: '已封存',
      joined: '已加入班級', read: '已標記已讀', pinnedDone: '已置頂', unpinnedDone: '已取消置頂',
      downloaded: '已下載', locked: '已鎖定', unlocked: '已解鎖', opened: '已開啟',
      selected: '已選取', fileTooLarge: '檔案偏大，仍已保留', invalidTitle: '請輸入標題',
      invalidDue: '請輸入有效截止時間', needTask: '找不到任務', needMember: '找不到成員',
      submitLate: '已逾期送出', reviewSaved: '互評已儲存', consentSent: '同意請求已記錄',
    },
    'en': {
      title: 'My Class', brand: 'YPT++', roleTeacher: 'Teacher', roleStudent: 'Student', roleCaptain: 'Captain',
      navCore: 'Core (P0)', navTeacher: 'Teacher / Admin', navStudent: 'Student / Output',
      navCommon: 'Shared', navSettings: 'Settings / Flow', newTag: 'new',
      home: 'Class Home', tasks: 'Task Board', announce: 'Announcements', taskCreate: 'Create Task',
      submissions: 'Submissions', grading: 'Grading', attendance: 'Attendance', members: 'Members & Roles',
      submit: 'Submit', history: 'My History', peer: 'Peer Review', qa: 'Q&A',
      calendar: 'Calendar', seats: 'Seats & Roster', coedit: 'Co-Edit', resources: 'Resources',
      join: 'Join Class', settings: 'Class Settings', archive: 'Archived',
      todo: "Today's to-do", teacherTodo: "Teacher today", captainTodo: 'Captain tasks',
      pendingGrade: 'To grade', unreadQa: 'Unread Q&A', absentToday: 'Absent today',
      nextExam: 'Next exam', pinned: 'Pinned', live: 'Studying now',
      weeklyGoal: 'Weekly goal', subjects: 'Subjects', rankingPreview: 'Ranking preview',
      notImpl: 'not implemented yet', toggleLang: 'Toggle language', currentClass: 'Current class',
      enterClass: 'Enter class', editing: 'editing',
      saved: 'Saved', deleted: 'Deleted', sent: 'Sent', err: 'Error', noPerm: 'No permission',
      confirm: 'Confirm', cancel: 'Cancel', ok: 'OK', created: 'Created', updated: 'Updated',
      reminded: 'Reminded', remindedAll: 'Reminded all missing members', draftSaved: 'Draft saved',
      uploaded: 'Uploaded', imported: 'Imported', exported: 'Exported', archived: 'Archived',
      joined: 'Joined class', read: 'Marked read', pinnedDone: 'Pinned', unpinnedDone: 'Unpinned',
      downloaded: 'Downloaded', locked: 'Locked', unlocked: 'Unlocked', opened: 'Opened',
      selected: 'Selected', fileTooLarge: 'File is large, but was kept', invalidTitle: 'Enter a title',
      invalidDue: 'Enter a valid due time', needTask: 'Task not found', needMember: 'Member not found',
      submitLate: 'Submitted late', reviewSaved: 'Review saved', consentSent: 'Consent request recorded',
    }
  };
  function lang() {
    const a = readApp();
    return (a.settings && a.settings.lang) || 'zh-TW';
  }
  function T(key) { return (STR[lang()] || STR['zh-TW'])[key] || key; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ========== Styles (scoped to .v24c-root) ==========
  const CSS = `
    .v24c-root, .v24c-root * { box-sizing: border-box; }
    .v24c-root {
      --c-bg: #faf9f6; --c-card: #fff; --c-border: #e7e2d6; --c-border2: #c9c0ad;
      --c-ink: #1a1a1a; --c-mut: #8b8580; --c-accent: var(--accent, #4a7c74);
      --c-soft: #d4e7e4; --c-dim: #eef5f3; --c-warn: #c46a38; --c-warnsoft: #f6e4d6;
      --c-bad: #b34a4a; --c-shadow: 0 1px 2px rgba(60,50,30,.04), 0 4px 12px rgba(60,50,30,.05);
      font-family: -apple-system, "Noto Sans TC", "PingFang TC", "Segoe UI", sans-serif;
      color: var(--c-ink); font-size: 14px; line-height: 1.55;
      background: var(--c-bg); margin-top: 8px; border-radius: 10px;
      border: 1px solid var(--c-border);
    }
    .v24c-topbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--c-border); }
    .v24c-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
    .v24c-brand small { color: var(--c-mut); font-weight: 400; margin-left: 4px; font-size: 11px; }
    .v24c-roles { display: flex; gap: 4px; background: #fff; padding: 3px; border-radius: 10px; border: 1px solid var(--c-border); }
    .v24c-roles button { padding: 5px 12px; border: none; background: transparent; cursor: pointer; font: inherit; color: var(--c-mut); border-radius: 7px; font-size: 12px; }
    .v24c-roles button.active { background: var(--c-accent); color: #fff; }
    .v24c-layout { display: grid; grid-template-columns: 200px 1fr; min-height: 500px; }
    .v24c-nav { border-right: 1px solid var(--c-border); padding: 10px 6px; overflow-y: auto; max-height: 75vh; }
    .v24c-nav h4 { margin: 8px 8px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--c-mut); }
    .v24c-nav a { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 5px; color: var(--c-ink); font-size: 12px; cursor: pointer; text-decoration: none; }
    .v24c-nav a.active { background: var(--c-soft); color: var(--c-accent); font-weight: 600; }
    .v24c-nav a:hover:not(.active) { background: #f0ebe0; }
    .v24c-nav .tag { margin-left: auto; font-size: 9px; padding: 1px 5px; border-radius: 7px; background: var(--c-soft); color: var(--c-accent); border: 1px solid #b4d5cf; }
    .v24c-canvas { padding: 16px 20px; overflow-y: auto; max-height: 75vh; }
    .v24c-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px dashed var(--c-border); }
    .v24c-head h1 { font-size: 16px; margin: 0 0 2px; }
    .v24c-head p { margin: 0; color: var(--c-mut); font-size: 11px; }
    .v24c-note { background: #fffbf0; border: 1px solid #ecd9a8; border-left: 3px solid #c88a2a; padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #5a4a1e; margin-bottom: 12px; }
    .v24c-note.new { background: var(--c-dim); border-color: #b4d5cf; border-left-color: var(--c-accent); color: #1e4039; }
    .v24c-note b { color: #3d3410; } .v24c-note.new b { color: #0e2c27; }
    .v24c-card { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 8px; padding: 12px 14px; box-shadow: var(--c-shadow); margin-bottom: 10px; }
    .v24c-card h3 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .v24c-card h3 .pill { font-size: 10px; padding: 2px 7px; border-radius: 9px; font-weight: 500; background: var(--c-soft); color: var(--c-accent); }
    .v24c-card h3 .pill.warn { background: var(--c-warnsoft); color: var(--c-warn); }
    .v24c-grid2 { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .v24c-grid3 { display: grid; gap: 10px; grid-template-columns: 1fr 1fr 1fr; }
    .v24c-grid4 { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); }
    .v24c-two { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; }
    @media (max-width: 900px) { .v24c-two, .v24c-grid2, .v24c-grid3, .v24c-grid4 { grid-template-columns: 1fr; } }
    .v24c-mut { color: var(--c-mut); font-size: 11px; }
    .v24c-div { height: 1px; background: var(--c-border); margin: 8px 0; }
    .v24c-btn { padding: 5px 10px; border-radius: 5px; border: 1px solid var(--c-border); background: #fff; cursor: pointer; font: inherit; font-size: 11px; }
    .v24c-btn.primary { background: var(--c-accent); color: #fff; border-color: var(--c-accent); }
    .v24c-btn.ghost { background: transparent; border-color: transparent; color: var(--c-accent); }
    .v24c-btn.warn { background: #fff; color: var(--c-warn); border-color: var(--c-warnsoft); }
    .v24c-btn.small { padding: 3px 7px; font-size: 10px; }
    .v24c-btn:disabled { opacity: .5; cursor: not-allowed; }
    .v24c-av { width: 24px; height: 24px; border-radius: 50%; background: var(--c-soft); color: var(--c-accent); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex-shrink: 0; }
    .v24c-av.sm { width: 18px; height: 18px; font-size: 9px; }
    .v24c-chip { display: inline-block; font-size: 10px; padding: 2px 7px; border-radius: 7px; border: 1px solid var(--c-border); background: #fff; }
    .v24c-chip.ok { background: #e6f1ef; color: var(--c-accent); border-color: #b4d5cf; }
    .v24c-chip.warn { background: var(--c-warnsoft); color: var(--c-warn); border-color: #e9cfb5; }
    .v24c-chip.bad { background: #f8e1e1; color: var(--c-bad); border-color: #e0b8b8; }
    .v24c-chip.ink { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
    .v24c-bar { height: 6px; background: var(--c-border); border-radius: 4px; overflow: hidden; }
    .v24c-bar > span { display: block; height: 100%; background: var(--c-accent); }
    .v24c-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
    .v24c-tbl th, .v24c-tbl td { padding: 6px 8px; border-bottom: 1px solid var(--c-border); text-align: left; }
    .v24c-tbl th { font-size: 10px; color: var(--c-mut); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
    .v24c-tbl tr:hover { background: #fbf8ef; }
    .v24c-mini { background: #fff; border: 1px solid var(--c-border); border-radius: 6px; padding: 8px 10px; font-size: 11px; }
    .v24c-mini .k { color: var(--c-mut); font-size: 10px; }
    .v24c-mini .v { font-size: 16px; font-weight: 600; margin-top: 2px; }
    .v24c-ph { border: 1px dashed var(--c-border2); border-radius: 5px; padding: 14px; text-align: center; color: var(--c-mut); font-size: 11px; background: repeating-linear-gradient(-45deg, transparent 0 5px, #f3eedf 5px 6px); }
    .v24c-seats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
    .v24c-seat { aspect-ratio: 1; border: 1px solid var(--c-border); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; padding: 3px; background: #fff; cursor: pointer; }
    .v24c-seat .n { font-size: 9px; color: var(--c-mut); }
    .v24c-seat.absent { background: #fdf2ed; border-color: #e6c5b0; }
    .v24c-seat.late { background: var(--c-warnsoft); border-color: #e9cfb5; }
    .v24c-seat.studying { background: var(--c-soft); border-color: #b4d5cf; position: relative; }
    .v24c-seat.studying::after { content: ""; position: absolute; top: 3px; right: 3px; width: 5px; height: 5px; border-radius: 50%; background: var(--c-accent); animation: v24cPulse 1.6s infinite; }
    @keyframes v24cPulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
    .v24c-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; font-size: 10px; }
    .v24c-cal .day { aspect-ratio: 1; background: #fff; border: 1px solid var(--c-border); border-radius: 5px; padding: 3px; position: relative; }
    .v24c-cal .day.task { border-color: var(--c-accent); background: var(--c-soft); }
    .v24c-cal .day.exam { border-color: var(--c-warn); background: var(--c-warnsoft); }
    .v24c-cal .day.today { outline: 2px solid var(--c-accent); }
    .v24c-cal .day .n { font-size: 9px; color: var(--c-mut); }
    .v24c-cal .day .d { font-size: 8px; margin-top: 2px; line-height: 1.1; }
    .v24c-calhd { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; font-size: 9px; color: var(--c-mut); text-transform: uppercase; margin-bottom: 3px; }
    .v24c-calhd div { text-align: center; }
    .v24c-banner { background: linear-gradient(135deg, var(--c-accent) 0%, #6ba19a 100%); color: #fff; border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .v24c-crest { width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.35); display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .v24c-banner h2 { margin: 0 0 2px; font-size: 16px; }
    .v24c-banner p { margin: 0; font-size: 11px; opacity: .85; }
    .v24c-form { margin-bottom: 10px; }
    .v24c-form label { display: block; font-size: 10px; color: var(--c-mut); margin-bottom: 3px; text-transform: uppercase; letter-spacing: .04em; }
    .v24c-form input, .v24c-form textarea, .v24c-form select { width: 100%; padding: 6px 8px; border: 1px solid var(--c-border); border-radius: 5px; font: inherit; font-size: 12px; background: #fff; }
    .v24c-form textarea { min-height: 60px; resize: vertical; }
    .v24c-row { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--c-border); border-radius: 5px; margin-bottom: 6px; }
    .v24c-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a1a1a; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 99999; max-width: 80vw; }
    .v24c-nav a.hide { display: none; }
  `;
  function injectStyle() {
    if (document.getElementById('v24c-style')) return;
    const st = document.createElement('style');
    st.id = 'v24c-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ========== Toast ==========
  function toast(msg) {
    let el = document.getElementById('v24c-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'v24c-toast';
      el.className = 'v24c-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el.__t);
    el.__t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  // ========== Action helpers ==========
  function uuid() {
    return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function nowIso() { return new Date().toISOString(); }
  function todayIso() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function normalizeClass(c) {
    c.members = Array.isArray(c.members) ? c.members : [];
    c.tasks = Array.isArray(c.tasks) ? c.tasks : [];
    c.announcements = Array.isArray(c.announcements) ? c.announcements : [];
    c.qa = Array.isArray(c.qa) ? c.qa : [];
    c.calendar = Array.isArray(c.calendar) ? c.calendar : [];
    c.resources = Array.isArray(c.resources) ? c.resources : [];
    c.attendance = c.attendance && typeof c.attendance === 'object' ? c.attendance : {};
    c.submissions = c.submissions && typeof c.submissions === 'object' ? c.submissions : {};
    c.reviews = c.reviews && typeof c.reviews === 'object' ? c.reviews : {};
    return c;
  }
  function patchClass(fn) {
    const s = getState();
    const i = (s.classes || []).findIndex(c => c.id === s.activeClassId);
    if (i < 0) return null;
    normalizeClass(s.classes[i]);
    fn(s.classes[i], s);
    writeV24(s);
    return s.classes[i];
  }
  function rerender(el) {
    const host = el ? el.closest('.v24c-root') : document.querySelector('.v24c-root');
    if (host) render(host);
  }
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(name, rows) {
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    downloadBlob(name, new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    toast(T('exported'));
  }
  function readFormFields(host, attrKey) {
    const out = {};
    if (!host) return out;
    host.querySelectorAll('[data-' + attrKey + ']').forEach(node => {
      const k = node.getAttribute('data-' + attrKey);
      if (!k) return;
      if (node.type === 'checkbox') out[k] = !!node.checked;
      else if (node.type === 'radio') { if (node.checked) out[k] = node.value || true; }
      else if ('value' in node) out[k] = node.value;
      else out[k] = node.textContent || '';
    });
    return out;
  }
  function getPayload(payload) { return payload && typeof payload === 'object' ? payload : {}; }
  function roleFlags(s) {
    const role = (s || getState()).uiRole || 'teacher';
    return {
      role,
      isTeacher: role === 'teacher',
      isCaptain: role === 'captain',
      isStudent: role === 'student',
      isParent: role === 'parent'
    };
  }
  function deny() { toast(T('noPerm')); return false; }
  function canManageTasks(f) { return f.isTeacher || f.isCaptain; }
  function canManageAttendance(f) { return f.isTeacher || f.isCaptain; }
  function canManageMembers(f) { return f.isTeacher; }
  function canGrade(f) { return f.isTeacher; }
  function canSubmitWork(f) { return f.isStudent || f.isCaptain; }
  function canContribute(f) { return f.isTeacher || f.isCaptain || f.isStudent; }
  function roleActorId(cls, s, f) {
    if (f.isTeacher) return cls.teacherId || s.meId;
    if (f.isCaptain) return (((cls.members || []).find(m => m.role === 'captain') || {}).id) || s.meId;
    if (f.isParent) return (((cls.members || []).find(m => m.role === 'parent') || {}).id) || s.meId;
    return s.meId;
  }
  function currentMember(cls, s) {
    const id = (s || getState()).meId;
    return ((cls && cls.members) || []).find(m => m.id === id) || ((cls && cls.members) || [])[1] || ((cls && cls.members) || [])[0] || null;
  }
  function classMember(cls, id) {
    return ((cls && cls.members) || []).find(m => m.id === id) || null;
  }
  function learners(cls) {
    return ((cls && cls.members) || []).filter(m => m.role === 'student' || m.role === 'captain');
  }
  function findTask(cls, taskId) {
    return ((cls && cls.tasks) || []).find(t => t.id === taskId) || null;
  }
  function activeTaskId(payload, cls) {
    const s = getState();
    const p = getPayload(payload);
    return p.taskId || p.id || (s.gradingCursor && s.gradingCursor.taskId) || s.filterTaskId || s.activeTaskId || (((cls && cls.tasks) || [])[0] || {}).id || '';
  }
  function addReminder(cls, taskId, memberId, by) {
    cls.reminders = Array.isArray(cls.reminders) ? cls.reminders : [];
    cls.reminders.push({ id: uuid(), taskId: taskId || '', memberId: memberId || null, by: by || '', at: nowIso() });
  }
  function ensureSubmission(cls, taskId, memberId) {
    cls.submissions = cls.submissions || {};
    cls.submissions[taskId] = cls.submissions[taskId] || {};
    cls.submissions[taskId][memberId] = cls.submissions[taskId][memberId] || { status: 'draft' };
    return cls.submissions[taskId][memberId];
  }
  function nextGradingCursor(cls, cursor, delta) {
    const ids = learners(cls).map(m => m.id);
    if (!ids.length) return cursor;
    const curId = cursor && cursor.memberId;
    const idx = Math.max(0, ids.indexOf(curId));
    const nextIdx = Math.min(ids.length - 1, Math.max(0, idx + delta));
    return { taskId: (cursor && cursor.taskId) || (((cls.tasks || [])[0] || {}).id || ''), memberId: ids[nextIdx] };
  }
  function scrollToTarget(host, selector) {
    setTimeout(() => {
      const target = host && host.querySelector(selector);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.style.outline = '2px solid var(--c-accent)';
      target.style.outlineOffset = '3px';
      setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1600);
    }, 40);
  }
  function scrollToText(host, text) {
    setTimeout(() => {
      const nodes = Array.from((host || document).querySelectorAll('.v24c-card, .v24c-mini, h3'));
      const target = nodes.find(n => (n.textContent || '').indexOf(text) !== -1);
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.style.outline = '2px solid var(--c-accent)';
        setTimeout(() => { target.style.outline = ''; }, 1600);
      }
    }, 40);
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function compressImageFile(file, maxDim, quality, square) {
    maxDim = maxDim || 1600;
    quality = quality || 0.8;
    return readFileAsDataUrl(file).then(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          let outW = img.width, outH = img.height;
          if (square) {
            const side = Math.min(img.width, img.height);
            sx = Math.round((img.width - side) / 2);
            sy = Math.round((img.height - side) / 2);
            sw = side; sh = side; outW = maxDim; outH = maxDim;
          } else {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            outW = Math.max(1, Math.round(img.width * scale));
            outH = Math.max(1, Math.round(img.height * scale));
          }
          const canvas = document.createElement('canvas');
          canvas.width = outW; canvas.height = outH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) { reject(err); }
      };
      img.onerror = reject;
      img.src = src;
    }));
  }
  function prepareAttachment(file) {
    if (file.type && file.type.indexOf('image/') === 0 && file.size > 2 * 1024 * 1024) {
      return compressImageFile(file, 1600, 0.8, false).then(dataUrl => ({
        name: file.name, kind: file.type || 'image/jpeg', dataUrl
      }));
    }
    if (file.size > 5 * 1024 * 1024) toast(T('fileTooLarge'));
    return readFileAsDataUrl(file).then(dataUrl => ({
      name: file.name, kind: file.type || (file.name.split('.').pop() || 'file'), dataUrl
    }));
  }
  function pickFile(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (file) cb(file);
      setTimeout(() => input.remove(), 0);
    };
    document.body.appendChild(input);
    input.click();
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim()));
  }
  function csvObjects(text) {
    const rows = parseCsv(text);
    const head = (rows.shift() || []).map(h => String(h).trim());
    return rows.map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = r[i] || ''; });
      return o;
    });
  }
  function icsEscape(v) {
    return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function downloadClassIcs(cls) {
    const events = (cls.calendar || []).concat((cls.tasks || []).map(t => ({
      id: 'due-' + t.id, title: t.title, kind: 'task', date: String(t.due || '').slice(0, 10)
    }))).filter(e => e.date);
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YPT++//Class v24//EN'];
    events.forEach(e => {
      body.push('BEGIN:VEVENT');
      body.push('UID:' + icsEscape((e.id || uuid()) + '@ypt-class'));
      body.push('DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'));
      body.push('DTSTART;VALUE=DATE:' + String(e.date).replace(/-/g, ''));
      body.push('SUMMARY:' + icsEscape(e.title || e.kind || 'Class event'));
      body.push('CATEGORIES:' + icsEscape(e.kind || 'event'));
      body.push('END:VEVENT');
    });
    body.push('END:VCALENDAR');
    downloadBlob('class-' + (cls.code || 'calendar') + '.ics', new Blob([body.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    toast(T('exported'));
  }

  // ========== Dispatcher ==========
  function dispatch(action, payload, el) {
    try { console.log('[v24 class] dispatch', action, payload); } catch (e) {}
    const host = el && el.closest('.v24c-root');
    const state = getState();
    const cls = normalizeClass(activeClass());
    const flags = roleFlags(state);
    const p = getPayload(payload);
    const actorId = roleActorId(cls, state, flags);
    const meRec = classMember(cls, actorId) || currentMember(cls, state);

    switch (action) {
      case 'class:goto': {
        if (p.screen) {
          const patch = { uiScreen: p.screen };
          if (p.taskId) patch.activeTaskId = p.taskId;
          if (p.screen === 'taskCreate') patch.draftTask = null;
          updateState(patch);
          if (host) render(host);
        }
        break;
      }
      case 'class:openMyCard': {
        updateState({ uiScreen: 'home', highlightMyCard: true });
        if (host) render(host);
        scrollToText(host, '排行榜');
        break;
      }
      case 'class:openTask': {
        const screen = flags.isTeacher ? 'submissions' : 'submit';
        updateState({ uiScreen: screen, activeTaskId: p.taskId || p.id || '', filterTaskId: p.taskId || p.id || '' });
        if (host) render(host);
        break;
      }
      case 'class:taskCreate': {
        if (!canManageTasks(flags)) return deny();
        updateState({ uiScreen: 'taskCreate', draftTask: null });
        if (host) render(host);
        break;
      }
      case 'class:taskKind': {
        if (!canManageTasks(flags)) return deny();
        const fields = readFormFields(host, 'field');
        updateState({ draftTask: Object.assign({}, state.draftTask || {}, fields, { kind: p.kind || 'image' }) });
        rerender(el);
        break;
      }
      case 'class:taskSave': {
        if (!canManageTasks(flags)) return deny();
        const fields = Object.assign({}, state.draftTask || {}, readFormFields(host, 'field'));
        const title = String(fields.title || '').trim();
        const due = String(fields.due || '').trim();
        if (!title) { toast(T('err') + ': ' + T('invalidTitle')); break; }
        if (!due || isNaN(new Date(due).getTime())) { toast(T('err') + ': ' + T('invalidDue')); break; }
        patchClass((c, s) => {
          const task = {
            id: uuid(),
            title,
            subject: fields.subject || '其他',
            kind: fields.kind || 'image',
            points: Number(fields.points) || 0,
            due,
            description: fields.description || '',
            status: 'open',
            createdBy: (meRec && meRec.id) || s.meId,
            createdAt: nowIso(),
            options: {
              allowLate: fields.allowLate !== false,
              allowResubmit: !!fields.allowResubmit,
              showAfterDue: fields.showAfterDue !== false,
              peerReview: !!fields.peerReview,
              toExam: !!fields.toExam
            }
          };
          c.tasks.push(task);
          c.calendar.push({ id: 'cal-' + task.id, title: task.title, kind: fields.toExam ? 'exam' : 'task', date: due.slice(0, 10) });
          s.uiScreen = 'tasks';
          s.draftTask = null;
          s.activeTaskId = task.id;
        });
        toast(T('created'));
        rerender(el);
        break;
      }
      case 'class:remind': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        const memberId = p.memberId || null;
        patchClass(c => addReminder(c, p.taskId || activeTaskId(p, c), memberId, actorId));
        const m = memberId ? classMember(cls, memberId) : null;
        toast(T('reminded') + (m ? ' ' + m.name : ''));
        rerender(el);
        break;
      }
      case 'class:remindAll': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        const taskId = activeTaskId(p, cls);
        let count = 0;
        patchClass(c => {
          learners(c).forEach(m => {
            const sub = c.submissions && c.submissions[taskId] && c.submissions[taskId][m.id];
            if (!sub || (sub.status !== 'submitted' && sub.status !== 'graded')) {
              addReminder(c, taskId, m.id, actorId);
              count++;
            }
          });
        });
        toast(T('remindedAll') + ' (' + count + ')');
        rerender(el);
        break;
      }
      case 'class:submissionsFor': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        updateState({ uiScreen: 'submissions', filterTaskId: p.taskId || p.id || '' });
        if (host) render(host);
        break;
      }
      case 'class:submissionsFilter': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        updateState({ submissionsFilter: p.filter || p.f || 'all' });
        rerender(el);
        break;
      }
      case 'class:viewGrade': {
        const taskId = activeTaskId(p, cls);
        const memberId = p.memberId || (p.submissionId === 's2' ? 'm15' : 'm12');
        if (flags.isTeacher) updateState({ uiScreen: 'grading', gradingCursor: { taskId, memberId } });
        else updateState({ uiScreen: 'history', historyFilter: { taskId, memberId: actorId, kind: 'grade' } });
        if (host) render(host);
        break;
      }
      case 'class:exportCsv': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        const taskId = activeTaskId(p, cls);
        const rows = [['memberId', 'name', 'status', 'submitAt', 'score', 'snippet']];
        learners(cls).forEach(m => {
          const sub = cls.submissions && cls.submissions[taskId] && cls.submissions[taskId][m.id];
          rows.push([m.id, m.name, (sub && sub.status) || 'missing', (sub && sub.at) || '', (sub && sub.grade && sub.grade.score) || '', (sub && sub.grade && sub.grade.snippet) || '']);
        });
        downloadCsv('submissions-' + (taskId || 'task') + '.csv', rows);
        break;
      }
      case 'class:gradePrev':
      case 'class:gradeNext': {
        if (!canGrade(flags)) return deny();
        patchClass((c, s) => {
          const cursor = s.gradingCursor || { taskId: activeTaskId(p, c), memberId: (learners(c)[0] || {}).id || '' };
          s.gradingCursor = nextGradingCursor(c, cursor, action === 'class:gradeNext' ? 1 : -1);
          s.uiScreen = 'grading';
        });
        rerender(el);
        break;
      }
      case 'class:gradeSubmit': {
        if (!canGrade(flags)) return deny();
        const fields = readFormFields(host, 'field');
        const cur = state.gradingCursor || {};
        const taskId = p.taskId || cur.taskId || activeTaskId(p, cls);
        const memberId = p.memberId || cur.memberId || (learners(cls)[0] || {}).id;
        if (!taskId) { toast(T('err') + ': ' + T('needTask')); break; }
        if (!memberId) { toast(T('err') + ': ' + T('needMember')); break; }
        patchClass((c, s) => {
          const sub = ensureSubmission(c, taskId, memberId);
          sub.status = 'graded';
          sub.grade = {
            score: Number(p.score != null ? p.score : fields.score) || 0,
            snippet: p.snippet || fields.comment || '',
            by: actorId,
            at: nowIso()
          };
          s.gradingCursor = nextGradingCursor(c, { taskId, memberId }, 1);
          s.uiScreen = 'grading';
        });
        toast(T('saved'));
        rerender(el);
        break;
      }
      case 'class:gradeSnippet': {
        if (!canGrade(flags)) return deny();
        const txt = p.text || ((state.snippets || []).find(s => s.id === p.snippetId) || {}).text || '';
        const box = host && host.querySelector('[data-field="comment"]');
        if (box && txt) box.value = (box.value ? box.value + ' ' : '') + txt;
        break;
      }
      case 'class:gradeSnippetManage': {
        if (!canGrade(flags)) return deny();
        updateState({ uiScreen: 'settings' });
        if (host) render(host);
        scrollToTarget(host, '#snippet-editor');
        break;
      }
      case 'class:submitDraft':
      case 'class:submitSend': {
        if (!canSubmitWork(flags)) return deny();
        const taskId = activeTaskId(p, cls);
        const task = findTask(cls, taskId);
        if (!task) { toast(T('err') + ': ' + T('needTask')); break; }
        const fields = readFormFields(host, 'field');
        const draft = (state.draftSub && state.draftSub[taskId]) || {};
        const late = new Date(task.due) < new Date();
        patchClass((c, s) => {
          const sub = ensureSubmission(c, taskId, actorId);
          sub.status = action === 'class:submitSend' ? 'submitted' : 'draft';
          sub.text = p.text || fields.submitNote || draft.text || '';
          sub.attachments = p.attachments || draft.attachments || sub.attachments || [];
          sub.at = nowIso();
          if (action === 'class:submitSend' && late) sub.late = true;
          s.activeTaskId = taskId;
        });
        toast(action === 'class:submitSend' ? (late ? T('submitLate') : T('sent')) : T('draftSaved'));
        rerender(el);
        break;
      }
      case 'class:submitUpload': {
        if (!canSubmitWork(flags)) return deny();
        const taskId = activeTaskId(p, cls);
        pickFile('image/*,.pdf,.doc,.docx,.txt', file => {
          prepareAttachment(file).then(att => {
            const s = getState();
            s.draftSub = s.draftSub || {};
            s.draftSub[taskId] = s.draftSub[taskId] || { attachments: [] };
            s.draftSub[taskId].attachments = s.draftSub[taskId].attachments || [];
            s.draftSub[taskId].attachments.push(att);
            writeV24(s);
            toast(T('uploaded'));
            rerender(el);
          }).catch(() => toast(T('err')));
        });
        break;
      }
      case 'class:attendanceToggle': {
        if (!canManageAttendance(flags)) return deny();
        const date = p.date || todayIso();
        const memberId = p.memberId || actorId;
        const order = ['present', 'late', 'absent', 'leave'];
        patchClass(c => {
          c.attendance[date] = c.attendance[date] || {};
          if (c.attendance[date].locked) return;
          const cur = c.attendance[date][memberId];
          c.attendance[date][memberId] = p.to || order[(Math.max(-1, order.indexOf(cur)) + 1) % order.length];
        });
        toast(T('saved'));
        rerender(el);
        break;
      }
      case 'class:attendanceSave': {
        if (!canManageAttendance(flags)) return deny();
        toast(T('saved'));
        break;
      }
      case 'class:attendanceSubmit': {
        if (!canManageAttendance(flags)) return deny();
        patchClass(c => {
          const date = p.date || todayIso();
          c.attendance[date] = c.attendance[date] || {};
          c.attendance[date].locked = true;
        });
        toast(T('sent'));
        rerender(el);
        break;
      }
      case 'class:attendanceView': {
        if (p.memberId) updateState({ uiScreen: 'history', historyFilter: { memberId: p.memberId, kind: 'attendance' } });
        else updateState({ attendanceView: p.view || 'seat' });
        if (host) render(host);
        break;
      }
      case 'class:attendanceExport': {
        if (!canManageAttendance(flags)) return deny();
        const rows = [['date', 'member', 'status']];
        Object.keys(cls.attendance || {}).sort().forEach(date => {
          Object.keys(cls.attendance[date] || {}).forEach(mid => {
            if (mid === 'locked') return;
            const m = classMember(cls, mid);
            rows.push([date, (m && m.name) || mid, cls.attendance[date][mid]]);
          });
        });
        downloadCsv('attendance-' + (cls.code || 'class') + '.csv', rows);
        break;
      }
      case 'class:rosterTemplate': {
        downloadCsv('roster-template.csv', [['name', 'seat', 'role'], ['王小明', '01', 'student']]);
        break;
      }
      case 'class:memberInvite': {
        if (!canManageMembers(flags)) return deny();
        const val = prompt('email / name / code');
        if (!val) break;
        patchClass(c => {
          c.members.push({ id: uuid(), name: val.indexOf('@') === -1 ? val : val.split('@')[0], email: val.indexOf('@') > -1 ? val : '', role: 'student', seat: null, weeklyFocus: 0 });
        });
        toast(T('created'));
        rerender(el);
        break;
      }
      case 'class:memberEdit': {
        if (!canManageMembers(flags)) return deny();
        const memberId = p.memberId || p.id;
        const m = classMember(cls, memberId);
        if (!m) { toast(T('err') + ': ' + T('needMember')); break; }
        const name = prompt('name', m.name);
        if (name == null) break;
        const role = prompt('role', m.role) || m.role;
        const seat = prompt('seat', m.seat || '') || '';
        const subjectRoles = prompt('subjectRoles CSV', (m.subjectRoles || []).join(',')) || '';
        patchClass((c, s) => {
          const rec = classMember(c, memberId);
          if (rec) {
            rec.name = name.trim() || rec.name;
            rec.role = role;
            rec.seat = seat || null;
            rec.subjectRoles = subjectRoles ? subjectRoles.split(',').map(x => x.trim()).filter(Boolean) : [];
          }
          s.editingMemberId = memberId;
          s.uiScreen = 'members';
        });
        toast(T('updated'));
        rerender(el);
        break;
      }
      case 'class:memberImportCsv': {
        if (!canManageMembers(flags)) return deny();
        pickFile('.csv,text/csv', file => {
          file.text().then(text => {
            const records = csvObjects(text);
            patchClass(c => {
              records.forEach(r => {
                const name = (r.name || r.Name || r['姓名'] || '').trim();
                if (!name) return;
                const seat = (r.seat || r.Seat || r['座號'] || '').trim();
                const role = (r.role || r.Role || r['角色'] || 'student').trim() || 'student';
                const existing = c.members.find(m => (seat && m.seat === seat) || m.name === name);
                if (existing) { existing.name = name; existing.seat = seat || existing.seat || null; existing.role = role; }
                else c.members.push({ id: uuid(), name, seat: seat || null, role, weeklyFocus: 0 });
              });
            });
            toast(T('imported'));
            rerender(el);
          }).catch(() => toast(T('err')));
        });
        break;
      }
      case 'class:peerRead':
      case 'class:peerWrite': {
        if (!canSubmitWork(flags)) return deny();
        const taskId = p.taskId || state.activeTaskId || (((cls.tasks || [])[0] || {}).id || '');
        const revieweeId = p.revieweeId || p.targetId || '';
        if (action === 'class:peerWrite') {
          const score = Number(prompt('score 1-5', '4') || 0);
          const comment = prompt('comment', '') || '';
          patchClass((c, s) => {
            c.reviews[taskId] = c.reviews[taskId] || {};
            c.reviews[taskId][actorId] = c.reviews[taskId][actorId] || {};
            c.reviews[taskId][actorId][revieweeId] = { score, comment, at: nowIso() };
            s.peerCursor = { taskId, revieweeId, mode: 'write' };
            s.uiScreen = 'peer';
          });
          toast(T('reviewSaved'));
        } else {
          updateState({ uiScreen: 'peer', peerCursor: { taskId, revieweeId, mode: 'read' } });
        }
        rerender(el);
        break;
      }
      case 'class:qaNew': {
        if (!(flags.isStudent || flags.isCaptain)) return deny();
        const title = prompt('title');
        if (!title) break;
        const body = prompt('body') || '';
        patchClass(c => {
          c.qa.push({ id: uuid(), title, body, author: actorId, createdAt: nowIso(), replies: [], answered: false, taskId: p.taskId || state.activeTaskId || undefined });
        });
        toast(T('created'));
        rerender(el);
        break;
      }
      case 'class:qaOpen': {
        const qaId = p.qaId || p.qid || p.id;
        updateState({ uiScreen: 'qa', activeQaId: qaId });
        if (host) render(host);
        const q = (cls.qa || []).find(item => item.id === qaId);
        if (q) alert(q.title + '\n\n' + q.body + '\n\n' + (q.replies || []).map(r => '- ' + r.body).join('\n'));
        break;
      }
      case 'class:qaFilter': {
        updateState({ qaFilter: p.filter || 'all' });
        rerender(el);
        break;
      }
      case 'class:calPrev':
      case 'class:calNext': {
        const cur = state.calCursor || '2026-04';
        const d = new Date(cur + '-01T00:00:00');
        d.setMonth(d.getMonth() + (action === 'class:calNext' ? 1 : -1));
        updateState({ calCursor: d.toISOString().slice(0, 7) });
        rerender(el);
        break;
      }
      case 'class:calOpenDay': {
        const date = p.date || todayIso();
        const evs = (cls.calendar || []).filter(e => e.date === date).concat((cls.tasks || []).filter(t => String(t.due || '').slice(0, 10) === date).map(t => ({ title: t.title, kind: 'task' })));
        alert(date + '\n' + (evs.length ? evs.map(e => '- ' + e.title + ' (' + e.kind + ')').join('\n') : 'No events'));
        break;
      }
      case 'class:calExport': {
        const rows = [['date', 'title', 'kind']];
        (cls.calendar || []).forEach(e => rows.push([e.date, e.title, e.kind]));
        (cls.tasks || []).forEach(t => rows.push([String(t.due || '').slice(0, 10), t.title, 'task']));
        downloadCsv('class-calendar.csv', rows);
        break;
      }
      case 'class:calExportIcs': {
        downloadClassIcs(cls);
        break;
      }
      case 'class:calSubscribeGoogle': {
        window.open('https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent('webcal://ypt.local/class/' + (cls.code || cls.id || 'calendar') + '.ics'), '_blank');
        break;
      }
      case 'class:seatSelect': {
        if (flags.isParent) return deny();
        const target = p.memberId ? classMember(cls, p.memberId) : null;
        const seat = p.row && p.col ? String((Number(p.row) - 1) * 6 + Number(p.col)).padStart(2, '0') : (target && target.seat);
        if (!seat) break;
        const occupant = (cls.members || []).find(m => m.seat === seat && m.id !== actorId);
        if (occupant) { toast(T('err') + ': ' + occupant.name); break; }
        patchClass(c => {
          const rec = classMember(c, actorId);
          if (rec) rec.seat = seat;
        });
        toast(T('selected'));
        rerender(el);
        break;
      }
      case 'class:seatEdit': {
        if (!flags.isTeacher) return deny();
        updateState({ seatEditMode: true });
        toast(T('editing'));
        rerender(el);
        break;
      }
      case 'class:seatReshuffle': {
        if (!flags.isTeacher) return deny();
        if (!confirm(T('confirm') + '?')) break;
        patchClass(c => {
          const people = learners(c);
          const seats = people.map(m => m.seat || '').filter(Boolean);
          for (let i = seats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = seats[i]; seats[i] = seats[j]; seats[j] = tmp;
          }
          people.forEach((m, i) => { m.seat = seats[i] || String(i + 1).padStart(2, '0'); });
        });
        toast(T('updated'));
        rerender(el);
        break;
      }
      case 'class:coeditSave': {
        if (!canContribute(flags)) return deny();
        const docId = p.docId || 'default';
        const contentNode = host && (host.querySelector('[data-field="coeditContent"]') || host.querySelector('.v24c-ph'));
        patchClass(c => {
          c.coedit = c.coedit || {};
          const doc = c.coedit[docId] || { history: [] };
          doc.content = p.content || (contentNode && contentNode.textContent) || '';
          doc.history = doc.history || [];
          doc.history.push({ at: nowIso(), by: actorId, content: doc.content });
          c.coedit[docId] = doc;
        });
        toast(T('saved'));
        break;
      }
      case 'class:coeditLock': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        const docId = p.docId || 'default';
        let locked = false;
        patchClass(c => {
          c.coedit = c.coedit || {};
          c.coedit[docId] = c.coedit[docId] || { history: [] };
          c.coedit[docId].locked = !c.coedit[docId].locked;
          locked = c.coedit[docId].locked;
        });
        toast(locked ? T('locked') : T('unlocked'));
        rerender(el);
        break;
      }
      case 'class:coeditHistory': {
        updateState({ uiScreen: 'history', historyFilter: { kind: 'coedit', docId: p.docId || 'default' } });
        if (host) render(host);
        break;
      }
      case 'class:resourceUpload': {
        if (!canContribute(flags)) return deny();
        pickFile('', file => {
          prepareAttachment(file).then(att => {
            patchClass(c => {
              c.resources.push({
                id: uuid(), title: file.name, subject: p.subject || '其他',
                kind: file.type && file.type.indexOf('image/') === 0 ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'doc',
                tier: flags.isTeacher ? 'teacher' : flags.isCaptain ? 'captain' : 'peer',
                uploader: actorId, downloads: 0, dataUrl: att.dataUrl
              });
            });
            toast(T('uploaded'));
            rerender(el);
          }).catch(() => toast(T('err')));
        });
        break;
      }
      case 'class:resourceDownload': {
        const resId = p.resId || p.id;
        let res = null;
        patchClass(c => {
          res = (c.resources || []).find(r => r.id === resId);
          if (res) res.downloads = (Number(res.downloads) || 0) + 1;
        });
        if (res && res.dataUrl) {
          const a = document.createElement('a');
          a.href = res.dataUrl; a.download = res.title || 'resource'; a.click();
        } else if (res && res.url) {
          window.open(res.url, '_blank');
        } else if (res) {
          downloadBlob((res.title || 'resource') + '.txt', new Blob([res.title || 'resource'], { type: 'text/plain;charset=utf-8' }));
        }
        toast(T('downloaded'));
        rerender(el);
        break;
      }
      case 'class:resourceFilter': {
        updateState({ resFilter: { subject: p.subject || '', kind: p.kind || '', tier: p.tier || '' } });
        rerender(el);
        break;
      }
      case 'class:joinByCode':
      case 'class:joinScanQr': {
        if (!(flags.isStudent || flags.isCaptain)) return deny();
        const code = action === 'class:joinScanQr' ? prompt('QR code') : ((host && host.querySelector('[data-field="joinCode"]') || {}).value || prompt('class code') || '');
        if (!code) break;
        patchClass(c => {
          c.pendingJoins = c.pendingJoins || [];
          if (!classMember(c, actorId) && meRec) c.members.push(Object.assign({}, meRec, { role: 'student' }));
          c.pendingJoins.push({ id: uuid(), code, memberId: actorId, at: nowIso(), status: c.joinMode === 'review' ? 'pending' : 'approved' });
        });
        toast(T('joined'));
        rerender(el);
        break;
      }
      case 'class:joinParentConsent': {
        const email = ((host && host.querySelector('[data-field="parentEmail"]') || {}).value || prompt('parent email') || '').trim();
        patchClass(c => {
          c.parentConsents = c.parentConsents || {};
          c.parentConsents[actorId] = { email, at: nowIso() };
        });
        toast(T('consentSent'));
        break;
      }
      case 'class:joinLiveRoom': {
        window.open('#class-live-room', '_blank');
        break;
      }
      case 'class:announceCreate': {
        if (!(flags.isTeacher || flags.isCaptain)) return deny();
        const title = prompt('title');
        if (!title) break;
        const body = prompt('body') || '';
        const category = prompt('category', 'study') || 'study';
        patchClass(c => {
          c.announcements.push({ id: uuid(), title, body, category, pinned: false, author: actorId, createdAt: nowIso(), reads: [] });
        });
        toast(T('created'));
        rerender(el);
        break;
      }
      case 'class:announcePin': {
        if (!flags.isTeacher) return deny();
        const id = p.announcementId || p.id;
        patchClass(c => {
          const ann = (c.announcements || []).find(a => a.id === id);
          if (!ann) return;
          if (!ann.pinned) {
            const same = c.announcements.filter(a => a.category === ann.category && a.pinned);
            if (same.length >= 3) { toast(T('err') + ': pinned max 3'); return; }
          }
          ann.pinned = !ann.pinned;
          toast(ann.pinned ? T('pinnedDone') : T('unpinnedDone'));
        });
        rerender(el);
        break;
      }
      case 'class:announceRead': {
        if (flags.isParent) return deny();
        const id = p.announcementId || p.id;
        patchClass(c => {
          const ann = (c.announcements || []).find(a => a.id === id);
          if (ann) {
            ann.reads = ann.reads || [];
            if (ann.reads.indexOf(actorId) === -1) ann.reads.push(actorId);
          }
        });
        toast(T('read'));
        rerender(el);
        break;
      }
      case 'class:announceFilter': {
        updateState({ announceFilter: p.category || p.f || 'all' });
        rerender(el);
        break;
      }
      case 'class:announceToTask': {
        if (!canManageTasks(flags)) return deny();
        const id = p.announcementId || p.id;
        const ann = (cls.announcements || []).find(a => a.id === id);
        updateState({ uiScreen: 'taskCreate', draftTask: ann ? { title: ann.title, description: ann.body, subject: '其他', kind: 'text', due: (ann.due || todayIso()) + 'T22:00', points: 10 } : null });
        if (host) render(host);
        break;
      }
      case 'class:historyExport': {
        const rows = [['kind', 'date', 'memberId', 'taskId', 'status', 'score', 'note']];
        Object.keys(cls.submissions || {}).forEach(taskId => {
          Object.keys(cls.submissions[taskId] || {}).forEach(memberId => {
            const sub = cls.submissions[taskId][memberId];
            if (!flags.isTeacher && memberId !== actorId) return;
            rows.push(['submission', sub.at || '', memberId, taskId, sub.status || '', (sub.grade && sub.grade.score) || '', (sub.grade && sub.grade.snippet) || sub.text || '']);
          });
        });
        downloadCsv('class-history.csv', rows);
        break;
      }
      case 'class:archive': {
        if (!flags.isTeacher) return deny();
        if (!confirm(T('confirm') + '?')) break;
        patchClass((c, s) => { c.archived = true; s.uiScreen = 'archive'; });
        toast(T('archived'));
        rerender(el);
        break;
      }
      case 'class:archiveOpen': {
        const id = p.classId || p.id;
        const target = (state.classes || []).find(c => c.id === id);
        if (target) updateState({ activeClassId: id, uiScreen: 'archive', archiveReadOnly: true });
        else updateState({ uiScreen: 'archive', archiveClassId: id, archiveReadOnly: true });
        if (host) render(host);
        break;
      }
      case 'class:archiveExport': {
        if (!flags.isTeacher) return deny();
        const id = p.classId || p.id;
        const target = (state.classes || []).find(c => c.id === id) || cls;
        downloadBlob('class-' + (target.code || target.id || 'archive') + '.json', new Blob([JSON.stringify(target, null, 2)], { type: 'application/json;charset=utf-8' }));
        toast(T('exported'));
        break;
      }
      case 'class:settingsSave': {
        if (!flags.isTeacher) return deny();
        const fields = readFormFields(host, 'field');
        patchClass(c => {
          if (fields.name) c.name = fields.name;
          if (fields.motto) c.motto = fields.motto;
          if (fields.color) c.color = fields.color;
          if (fields.term) c.term = fields.term;
          if (fields.termRange && fields.termRange.indexOf('→') !== -1) {
            const parts = fields.termRange.split('→').map(x => x.trim());
            c.termStart = parts[0] || c.termStart;
            c.termEnd = parts[1] || c.termEnd;
          }
        });
        toast(T('saved'));
        rerender(el);
        break;
      }
      case 'class:settingsJoinMode': {
        if (!flags.isTeacher) return deny();
        patchClass(c => { c.joinMode = p.mode || 'code'; });
        toast(T('saved'));
        rerender(el);
        break;
      }
      case 'class:settingsCrestUpload': {
        if (!flags.isTeacher) return deny();
        pickFile('image/*', file => {
          compressImageFile(file, 256, 0.82, true).then(dataUrl => {
            patchClass(c => { c.crest = dataUrl; });
            toast(T('uploaded'));
            rerender(el);
          }).catch(() => toast(T('err')));
        });
        break;
      }
      case 'class:openAllRanks': {
        updateState({ uiScreen: 'home', showAllRanks: true });
        if (host) render(host);
        scrollToText(host, '排行榜');
        break;
      }
      case 'class:delete': {
        if (!flags.isTeacher) return deny();
        let kind = p.kind, id = p.id;
        if (!kind || !id) {
          const raw = prompt('kind:id');
          if (!raw) break;
          const parts = raw.split(':');
          kind = parts[0]; id = parts.slice(1).join(':');
        }
        if (!confirm(T('confirm') + ' delete ' + kind + ' ' + id + '?')) break;
        const map = { task: 'tasks', announcement: 'announcements', qa: 'qa', resource: 'resources', member: 'members' };
        const key = map[kind];
        if (!key) break;
        patchClass(c => { c[key] = (c[key] || []).filter(item => item.id !== id); });
        toast(T('deleted'));
        rerender(el);
        break;
      }
      default:
        toast('[' + action + '] ' + T('notImpl'));
    }
  }

  // ========== Helpers for rendering ==========
  function member(id) { return (activeClass().members || []).find(m => m.id === id) || null; }
  function me() { return member(getState().meId) || activeClass().members[1]; }
  function roleOf(id) { const m = member(id); return m ? m.role : 'student'; }
  function relDate(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = (d - now) / (1000 * 60 * 60);
      if (diff < 0 && diff > -24) return '逾期 ' + Math.abs(Math.round(diff)) + ' 小時';
      if (diff < 0) return '逾期 ' + Math.abs(Math.round(diff / 24)) + ' 天';
      if (diff < 24) return '剩 ' + Math.round(diff) + ' 小時';
      return '剩 ' + Math.round(diff / 24) + ' 天';
    } catch (e) { return iso; }
  }

  // ========== Screen templates ==========
  const SCREENS = {};

  SCREENS.home = (role, cls) => {
    const meRec = me();
    const bannerHtml =
      '<div class="v24c-banner">' +
        '<div class="v24c-crest">' + esc(cls.crest) + '</div>' +
        '<div>' +
          '<h2>' + esc(cls.name) + ' · ' + esc(cls.subtitle) + '</h2>' +
          '<p>班訓：' + esc(cls.motto) + ' · ' + (cls.members || []).length + ' 成員</p>' +
        '</div>' +
        '<div style="margin-left:auto;text-align:right;">' +
          '<span class="v24c-chip ok">學期進行中 · 第 8 週</span>' +
        '</div>' +
      '</div>';

    let roleStrip = '';
    if (role === 'teacher') {
      roleStrip =
        '<div class="v24c-card">' +
          '<h3>🧑‍🏫 ' + esc(T('teacherTodo')) + ' <span class="pill warn">需要你</span></h3>' +
          '<div class="v24c-grid3">' +
            '<div class="v24c-mini"><div class="k">' + esc(T('pendingGrade')) + '</div><div class="v">12</div><div class="v24c-mut">英文週考</div></div>' +
            '<div class="v24c-mini"><div class="k">' + esc(T('unreadQa')) + '</div><div class="v">3</div><div class="v24c-mut">數學題本 Q42</div></div>' +
            '<div class="v24c-mini"><div class="k">' + esc(T('absentToday')) + '</div><div class="v">2</div><div class="v24c-mut">陳 O 妤、林 O 翰</div></div>' +
          '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;">' +
            '<button type="button" class="v24c-btn primary" data-action="class:goto" data-payload=\'{"screen":"grading"}\'>進入批改 →</button>' +
            '<button type="button" class="v24c-btn" data-action="class:goto" data-payload=\'{"screen":"attendance"}\'>今日點名</button>' +
            '<button type="button" class="v24c-btn" data-action="class:goto" data-payload=\'{"screen":"announce"}\'>發公告</button>' +
          '</div>' +
        '</div>';
    } else if (role === 'student') {
      roleStrip =
        '<div class="v24c-card">' +
          '<h3>👨‍🎓 ' + esc(T('todo')) + ' <span class="pill">3 件</span></h3>' +
          '<div>' +
            '<div class="v24c-row"><span class="v24c-chip bad">逾期 1 天</span><span style="flex:1;">英文 Ch 5 單字默寫繳交</span><button type="button" class="v24c-btn primary small" data-action="class:goto" data-payload=\'{"screen":"submit","taskId":"t1"}\'>現在繳交</button></div>' +
            '<div class="v24c-row"><span class="v24c-chip warn">今日截止</span><span style="flex:1;">數學練習題 P.120–125</span><button type="button" class="v24c-btn small" data-action="class:openTask" data-payload=\'{"taskId":"t2"}\'>打開</button></div>' +
            '<div class="v24c-row"><span class="v24c-chip">明天 08:00</span><span style="flex:1;">國文週測</span><button type="button" class="v24c-btn small" data-action="class:calExport" data-payload=\'{"taskId":"t5"}\'>加行事曆</button></div>' +
          '</div>' +
        '</div>';
    } else if (role === 'captain') {
      roleStrip =
        '<div class="v24c-card">' +
          '<h3>🎖 ' + esc(T('captainTodo')) + ' <span class="pill">本週</span></h3>' +
          '<div class="v24c-mut">班長可代替老師做：點名、催繳、整理問題、發非正式公告。</div>' +
          '<div style="display:flex;gap:6px;margin-top:8px;">' +
            '<button type="button" class="v24c-btn primary" data-action="class:attendanceSubmit">提交今日出席</button>' +
            '<button type="button" class="v24c-btn" data-action="class:goto" data-payload=\'{"screen":"qa"}\'>匯整本週提問</button>' +
          '</div>' +
        '</div>';
    }

    return (
      '<div class="v24c-head"><div><h1>' + esc(T('home')) + '</h1><p>' + esc(cls.name) + '</p></div><div class="v24c-mut">' + (role === 'teacher' ? '老師視角' : role === 'captain' ? '班長視角' : '學生視角') + '</div></div>' +
      bannerHtml +
      roleStrip +
      '<div class="v24c-two">' +
        '<div>' +
          '<div class="v24c-card"><h3>📅 ' + esc(T('nextExam')) + '</h3>' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<div style="background:var(--c-warnsoft);border:1px solid #e9cfb5;border-radius:8px;padding:10px 14px;text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--c-warn);">D-12</div><div class="v24c-mut">4/27 第二次段考</div></div>' +
              '<div style="flex:1;"><div class="v24c-mut">全班平均準備進度</div><div class="v24c-bar" style="margin:4px 0;"><span style="width:62%;"></span></div><div style="font-size:11px;">62% · 你：<b>71%</b></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="v24c-card"><h3>📣 ' + esc(T('pinned')) + '</h3>' +
            '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:#fffbf0;border-radius:5px;border:1px solid #ecd9a8;">' +
              '<span class="v24c-chip ink">📌</span><div style="flex:1;"><div style="font-weight:600;">週五段考座位表公布</div><div class="v24c-mut">王老師 · 4/20 · 28/28 已讀</div></div>' +
            '</div>' +
            '<div style="margin-top:6px;font-size:11px;"><button type="button" class="v24c-btn ghost small" data-action="class:goto" data-payload=\'{"screen":"announce"}\'>還有 2 則公告 →</button></div>' +
          '</div>' +
          '<div class="v24c-card"><h3>🔥 ' + esc(T('live')) + ' <span class="pill">live</span></h3>' +
            '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
              '<span class="v24c-chip ok"><span class="v24c-av sm">林</span> 林 O 翰 · 32min</span>' +
              '<span class="v24c-chip ok"><span class="v24c-av sm">陳</span> 陳 O 妤 · 48min</span>' +
              '<span class="v24c-chip">+5 人</span>' +
            '</div>' +
            '<div style="margin-top:6px;"><button type="button" class="v24c-btn ghost small" data-action="class:joinLiveRoom">🏃 加入班級共讀室 →</button></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="v24c-card"><h3>🎯 ' + esc(T('weeklyGoal')) + '</h3>' +
            '<div style="font-size:11px;margin-bottom:3px;">全班累積專注 ' + (cls.weeklyGoalHours || 300) + ' 小時</div>' +
            '<div class="v24c-bar"><span style="width:74%;"></span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:3px;"><span class="v24c-mut">222 / ' + (cls.weeklyGoalHours || 300) + ' hr</span><span class="v24c-chip ok">74%</span></div>' +
            '<div class="v24c-div"></div>' +
            '<div style="font-size:11px;margin-bottom:3px;">英文單字完成率 80%</div>' +
            '<div class="v24c-bar"><span style="width:55%;"></span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;margin-top:3px;"><span class="v24c-mut">55%</span><span class="v24c-chip warn">落後</span></div>' +
          '</div>' +
          '<div class="v24c-card"><h3>📚 ' + esc(T('subjects')) + '</h3>' +
            '<div class="v24c-grid2">' +
              '<div class="v24c-mini">📘 英文 · 3 任務</div><div class="v24c-mini">🔢 數學 · 2 任務</div>' +
              '<div class="v24c-mini">🔬 自然 · 0 任務</div><div class="v24c-mini">🌏 社會 · 1 任務</div>' +
            '</div>' +
          '</div>' +
          '<div class="v24c-card"><h3>🏆 ' + esc(T('rankingPreview')) + '</h3>' +
            '<div class="v24c-mut" style="font-size:10px;">專注時數榜</div>' +
            '<div style="margin-top:4px;font-size:11px;">' +
              '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>🥇 陳 O 妤</span><span>24.5 hr</span></div>' +
              '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>🥈 林 O 翰</span><span>22.1 hr</span></div>' +
              '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>🥉 你</span><span>20.8 hr</span></div>' +
            '</div>' +
            '<button type="button" class="v24c-btn ghost small" data-action="class:openAllRanks">看全部 4 種榜 →</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  };

  SCREENS.tasks = (role, cls) => {
    const rows = (cls.tasks || []).map(t => {
      const overdue = new Date(t.due) < new Date();
      const stChip = overdue ? '<span class="v24c-chip bad">逾期</span>' : '<span class="v24c-chip warn">' + esc(relDate(t.due)) + '</span>';
      return '<tr>' +
        '<td>' + stChip + '</td>' +
        '<td>' + esc(t.subject) + '</td>' +
        '<td>' + esc(t.title) + '</td>' +
        '<td>' + esc(t.kind) + '</td>' +
        '<td>' + t.points + '</td>' +
        '<td>' + (role === 'teacher' ? '<button type="button" class="v24c-btn small" data-action="class:submissionsFor" data-payload=\'{"taskId":"' + esc(t.id) + '"}\'>看繳交</button>' : '<button type="button" class="v24c-btn primary small" data-action="class:openTask" data-payload=\'{"taskId":"' + esc(t.id) + '"}\'>打開</button>') + '</td>' +
      '</tr>';
    }).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('tasks')) + '</h1><p>班級共同任務</p></div>' +
      (role === 'teacher' ? '<button type="button" class="v24c-btn primary" data-action="class:goto" data-payload=\'{"screen":"taskCreate"}\'>+ 發派新作業</button>' : '') +
      '</div>' +
      '<div class="v24c-card"><h3>🔥 作業列表</h3>' +
        '<table class="v24c-tbl"><thead><tr><th>狀態</th><th>科目</th><th>任務</th><th>繳交方式</th><th>分數</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '</div>'
    );
  };

  SCREENS.taskCreate = (role, cls) => {
    const draft = Object.assign({
      title: '英文 Ch 5 單字默寫',
      subject: '英文',
      description: '請默寫 Ch 5 單字表，40 字，拍照上傳或打字。',
      kind: 'image',
      due: '2026-04-24T22:00',
      points: 10,
      allowLate: true,
      allowResubmit: false,
      showAfterDue: true,
      peerReview: false,
      toExam: false
    }, getState().draftTask || {});
    const opt = v => '<option' + (draft.subject === v ? ' selected' : '') + '>' + esc(v) + '</option>';
    const kindBtn = (k, label) => '<button type="button" class="v24c-btn ' + (draft.kind === k ? 'primary' : '') + '" data-action="class:taskKind" data-payload=\'{"kind":"' + esc(k) + '"}\'>' + label + '</button>';
    const checked = v => v ? ' checked' : '';
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('taskCreate')) + '</h1><p>老師 / 班長發派新任務</p></div></div>' +
      '<div class="v24c-note"><b>設計：</b>「繳交類型」是新的 UX 關鍵 — 決定學生繳交頁長什麼樣、批改介面長什麼樣。</div>' +
      '<form class="v24c-card" data-action="class:taskCreate" onsubmit="return false;">' +
        '<h3>任務內容</h3>' +
        '<div class="v24c-form"><label>標題</label><input name="title" value="' + esc(draft.title) + '" data-field="title"></div>' +
        '<div class="v24c-form"><label>科目</label><select name="subject" data-field="subject">' + ['英文','數學','自然','社會','國文','其他'].map(opt).join('') + '</select></div>' +
        '<div class="v24c-form"><label>說明</label><textarea name="description" data-field="description">' + esc(draft.description) + '</textarea></div>' +
        '<div class="v24c-form"><label>繳交類型</label>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">' +
            kindBtn('text', '✍️ 文字') +
            kindBtn('image', '📷 圖片') +
            kindBtn('pdf', '📄 PDF') +
            kindBtn('link', '🔗 連結') +
            kindBtn('audio', '🎤 錄音') +
            kindBtn('quiz', '🧪 測驗') +
          '</div>' +
        '</div>' +
        '<div class="v24c-grid2">' +
          '<div class="v24c-form"><label>截止</label><input type="datetime-local" name="due" value="' + esc(draft.due) + '" data-field="due"></div>' +
          '<div class="v24c-form"><label>積分</label><input type="number" name="points" value="' + esc(draft.points) + '" data-field="points"></div>' +
        '</div>' +
        '<div class="v24c-form"><label>⚙️ 進階選項</label>' +
          '<div style="font-size:11px;display:flex;flex-direction:column;gap:5px;">' +
            '<label><input type="checkbox" data-field="allowLate"' + checked(draft.allowLate) + '> 允許遲交（-20%）</label>' +
            '<label><input type="checkbox" data-field="allowResubmit"' + checked(draft.allowResubmit) + '> 允許重交（最多 3 次）</label>' +
            '<label><input type="checkbox" data-field="showAfterDue"' + checked(draft.showAfterDue) + '> 繳交後可看全班答案（截止後）</label>' +
            '<label><input type="checkbox" data-field="peerReview"' + checked(draft.peerReview) + '> 啟用同儕互評（2 人一組）</label>' +
            '<label><input type="checkbox" data-field="toExam"' + checked(draft.toExam) + '> 轉成考試倒數</label>' +
          '</div>' +
        '</div>' +
        '<button type="submit" class="v24c-btn primary" style="width:100%;padding:8px;" data-action="class:taskSave">發布 → 通知 ' + (cls.members || []).length + ' 位成員</button>' +
      '</form>'
    );
  };

  SCREENS.submissions = (role, cls) => {
    const st = getState();
    const task = (cls.tasks || []).find(t => t.id === st.filterTaskId) || (cls.tasks || [])[0] || {};
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('submissions')) + '</h1><p>選任務看繳交狀態</p></div></div>' +
      '<div class="v24c-note new"><b>管理系統核心：</b>老師過去要點開每個任務一個個數，這裡全攤平 + 一鍵催繳。</div>' +
      '<div class="v24c-card"><h3>選擇任務</h3>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
          (cls.tasks || []).map((t, i) =>
            '<button type="button" class="v24c-btn ' + (t.id === task.id ? 'primary' : '') + ' small" data-action="class:submissionsFor" data-payload=\'{"taskId":"' + esc(t.id) + '"}\'>' + esc(t.title) + '</button>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div class="v24c-grid4">' +
        '<div class="v24c-mini"><div class="k">已繳交</div><div class="v" style="color:var(--c-accent);">24</div><div class="v24c-mut">86%</div></div>' +
        '<div class="v24c-mini"><div class="k">逾期未交</div><div class="v" style="color:var(--c-bad);">4</div><div class="v24c-mut">可一鍵催繳</div></div>' +
        '<div class="v24c-mini"><div class="k">待批改</div><div class="v" style="color:var(--c-warn);">12</div><div class="v24c-mut">估 45 分</div></div>' +
        '<div class="v24c-mini"><div class="k">已批改</div><div class="v">12</div><div class="v24c-mut">平均 85</div></div>' +
      '</div>' +
      '<div class="v24c-card"><h3>成員狀態 <span class="pill">' + (cls.members || []).length + ' 人</span></h3>' +
        '<div style="display:flex;gap:5px;margin-bottom:8px;">' +
          '<button type="button" class="v24c-btn small" data-action="class:submissionsFilter" data-payload=\'{"filter":"all"}\'>全部</button>' +
          '<button type="button" class="v24c-btn primary small" data-action="class:submissionsFilter" data-payload=\'{"filter":"missing"}\'>未繳 (4)</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:submissionsFilter" data-payload=\'{"filter":"pending"}\'>待批改 (12)</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:submissionsFilter" data-payload=\'{"filter":"done"}\'>已完成 (12)</button>' +
        '</div>' +
        '<table class="v24c-tbl"><thead><tr><th>座號</th><th>姓名</th><th>狀態</th><th>繳交時間</th><th>分</th><th></th></tr></thead><tbody>' +
          '<tr><td>03</td><td><span class="v24c-av sm">林</span> 林 O 翰</td><td><span class="v24c-chip bad">未交（逾期 1 天）</span></td><td>—</td><td>—</td><td><button type="button" class="v24c-btn small warn" data-action="class:remind" data-payload=\'{"memberId":"m03","taskId":"' + esc(task.id || '') + '"}\'>📲 催繳</button></td></tr>' +
          '<tr><td>07</td><td><span class="v24c-av sm">張</span> 張 O 安</td><td><span class="v24c-chip bad">未交</span></td><td>—</td><td>—</td><td><button type="button" class="v24c-btn small warn" data-action="class:remind" data-payload=\'{"memberId":"m07","taskId":"' + esc(task.id || '') + '"}\'>📲 催繳</button></td></tr>' +
          '<tr><td>12</td><td><span class="v24c-av sm">陳</span> 陳 O 妤</td><td><span class="v24c-chip warn">待批改</span></td><td>4/23 21:40</td><td>—</td><td><button type="button" class="v24c-btn primary small" data-action="class:goto" data-payload=\'{"screen":"grading","submissionId":"s1"}\'>批改</button></td></tr>' +
          '<tr><td>15</td><td><span class="v24c-av sm">王</span> 王 O 寧</td><td><span class="v24c-chip ok">已批改</span></td><td>4/23 19:22</td><td>92</td><td><button type="button" class="v24c-btn small" data-action="class:viewGrade" data-payload=\'{"submissionId":"s2"}\'>看回饋</button></td></tr>' +
        '</tbody></table>' +
        '<div style="margin-top:8px;"><button type="button" class="v24c-btn primary" data-action="class:remindAll" data-payload=\'{"taskId":"' + esc(task.id || '') + '"}\'>📲 一鍵催繳所有未交</button> <button type="button" class="v24c-btn" data-action="class:exportCsv" data-payload=\'{"taskId":"' + esc(task.id || '') + '"}\'>匯出 CSV</button></div>' +
      '</div>'
    );
  };

  SCREENS.grading = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('grading')) + '</h1><p>逐份批改</p></div><div class="v24c-mut">12 / 24 份</div></div>' +
    '<div class="v24c-note"><b>建議：</b>鍵盤 1–5 快速打星、Enter 下一份。快捷評語可在 snippet 庫管理。</div>' +
    '<div style="display:grid;grid-template-columns:1fr 280px;gap:10px;">' +
      '<div class="v24c-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div><b>陳 O 妤 · 座號 12</b> <span class="v24c-mut">· 4/23 21:40 繳交</span></div>' +
          '<div><button type="button" class="v24c-btn small" data-action="class:gradePrev">← 上一份</button> <button type="button" class="v24c-btn small" data-action="class:gradeNext">下一份 →</button></div>' +
        '</div>' +
        '<div class="v24c-ph" style="height:320px;">📷 學生上傳的照片預覽<br><span style="font-size:9px;">（可放大/旋轉/圈選）</span></div>' +
      '</div>' +
      '<div>' +
        '<div class="v24c-card"><h3>評分 <span class="pill">Rubric</span></h3>' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--c-border);"><span>字形工整</span><span style="color:#c88a2a;letter-spacing:2px;" data-field="rubric-form">★★★★☆</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--c-border);"><span>正確率</span><span style="color:#c88a2a;letter-spacing:2px;" data-field="rubric-correct">★★★★★</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>按時繳交</span><span style="color:#c88a2a;letter-spacing:2px;" data-field="rubric-time">★★★★★</span></div>' +
          '<div class="v24c-div"></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;"><b>總分</b><input style="width:56px;text-align:right;" value="92" data-field="score"></div>' +
        '</div>' +
        '<div class="v24c-card"><h3>評語</h3>' +
          '<textarea style="width:100%;padding:6px;border:1px solid var(--c-border);border-radius:5px;" rows="3" data-field="comment">整體不錯，最後一頁有 3 字寫成簡體。</textarea>' +
          '<div class="v24c-mut" style="margin-top:3px;">快捷：</div>' +
          '<div style="display:flex;gap:3px;flex-wrap:wrap;">' +
            '<button type="button" class="v24c-btn small" data-action="class:gradeSnippet" data-payload=\'{"text":"👍 很棒"}\'>👍 很棒</button>' +
            '<button type="button" class="v24c-btn small" data-action="class:gradeSnippet" data-payload=\'{"text":"注意字形"}\'>注意字形</button>' +
            '<button type="button" class="v24c-btn small" data-action="class:gradeSnippet" data-payload=\'{"text":"全對"}\'>全對</button>' +
            '<button type="button" class="v24c-btn small" data-action="class:gradeSnippetManage">+ snippet</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="v24c-btn primary" style="width:100%;padding:8px;" data-action="class:gradeSubmit">送出 &amp; 下一份 (Enter)</button>' +
      '</div>' +
    '</div>'
  );

  SCREENS.attendance = (role, cls) => {
    const seatBoxes = (cls.members || []).filter(m => m.seat).map(m => {
      const states = ['', 'studying', 'late', 'absent'];
      const cls2 = states[Math.floor(Math.abs(m.seat.charCodeAt(0)) % 4)];
      return '<div class="v24c-seat ' + cls2 + '" data-action="class:attendanceToggle" data-payload=\'{"memberId":"' + esc(m.id) + '"}\'><span class="v24c-av sm">' + esc(m.name.slice(0, 1)) + '</span><div>' + esc(m.name) + '</div><div class="n">' + esc(m.seat) + '</div></div>';
    }).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('attendance')) + '</h1><p>今日點名 · 2026/4/21 (二)</p></div><div><button type="button" class="v24c-btn small" data-action="class:attendanceView" data-payload=\'{"view":"list"}\'>清單視圖</button><button type="button" class="v24c-btn primary small" data-action="class:attendanceView" data-payload=\'{"view":"seat"}\'>座位視圖</button></div></div>' +
      '<div class="v24c-note new"><b>巧思：</b>點名狀態包含「專注中」（從 Focus 即時同步）。老師看得出學生雖然到了但神遊。</div>' +
      '<div class="v24c-card">' +
        '<div class="v24c-seats">' + seatBoxes + '</div>' +
        '<div class="v24c-div"></div>' +
        '<div style="display:flex;gap:8px;font-size:10px;">' +
          '<span><span class="v24c-chip ok">●</span> 專注中 3</span>' +
          '<span><span class="v24c-chip">●</span> 已到 5</span>' +
          '<span><span class="v24c-chip warn">●</span> 遲到 1</span>' +
          '<span><span class="v24c-chip bad">●</span> 未到/請假 2</span>' +
        '</div>' +
        '<div style="margin-top:8px;"><button type="button" class="v24c-btn primary" data-action="class:attendanceSave">儲存今日</button> <button type="button" class="v24c-btn" data-action="class:attendanceExport">匯出月報</button></div>' +
      '</div>'
    );
  };

  SCREENS.members = (role, cls) => {
    const rows = (cls.members || []).map(m => {
      const chip = m.role === 'teacher' ? '<span class="v24c-chip ink">🧑‍🏫 老師</span>' :
                   m.role === 'captain' ? '<span class="v24c-chip warn">🎖 班長</span>' :
                   m.role === 'parent' ? '<span class="v24c-chip">👁 家長</span>' :
                   '<span class="v24c-chip">👨‍🎓 學生</span>';
      const sub = (m.subjectRoles || []).map(r => '<span class="v24c-chip">📚 ' + esc(r) + '</span>').join(' ');
      return '<tr><td>' + esc(m.seat || '—') + '</td><td><span class="v24c-av sm">' + esc(m.name.slice(0,1)) + '</span> ' + esc(m.name) + '</td><td>' + chip + ' ' + sub + '</td><td>' + (m.weeklyFocus || 0) + ' hr</td><td><button type="button" class="v24c-btn small" data-action="class:memberEdit" data-payload=\'{"memberId":"' + esc(m.id) + '"}\'>調整</button></td></tr>';
    }).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('members')) + '</h1><p>管理誰是老師 / 班長 / 科代 / 家長</p></div></div>' +
      '<div class="v24c-note"><b>角色細粒度：</b>班長能發公告但不能打分；科代能整理該科錯題本但不能發別科作業。</div>' +
      '<div class="v24c-card"><h3>預設角色模板</h3><div class="v24c-grid3">' +
        '<div class="v24c-mini"><b>🧑‍🏫 老師</b><div class="v24c-mut">全權限</div></div>' +
        '<div class="v24c-mini"><b>🎖 班長</b><div class="v24c-mut">發公告 / 點名 / 催繳</div></div>' +
        '<div class="v24c-mini"><b>📚 科代</b><div class="v24c-mut">該科作業 / 錯題本</div></div>' +
        '<div class="v24c-mini"><b>👨‍🎓 學生</b><div class="v24c-mut">繳交 / 發問 / 互評</div></div>' +
        '<div class="v24c-mini"><b>👁 家長</b><div class="v24c-mut">唯讀</div></div>' +
        '<div class="v24c-mini"><b>➕ 自訂</b><div class="v24c-mut">勾選權限</div></div>' +
      '</div></div>' +
      '<div class="v24c-card"><h3>成員列表</h3><table class="v24c-tbl"><thead><tr><th>座號</th><th>姓名</th><th>角色</th><th>本週專注</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="margin-top:8px;"><button type="button" class="v24c-btn primary" data-action="class:memberInvite">+ 邀請成員</button> <button type="button" class="v24c-btn" data-action="class:memberImportCsv">匯入 CSV</button></div>' +
      '</div>'
    );
  };

  SCREENS.submit = (role, cls) => {
    const st = getState();
    const t = (cls.tasks || []).find(task => task.id === st.activeTaskId || task.id === st.filterTaskId) || (cls.tasks || [])[0] || { title: '', points: 0, kind: '', due: '' };
    const draft = (st.draftSub && st.draftSub[t.id]) || {};
    const attCount = ((draft.attachments || []).length);
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('submit')) + '</h1><p>學生繳交介面（UI 隨類型變）</p></div></div>' +
      '<div class="v24c-note new"><b>學習閉環核心：</b>有繳交才閉上「老師發 → 學生交 → 老師回饋」的循環。不只是打勾「完成」。</div>' +
      '<div class="v24c-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><div><b>' + esc(t.title) + '</b><div class="v24c-mut">王老師 · 截止 ' + esc(t.due) + ' · <span class="v24c-chip warn">' + esc(relDate(t.due)) + '</span></div></div><div class="v24c-chip">' + t.points + ' 分 · 📷 圖片</div></div>' +
        '<div class="v24c-div"></div>' +
        '<div class="v24c-form"><label>上傳照片（最多 5 張）</label><div class="v24c-ph" data-action="class:submitUpload" data-payload=\'{"taskId":"' + esc(t.id || '') + '"}\'>點此或拖曳圖片到這裡<br><span style="font-size:9px;">建議拍 A4，系統會自動裁切轉正</span>' + (attCount ? '<br><span class="v24c-chip ok">' + attCount + ' files</span>' : '') + '</div></div>' +
        '<div class="v24c-form"><label>留言給老師（可選）</label><textarea rows="2" placeholder="想補充什麼..." data-field="submitNote"></textarea></div>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button type="button" class="v24c-btn primary" data-action="class:submitSend" data-payload=\'{"taskId":"' + esc(t.id || '') + '"}\'>送出繳交</button>' +
          '<button type="button" class="v24c-btn" data-action="class:submitDraft" data-payload=\'{"taskId":"' + esc(t.id || '') + '"}\'>先存草稿</button>' +
          '<span class="v24c-mut" style="margin-left:auto;">可在截止前重交（最多 3 次）</span>' +
        '</div>' +
      '</div>' +
      '<div class="v24c-card"><h3>👀 截止後才能看</h3><div class="v24c-mut">· 全班答案瀏覽（匿名 / 具名由老師設定）<br>· 老師公布的「範例答案」<br>· 全班平均 + 你的百分位<br>· 常錯字彙 heatmap</div></div>'
    );
  };

  SCREENS.history = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('history')) + '</h1><p>學習成果回看</p></div></div>' +
    '<div class="v24c-note new"><b>作品集級別：</b>學生需要能回看自己這學期交了什麼、拿幾分、老師怎麼評。</div>' +
    '<div class="v24c-grid3">' +
      '<div class="v24c-mini"><div class="k">本學期已交</div><div class="v">14</div><div class="v24c-mut">/ 16 發佈</div></div>' +
      '<div class="v24c-mini"><div class="k">平均分</div><div class="v">87.3</div><div class="v24c-mut">班排 #3</div></div>' +
      '<div class="v24c-mini"><div class="k">逾期次數</div><div class="v">1</div><div class="v24c-mut">-2% 扣分</div></div>' +
    '</div>' +
    '<div class="v24c-card"><h3>繳交記錄</h3><table class="v24c-tbl"><thead><tr><th>日期</th><th>任務</th><th>科目</th><th>類型</th><th>分</th><th>評語</th></tr></thead><tbody>' +
      '<tr><td>4/23</td><td>英文 Ch 5 默寫</td><td>英文</td><td>📷</td><td><span class="v24c-chip ok">92</span></td><td>字形再加強一下。</td></tr>' +
      '<tr><td>4/18</td><td>數學 Ch 3 測驗</td><td>數學</td><td>🧪</td><td><span class="v24c-chip ok">85</span></td><td>第 12 題觀念重讀。</td></tr>' +
      '<tr><td>4/14</td><td>自然 光學實驗</td><td>自然</td><td>📄</td><td><span class="v24c-chip ok">A+</span></td><td>優秀，圖表清晰。</td></tr>' +
    '</tbody></table></div>' +
    '<div class="v24c-card"><h3>📈 進步趨勢</h3><div class="v24c-ph" style="height:100px;">折線圖 · 各科分數隨時間變化</div><button type="button" class="v24c-btn" data-action="class:historyExport">匯出學期總覽 PDF</button></div>'
  );

  SCREENS.peer = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('peer')) + '</h1><p>匿名讀兩份同學作業、給回饋</p></div></div>' +
    '<div class="v24c-note"><b>預設匿名：</b>讀兩份才解鎖自己的回饋（避免白嫖）。老師看得到誰給誰評了什麼。</div>' +
    '<div class="v24c-card"><h3>我要評的作業 (2/2)</h3>' +
      '<div style="padding:8px;border:1px solid var(--c-border);border-radius:5px;margin-bottom:6px;">' +
        '<div><b>匿名同學 A</b> <span class="v24c-mut">· 社會心得</span></div>' +
        '<div class="v24c-ph" style="height:50px;margin:6px 0;">[學生作品預覽]</div>' +
        '<div style="display:flex;gap:5px;align-items:center;"><span class="v24c-mut">我的評分：</span><span style="color:#c88a2a;letter-spacing:2px;">★★★★☆</span><button type="button" class="v24c-btn small" data-action="class:peerWrite" data-payload=\'{"targetId":"A"}\'>寫 100 字評語 →</button></div>' +
      '</div>' +
      '<div style="padding:8px;border:1px solid var(--c-border);border-radius:5px;opacity:.6;">' +
        '<div><b>匿名同學 B</b> <span class="v24c-mut">· 待讀</span></div>' +
        '<button type="button" class="v24c-btn small" data-action="class:peerRead" data-payload=\'{"targetId":"B"}\'>開始讀</button>' +
      '</div>' +
    '</div>' +
    '<div class="v24c-card"><h3>我收到的回饋</h3><div class="v24c-mut">🔒 讀完 2 份才解鎖</div><div class="v24c-ph">解鎖中 · 1/2</div></div>'
  );

  SCREENS.qa = (role, cls) => {
    const rows = (cls.qa || []).map(q =>
      '<div style="padding:8px;border:1px solid var(--c-border);border-radius:5px;margin-bottom:6px;" data-action="class:qaOpen" data-payload=\'{"qid":"' + esc(q.id) + '"}\'>' +
        '<div style="display:flex;justify-content:space-between;"><b>' + esc(q.title) + '</b><span class="v24c-chip ' + (q.answered ? 'ok' : 'warn') + '">' + (q.answered ? '老師已回 ✓' : '待老師回') + '</span></div>' +
        '<div class="v24c-mut">' + esc((member(q.author) || {}).name || '?') + ' · 💬 ' + (q.replies || []).length + ' 回覆</div>' +
        '<div style="margin-top:4px;font-size:11px;">' + esc(q.body) + '</div>' +
      '</div>'
    ).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('qa')) + '</h1><p>結構化的任務/科目提問（和聊天並存）</p></div></div>' +
      '<div class="v24c-card">' +
        '<div style="display:flex;gap:5px;margin-bottom:6px;">' +
          '<button type="button" class="v24c-btn primary small" data-action="class:qaFilter" data-payload=\'{"filter":"all"}\'>全部</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:qaFilter" data-payload=\'{"filter":"unanswered"}\'>待老師回</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:qaFilter" data-payload=\'{"filter":"mine"}\'>我的</button>' +
        '</div>' +
        rows +
        '<button type="button" class="v24c-btn primary" data-action="class:qaNew">+ 發問</button>' +
      '</div>'
    );
  };

  SCREENS.calendar = (role, cls) => {
    const days = [];
    for (let d = 1; d <= 30; d++) {
      const iso = '2026-04-' + String(d).padStart(2, '0');
      const evs = (cls.calendar || []).filter(e => e.date === iso);
      let cls2 = '', label = '';
      if (evs.length) {
        const e = evs[0];
        cls2 = e.kind === 'exam' ? 'exam' : 'task';
        label = e.title;
      }
      if (d === 21) cls2 += ' today';
      days.push('<div class="day ' + cls2 + '" data-action="class:calOpenDay" data-payload=\'{"date":"' + iso + '"}\'><span class="n">' + d + (d === 21 ? ' ·今' : '') + '</span>' + (label ? '<div class="d">' + esc(label) + '</div>' : '') + '</div>');
    }
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('calendar')) + '</h1><p>考試 / 作業截止 / 活動 統一時間軸</p></div></div>' +
      '<div class="v24c-note new"><b>整合：</b>可匯出 Google / Apple Calendar。</div>' +
      '<div class="v24c-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div><button type="button" class="v24c-btn small" data-action="class:calPrev">←</button> <b>2026 年 4 月</b> <button type="button" class="v24c-btn small" data-action="class:calNext">→</button></div><div style="font-size:10px;"><span class="v24c-chip warn">● 考試</span> <span class="v24c-chip ok">● 作業</span> <span class="v24c-chip">● 活動</span></div></div>' +
        '<div class="v24c-calhd"><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div></div>' +
        '<div class="v24c-cal">' + days.join('') + '</div>' +
        '<div style="margin-top:8px;"><button type="button" class="v24c-btn" data-action="class:calExportIcs">匯出 .ics</button> <button type="button" class="v24c-btn" data-action="class:calSubscribeGoogle">訂閱到 Google Calendar</button></div>' +
      '</div>'
    );
  };

  SCREENS.seats = (role, cls) => {
    const seats = (cls.members || []).filter(m => m.seat).map(m =>
      '<div class="v24c-seat" data-action="class:seatSelect" data-payload=\'{"memberId":"' + esc(m.id) + '"}\'><div>' + esc(m.name) + '</div><div class="n">' + esc(m.seat) + '</div></div>'
    ).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('seats')) + '</h1><p>班級身份感的核心 — 有座號才像一個班</p></div></div>' +
      '<div class="v24c-note"><b>為什麼：</b>小組 = 動機、班級 = 結構。結構最小單位是座號、角色、本命位置。</div>' +
      '<div class="v24c-two">' +
        '<div class="v24c-card"><h3>座位表</h3>' +
          '<div class="v24c-mut" style="margin-bottom:5px;">上方=黑板方向 · 老師可拖曳重排</div>' +
          '<div class="v24c-seats">' + seats + '</div>' +
          '<div style="margin-top:8px;"><button type="button" class="v24c-btn" data-action="class:seatReshuffle">隨機重排</button> <button type="button" class="v24c-btn" data-action="class:seatEdit">編輯模式</button></div>' +
        '</div>' +
        '<div>' +
          '<div class="v24c-card"><h3>花名冊 CSV 匯入</h3><div class="v24c-mut">姓名 / 座號 / 角色 / 家長 email</div><button type="button" class="v24c-btn small" data-action="class:rosterTemplate" style="margin-top:5px;">下載範本</button></div>' +
          '<div class="v24c-card"><h3>班級卡片</h3><div class="v24c-mut">每成員：座號 + 自介 + 目標大學 + 擅長科目</div><button type="button" class="v24c-btn small" data-action="class:openMyCard">我的班級卡片</button></div>' +
        '</div>' +
      '</div>'
    );
  };

  SCREENS.coedit = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('coedit')) + '</h1><p>全班一起編的共筆</p></div></div>' +
    '<div class="v24c-note"><b>邊界：</b>不是 Notion。輕量 Markdown + presence indicator + 章節鎖。可一鍵收藏到 Learn &gt; Notes。</div>' +
    '<div class="v24c-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><b>高三英文 Ch5 單字共筆</b><div style="font-size:10px;">👥 <span class="v24c-chip ok">陳妤編輯中</span> <span class="v24c-chip">林翰</span> +3</div></div>' +
      '<div class="v24c-ph" style="min-height:240px;text-align:left;padding:12px;font-family:monospace;font-size:11px;"># Chapter 5 Vocabulary<br><br>## 動詞類 <span style="background:#fff3c4;">← 陳妤正在編輯</span><br>- analyze — 分析<br>- criticize — 批評<br><br>## 名詞類<br>- perspective — 觀點</div>' +
      '<div style="margin-top:8px;display:flex;gap:5px;"><button type="button" class="v24c-btn primary small" data-action="class:coeditSave">⭐ 收藏到我的 Notes</button><button type="button" class="v24c-btn small" data-action="class:coeditHistory">版本紀錄</button><button type="button" class="v24c-btn small" data-action="class:coeditLock">鎖定章節</button></div>' +
    '</div>'
  );

  SCREENS.resources = (role, cls) => {
    const rows = (cls.resources || []).map(r =>
      '<tr><td>' + esc(r.kind) + '</td><td>' + esc(r.title) + '</td><td>' + esc(r.subject) + '</td><td>' + esc((member(r.uploader) || {}).name || '?') + ' ' + (r.tier === 'teacher' ? '🧑‍🏫' : r.tier === 'captain' ? '🎖' : '👨‍🎓') + '</td><td>' + r.downloads + '</td><td><button type="button" class="v24c-btn small" data-action="class:resourceDownload" data-payload=\'{"id":"' + esc(r.id) + '"}\'>下載</button></td></tr>'
    ).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('resources')) + '</h1><p>講義 / 連結 / 考古 / 常錯題</p></div></div>' +
      '<div class="v24c-note"><b>三層分級：</b>老師官方 / 班長整理 / 同學共享，避免資訊品質不一。老師可一鍵升級。</div>' +
      '<div class="v24c-card">' +
        '<div style="display:flex;gap:5px;margin-bottom:6px;">' +
          '<button type="button" class="v24c-btn primary small" data-action="class:resourceFilter" data-payload=\'{"tier":"all"}\'>全部</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:resourceFilter" data-payload=\'{"tier":"teacher"}\'>🧑‍🏫 老師</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:resourceFilter" data-payload=\'{"tier":"captain"}\'>🎖 班長</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:resourceFilter" data-payload=\'{"tier":"peer"}\'>👨‍🎓 同學</button>' +
        '</div>' +
        '<table class="v24c-tbl"><thead><tr><th>類型</th><th>標題</th><th>科目</th><th>上傳</th><th>下載</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="margin-top:8px;"><button type="button" class="v24c-btn primary" data-action="class:resourceUpload">+ 上傳資源</button></div>' +
      '</div>'
    );
  };

  SCREENS.join = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('join')) + '</h1><p>學生第一次進班</p></div></div>' +
    '<div class="v24c-note new"><b>三種方式並存：</b>班級代碼（最簡單）、邀請連結 + QR、老師手動加。未成年需家長同意。</div>' +
    '<div class="v24c-grid2">' +
      '<div class="v24c-card"><h3>🔑 班級代碼</h3>' +
        '<input style="width:100%;padding:10px;font-size:16px;text-align:center;letter-spacing:.25em;border:2px solid var(--c-accent);border-radius:6px;" placeholder="8 位代碼" value="HS3A-2026" data-field="joinCode">' +
        '<button type="button" class="v24c-btn primary" style="width:100%;margin-top:6px;" data-action="class:joinByCode">加入</button>' +
      '</div>' +
      '<div class="v24c-card"><h3>📱 QR Code</h3><div class="v24c-ph" style="aspect-ratio:1;">[QR code]<br>掃一下加入</div><button type="button" class="v24c-btn small" data-action="class:joinScanQr">開相機掃描</button></div>' +
    '</div>' +
    '<div class="v24c-card"><h3>⏳ 等待老師審核</h3><div class="v24c-mut">班級設定為「需審核」時，你送出請求，老師在成員管理看到。</div></div>' +
    '<div class="v24c-card"><h3>👁 未滿 18 歲？</h3><div class="v24c-mut">填家長 email → 寄同意信 → 家長點連結 → 正式加入。（遵守個資法／COPPA）</div><div class="v24c-form"><label>家長 email</label><input type="email" data-field="parentEmail"></div><button type="button" class="v24c-btn" data-action="class:joinParentConsent">寄同意信</button></div>'
  );

  SCREENS.settings = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('settings')) + '</h1><p>老師 / 建立者管理面板</p></div></div>' +
    '<div class="v24c-two">' +
      '<div class="v24c-card"><h3>🎨 班級身份</h3>' +
        '<div class="v24c-form"><label>班級名稱</label><input value="' + esc(cls.name) + '" data-field="name"></div>' +
        '<div class="v24c-form"><label>副標 / 班訓</label><input value="' + esc(cls.motto) + '" data-field="motto"></div>' +
        '<div class="v24c-form"><label>班徽</label><div style="display:flex;gap:5px;flex-wrap:wrap;">🦊 🐻 🐼 🐨 🐯 🦁 🌸 📘 ✏️ ⭐ <button type="button" class="v24c-btn small" data-action="class:settingsCrestUpload">上傳</button></div></div>' +
        '<div class="v24c-form"><label>班級主色</label><input type="color" value="' + esc(cls.color) + '" data-field="color"></div>' +
      '</div>' +
      '<div>' +
        '<div class="v24c-card"><h3>🔑 加入方式</h3>' +
          '<div class="v24c-form"><label><input type="radio" name="joinMode" ' + (cls.joinMode === 'code' ? 'checked' : '') + ' data-action="class:settingsJoinMode" data-payload=\'{"mode":"code"}\'> 班級代碼</label></div>' +
          '<div class="v24c-form"><label><input type="radio" name="joinMode" ' + (cls.joinMode === 'review' ? 'checked' : '') + ' data-action="class:settingsJoinMode" data-payload=\'{"mode":"review"}\'> 代碼 + 審核</label></div>' +
          '<div class="v24c-form"><label><input type="radio" name="joinMode" ' + (cls.joinMode === 'manual' ? 'checked' : '') + ' data-action="class:settingsJoinMode" data-payload=\'{"mode":"manual"}\'> 僅老師手動加</label></div>' +
        '</div>' +
        '<div class="v24c-card"><h3>📆 學期</h3>' +
          '<div class="v24c-form"><label>學期</label><input value="' + esc(cls.term) + '" data-field="term"></div>' +
          '<div class="v24c-form"><label>起迄</label><input value="' + esc(cls.termStart) + ' → ' + esc(cls.termEnd) + '" data-field="termRange"></div>' +
        '</div>' +
        '<div class="v24c-card"><h3>⚠️ 危險區域</h3>' +
          '<button type="button" class="v24c-btn" data-action="class:archive">📦 歸檔此班級</button>' +
          '<button type="button" class="v24c-btn warn" style="margin-top:5px;" data-action="class:delete">🗑 永久刪除</button>' +
        '</div>' +
        '<button type="button" class="v24c-btn primary" style="width:100%;padding:8px;" data-action="class:settingsSave">儲存所有變更</button>' +
      '</div>' +
    '</div>'
  );

  SCREENS.archive = (role, cls) => (
    '<div class="v24c-head"><div><h1>' + esc(T('archive')) + '</h1><p>學期結束後封存的班級</p></div></div>' +
    '<div class="v24c-note new"><b>為什麼封存：</b>不直接消失 = 學生能回看作品。凍結資料但保留繳交歷史、共筆、資源。可 PDF 匯出學期總覽。</div>' +
    '<div class="v24c-card"><table class="v24c-tbl"><thead><tr><th>班級</th><th>學期</th><th>成員</th><th>總交件</th><th>平均分</th><th></th></tr></thead><tbody>' +
      '<tr><td>🦊 高三甲班</td><td>2025 秋</td><td>28</td><td>384</td><td>84.2</td><td><button type="button" class="v24c-btn small" data-action="class:archiveOpen" data-payload=\'{"classId":"hist1"}\'>進入</button> <button type="button" class="v24c-btn small" data-action="class:archiveExport" data-payload=\'{"classId":"hist1"}\'>匯出 PDF</button></td></tr>' +
      '<tr><td>📘 高二乙班</td><td>2025 春</td><td>30</td><td>412</td><td>81.5</td><td><button type="button" class="v24c-btn small" data-action="class:archiveOpen" data-payload=\'{"classId":"hist2"}\'>進入</button></td></tr>' +
    '</tbody></table></div>'
  );

  SCREENS.announce = (role, cls) => {
    const rows = (cls.announcements || []).map(a =>
      '<div style="padding:8px;border:1px solid var(--c-border);border-radius:5px;margin-bottom:6px;">' +
        '<div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;">' + (a.pinned ? '<span class="v24c-chip ink">📌</span>' : '') + '<span class="v24c-chip ' + (a.category === 'exam' ? 'warn' : '') + '">' + esc(a.category) + '</span><b>' + esc(a.title) + '</b></div>' +
        '<div class="v24c-mut">' + esc((member(a.author) || {}).name || '?') + ' · ' + esc(a.createdAt) + '</div>' +
        '<div style="margin-top:4px;">' + esc(a.body) + '</div>' +
        '<div style="margin-top:5px;display:flex;gap:5px;"><button type="button" class="v24c-btn small" data-action="class:announceToTask" data-payload=\'{"id":"' + esc(a.id) + '"}\'>一鍵轉任務</button><button type="button" class="v24c-btn small" data-action="class:announceRead" data-payload=\'{"id":"' + esc(a.id) + '"}\'>標記已讀</button>' + (role === 'teacher' ? '<button type="button" class="v24c-btn small" data-action="class:announcePin" data-payload=\'{"id":"' + esc(a.id) + '"}\'>' + (a.pinned ? '取消置頂' : '置頂') + '</button>' : '') + '</div>' +
      '</div>'
    ).join('');
    return (
      '<div class="v24c-head"><div><h1>' + esc(T('announce')) + '</h1><p>分類 / 置頂 / 已讀統計</p></div>' +
      (role === 'teacher' ? '<button type="button" class="v24c-btn primary" data-action="class:announceCreate">+ 發公告</button>' : '') +
      '</div>' +
      '<div class="v24c-card">' +
        '<div style="display:flex;gap:5px;margin-bottom:6px;">' +
          '<button type="button" class="v24c-btn primary small" data-action="class:announceFilter" data-payload=\'{"f":"all"}\'>全部</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:announceFilter" data-payload=\'{"f":"pinned"}\'>📌 置頂</button>' +
          '<button type="button" class="v24c-btn small" data-action="class:announceFilter" data-payload=\'{"f":"exam"}\'>🔥 考試</button>' +
        '</div>' +
        rows +
      '</div>'
    );
  };

  // ========== Navigation structure ==========
  const NAV = [
    { group: 'navCore', items: [
      { id: 'home', icon: '🏠', label: 'home' },
      { id: 'tasks', icon: '📋', label: 'tasks' },
      { id: 'announce', icon: '📣', label: 'announce' },
    ]},
    { group: 'navTeacher', roles: ['teacher', 'captain'], items: [
      { id: 'taskCreate', icon: '➕', label: 'taskCreate', roles: ['teacher', 'captain'] },
      { id: 'submissions', icon: '📊', label: 'submissions', roles: ['teacher', 'captain'], tag: 'new' },
      { id: 'grading', icon: '✏️', label: 'grading', roles: ['teacher'], tag: 'new' },
      { id: 'attendance', icon: '🧍', label: 'attendance', roles: ['teacher', 'captain'], tag: 'new' },
      { id: 'members', icon: '👥', label: 'members', roles: ['teacher', 'captain'] },
    ]},
    { group: 'navStudent', roles: ['student', 'captain'], items: [
      { id: 'submit', icon: '📤', label: 'submit', roles: ['student', 'captain'], tag: 'new' },
      { id: 'history', icon: '🗂', label: 'history', roles: ['student', 'captain'], tag: 'new' },
      { id: 'peer', icon: '🤝', label: 'peer', roles: ['student', 'captain'], tag: 'new' },
      { id: 'qa', icon: '❓', label: 'qa' },
    ]},
    { group: 'navCommon', items: [
      { id: 'calendar', icon: '📅', label: 'calendar', tag: 'new' },
      { id: 'seats', icon: '🪑', label: 'seats', tag: 'new' },
      { id: 'coedit', icon: '📝', label: 'coedit' },
      { id: 'resources', icon: '📚', label: 'resources' },
    ]},
    { group: 'navSettings', items: [
      { id: 'join', icon: '🔑', label: 'join', roles: ['student'] },
      { id: 'settings', icon: '⚙️', label: 'settings', roles: ['teacher'] },
      { id: 'archive', icon: '🗃', label: 'archive', tag: 'new' },
    ]},
  ];

  function renderNav(role, currentScreen) {
    return NAV.map(g => {
      if (g.roles && g.roles.indexOf(role) === -1) return '';
      const items = g.items.filter(i => !i.roles || i.roles.indexOf(role) !== -1);
      if (!items.length) return '';
      return '<h4>' + esc(T(g.group)) + '</h4>' +
        items.map(i =>
          '<a data-v24-screen="' + esc(i.id) + '" class="' + (i.id === currentScreen ? 'active' : '') + '">' +
            esc(i.icon) + ' ' + esc(T(i.label)) +
            (i.tag ? '<span class="tag">' + esc(i.tag) + '</span>' : '') +
          '</a>'
        ).join('');
    }).join('');
  }

  function renderTopbar(role) {
    return '<div class="v24c-topbar">' +
      '<div class="v24c-brand">🎓 ' + esc(T('title')) + ' <small>' + esc(T('brand')) + ' v24</small></div>' +
      '<div class="v24c-roles">' +
        '<button type="button" data-v24-role="teacher" class="' + (role === 'teacher' ? 'active' : '') + '">🧑‍🏫 ' + esc(T('roleTeacher')) + '</button>' +
        '<button type="button" data-v24-role="student" class="' + (role === 'student' ? 'active' : '') + '">👨‍🎓 ' + esc(T('roleStudent')) + '</button>' +
        '<button type="button" data-v24-role="captain" class="' + (role === 'captain' ? 'active' : '') + '">🎖 ' + esc(T('roleCaptain')) + '</button>' +
      '</div>' +
    '</div>';
  }

  // ========== Render ==========
  function render(host) {
    const st = getState();
    const cls = activeClass();
    const fn = SCREENS[st.uiScreen] || SCREENS.home;
    host.innerHTML =
      renderTopbar(st.uiRole) +
      '<div class="v24c-layout">' +
        '<aside class="v24c-nav">' + renderNav(st.uiRole, st.uiScreen) + '</aside>' +
        '<main class="v24c-canvas">' + fn(st.uiRole, cls) + '</main>' +
      '</div>';
    bindEvents(host);
  }

  function bindEvents(host) {
    host.querySelectorAll('[data-v24-role]').forEach(btn => {
      btn.onclick = () => {
        updateState({ uiRole: btn.getAttribute('data-v24-role') });
        render(host);
      };
    });
    host.querySelectorAll('[data-v24-screen]').forEach(a => {
      a.onclick = (e) => {
        e.preventDefault();
        updateState({ uiScreen: a.getAttribute('data-v24-screen') });
        render(host);
      };
    });
    host.querySelectorAll('[data-action]').forEach(el => {
      if (el.__v24Bound) return;
      el.__v24Bound = true;
      el.addEventListener('click', (e) => {
        if (el.tagName === 'FORM' && e.target !== el) return;
        if (el.tagName === 'A' || el.type === 'submit') e.preventDefault();
        e.stopPropagation();
        const action = el.getAttribute('data-action');
        let payload = null;
        const raw = el.getAttribute('data-payload');
        if (raw) {
          try { payload = JSON.parse(raw); } catch (err) { payload = raw; }
        }
        // Built-in navigation shortcut so at least screen-switching works before Codex wires handlers
        if (action === 'class:goto' && payload && payload.screen) {
          const patch = { uiScreen: payload.screen };
          if (payload.taskId) patch.activeTaskId = payload.taskId;
          if (payload.screen === 'taskCreate') patch.draftTask = null;
          updateState(patch);
          render(host);
          return;
        }
        dispatch(action, payload, el);
      });
    });
  }

  // ========== Mount / route detection ==========
  let _host = null;
  let _hiddenNodes = [];

  function findClassPage() {
    // Heuristic: look for a page heading that reads our class title or fallback markers.
    const candidates = Array.from(document.querySelectorAll('main, [class*="lerna-panel"], [data-page]'));
    for (const panel of candidates) {
      const h = panel.querySelector('h1, h2');
      if (!h) continue;
      const txt = (h.textContent || '').trim();
      if (/^(班級|我的班級|Class(es)?|My Class(es)?)$/i.test(txt)) return panel;
    }
    return null;
  }

  function ensureMount() {
    const panel = findClassPage();
    if (!panel) {
      if (_host && _host.parentNode) _host.parentNode.removeChild(_host);
      _hiddenNodes.forEach(n => { try { n.style.display = ''; } catch (e) {} });
      _hiddenNodes = []; _host = null;
      return;
    }
    if (_host && _host.parentNode === panel) return; // already mounted
    // Hide siblings inside panel (keep heading)
    const kids = Array.from(panel.children);
    _hiddenNodes = kids.filter(k => !k.classList.contains('v24c-root'));
    _hiddenNodes.forEach(n => { n.style.display = 'none'; });
    _host = document.createElement('div');
    _host.className = 'v24c-root';
    panel.appendChild(_host);
    render(_host);
  }

  function observe() {
    const ob = new MutationObserver(() => { try { ensureMount(); } catch (e) {} });
    ob.observe(document.body, { childList: true, subtree: true });
    setInterval(() => { try { ensureMount(); } catch (e) {} }, 800);
    window.addEventListener('storage', (e) => {
      if (e.key === APP_KEY && _host) { try { render(_host); } catch (err) {} }
    });
  }

  // ========== Boot ==========
  function boot() {
    injectStyle();
    observe();
    try { ensureMount(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose hooks for Codex to plug in without hunting the scope
  window.__ypt_v24_class = {
    getState, updateState, activeClass, dispatch, render,
    readV24, writeV24, T, toast, SCREENS, NAV, DEFAULT_CLASS
  };
})();

    