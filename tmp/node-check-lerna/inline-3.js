
/* ============================================================
   Lerna AI Sidecar  (layered on top of YPT++ v20)
   ------------------------------------------------------------
   - Does NOT modify the v20 React bundle.
   - Reads v20 state from localStorage key: "ypt_app_state_v6"
   - Stores AI state in separate key: "lerna_ai_v1"
   - Renders a Shadow-DOM floating button + panel so styles
     don't collide with v20's Tailwind.
   - All P0 + P1 + P2 features included.
   ============================================================ */
(() => {
  if (window.__lernaAI__) return;
  window.__lernaAI__ = true;

  /* ---------- 1. Storage helpers ---------- */
  const YPT_KEY = 'ypt_app_state_v6';
  const AI_KEY  = 'lerna_ai_v1';

  const loadYPT = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(YPT_KEY));
      return raw ? (raw.state || raw) : null;
    } catch {
      return null;
    }
  };
  const saveYPT = (s) => {
    try { localStorage.setItem(YPT_KEY, JSON.stringify(s)); }
    catch (e) { console.error('[LernaAI] saveYPT failed', e); }
  };
  const isAccentHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');
  const getLiveAccentHex = () => {
    try {
      const live = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (isAccentHex(live)) return live;
    } catch {}
    const stored = loadYPT()?.settings?.accent;
    return isAccentHex(stored) ? stored : '#4a7c74';
  };
  const mixAccent = (hex, pct) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mix = (c) => Math.round(c + (255 - c) * pct).toString(16).padStart(2, '0');
    return `#${mix(r)}${mix(g)}${mix(b)}`;
  };
  const darkenAccent = (hex, pct) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const h = (c) => Math.max(0, Math.round(c * (1 - pct))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  };

  const defaultAI = () => ({
    apiKey: '',
    model: 'gemini-2.5-flash-lite',
    chats: [],              // [{id,title,messages:[{role,content,ts}],createdAt}]
    pendingCards: [],       // [{id,subjectId,source,cards:[{front,back}],createdAt}]
    mistakes: [],           // [{id,subjectId,question,wrong,correct,note,ease,interval,due,createdAt}]
    voiceWords: [],         // [{id,word,definition,examples,ipa,audioNote,createdAt}]
    buddy: { streak: 0, lastCheckIn: null, points: 0, name: 'Lumi', mood: 'chill' },
    weeklyReports: [],      // [{id,range,html,createdAt}]
    pendingPlan: null,      // {days:[{date,blocks:[{title,startTime,endTime,subjectId}]}]}
    sessionReflections: {}  // {sessionId: {summary, encouragement}}
  });
  const I18N = {
    zh: {
      'ai.title': 'Lerna AI',
      'ai.close': '關閉',
      'ai.fabTitle': 'Lerna AI 助手 (Ctrl+I)',
      'tabs.tutor': '家教',
      'tabs.cards': '字卡',
      'tabs.notes': '筆記',
      'tabs.mistakes': '錯題',
      'tabs.plan': '計畫',
      'tabs.reflect': '反思',
      'tabs.report': '週報',
      'tabs.ocr': 'OCR',
      'tabs.voice': '語音',
      'tabs.buddy': 'Buddy',
      'tabs.settings': '⚙︎',
      'key.missing': '尚未設定 Gemini API Key',
      'key.openSettings': '前往設定',
      'key.getFree': '免費取得',
      'key.recommend': '建議用 <b>gemini-2.5-flash-lite</b>（免費層 1000 req/day）',
      'key.localOnly': 'Key 只存你本機 localStorage，不會上傳給我們。',
      'common.failed': '失敗',
      'common.delete': '刪除',
      'common.save': '儲存',
      'common.run': '執行',
      'common.searching': '查詢中…',
      'common.untitled': '(無標題)',
      'common.none': '(無)',
      'common.noRecord': '(沒有紀錄)',
      'common.noNotes': '(沒有筆記)',
      'ctx.noHistory': '尚未使用過 Lerna — 無歷史資料',
      'ctx.subjects': '科目',
      'ctx.today': '今日學習',
      'ctx.last7': '近 7 日',
      'ctx.countdowns': '重要倒數',
      'ctx.cards': '卡片數',
      'ctx.tasks': '待辦',
      'cards.generatedDeckSuffix': 'AI 生成',
      'plan.defaultTitle': '讀書',
      'voice.stop': '🔴 停止',
      'voice.unsupported': '此瀏覽器不支援 Web Speech API — 請用 Chrome / Edge，或直接輸入。',
      'voice.insecureHint': '目前不是 https / localhost，瀏覽器可能阻擋麥克風或語音辨識。建議改用安全來源、localhost，或本地 web server 載入。',
      'voice.error.permission': '麥克風權限被拒，請在瀏覽器網址列點鎖頭重新授權。',
      'voice.error.noSpeech': '沒偵測到聲音，請再試一次。',
      'voice.error.audioCapture': '找不到可用的麥克風，請確認裝置或系統輸入來源。',
      'voice.error.network': '語音辨識連線失敗，請檢查網路後再試。',
      'voice.error.serviceNotAllowed': '這個瀏覽器環境不允許語音辨識服務，請改用 Chrome / Edge。',
      'voice.error.aborted': '語音辨識已中止。',
      'voice.error.generic': '麥克風啟動失敗，請再試一次。',
      'voice.error.fileHint': 'file:// 可能被瀏覽器阻擋，可改用本地 web server（如 npx serve）載入。',
      'voice.error.originHint': '目前不是 https / localhost，請改用安全來源或本地 web server 載入。',
      'voice.error.noTranscript': '有開啟麥克風，但瀏覽器沒有回傳語音辨識結果。',
      'voice.error.noTranscriptHint': '請改用 Chrome / Edge，或改用本地 web server 載入。',
      'voice.error.startPrefix': '麥克風啟動失敗',
      'buddy.noApi': '（設定 API Key 後我才有話說）',
      'buddy.error': 'Buddy 卡住了',
      'settings.importSuccess': '匯入成功',
      'settings.invalidFile': '檔案無效',
      'settings.resetConfirm': '清空所有 AI 資料？(不會動到 Lerna 主資料)',
      'settings.resetDone': '已清空',
      'settings.apiOk': 'API 正常',
      'settings.exportFile': 'lerna-ai',
      'session.newReflection': '偵測到新反思 — 點 AI 按鈕 → 反思頁深化'
    },
    en: {
      'ai.title': 'Lerna AI',
      'ai.close': 'Close',
      'ai.fabTitle': 'Lerna AI assistant (Ctrl+I)',
      'tabs.tutor': 'Tutor',
      'tabs.cards': 'Cards',
      'tabs.notes': 'Notes',
      'tabs.mistakes': 'Mistakes',
      'tabs.plan': 'Plan',
      'tabs.reflect': 'Reflect',
      'tabs.report': 'Report',
      'tabs.ocr': 'OCR',
      'tabs.voice': 'Voice',
      'tabs.buddy': 'Buddy',
      'tabs.settings': '⚙︎',
      'key.missing': 'No Gemini API key yet',
      'key.openSettings': 'Open settings',
      'key.getFree': 'Get one free',
      'key.recommend': 'Recommended: <b>gemini-2.5-flash-lite</b> (free tier 1000 req/day)',
      'key.localOnly': 'The key stays in your browser localStorage and is never sent to us.',
      'common.failed': 'Failed',
      'common.delete': 'Delete',
      'common.save': 'Save',
      'common.run': 'Run',
      'common.searching': 'Looking up…',
      'common.untitled': '(Untitled)',
      'common.none': '(none)',
      'common.noRecord': '(No records)',
      'common.noNotes': '(No notes)',
      'ctx.noHistory': 'Lerna has no history yet',
      'ctx.subjects': 'Subjects',
      'ctx.today': 'Today',
      'ctx.last7': 'Last 7 days',
      'ctx.countdowns': 'Countdowns',
      'ctx.cards': 'Cards',
      'ctx.tasks': 'Tasks',
      'cards.generatedDeckSuffix': 'AI generated',
      'plan.defaultTitle': 'Study',
      'voice.stop': '🔴 Stop',
      'voice.unsupported': 'This browser does not support the Web Speech API — use Chrome / Edge, or type instead.',
      'voice.insecureHint': 'This page is not on https / localhost, so the browser may block microphone or speech recognition. Prefer a secure origin, localhost, or a local web server.',
      'voice.error.permission': 'Microphone permission was denied. Click the lock icon in the address bar and allow it, then try again.',
      'voice.error.noSpeech': 'No speech was detected. Please try again.',
      'voice.error.audioCapture': 'No usable microphone was found. Check your device and system input settings.',
      'voice.error.network': 'Speech recognition hit a network error. Check your connection and try again.',
      'voice.error.serviceNotAllowed': 'This browser environment does not allow the speech recognition service. Use Chrome / Edge instead.',
      'voice.error.aborted': 'Speech recognition was aborted.',
      'voice.error.generic': 'Could not start the microphone. Please try again.',
      'voice.error.fileHint': 'file:// may be blocked by the browser. Try loading the page from a local web server such as npx serve.',
      'voice.error.originHint': 'This page is not running on https / localhost. Try a secure origin or a local web server.',
      'voice.error.noTranscript': 'The microphone opened, but the browser never returned a speech transcript.',
      'voice.error.noTranscriptHint': 'Try Chrome / Edge, or load the page from a local web server.',
      'voice.error.startPrefix': 'Microphone start failed',
      'buddy.noApi': '(I need an API key before I can talk.)',
      'buddy.error': 'Buddy got stuck',
      'settings.importSuccess': 'Import successful',
      'settings.invalidFile': 'Invalid file',
      'settings.resetConfirm': 'Clear all AI data? (This will not touch the main Lerna data.)',
      'settings.resetDone': 'Cleared',
      'settings.apiOk': 'API OK',
      'settings.exportFile': 'lerna-ai',
      'session.newReflection': 'New reflection detected — open AI and continue in Reflect.'
    }
  };
  const getLang = () => (loadYPT()?.settings?.lang === 'en' ? 'en' : 'zh');
  const getLocale = () => (getLang() === 'en' ? 'en-US' : 'zh-TW');
  const t = (key, vars = {}) => {
    const msg = (I18N[getLang()] && I18N[getLang()][key]) ?? I18N.zh[key] ?? key;
    return String(msg).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  const langText = (zh, en) => (getLang() === 'en' ? en : zh);
  const formatDate = (value, options) => new Date(value).toLocaleDateString(getLocale(), options);
  const formatDateTime = (value, options) => new Date(value).toLocaleString(getLocale(), options);
  const PLAN_PACE_OPTIONS = [
    { value: 'relaxed', zh: '輕鬆', en: 'Relaxed' },
    { value: 'balanced', zh: '平衡', en: 'Balanced' },
    { value: 'sprint', zh: '衝刺', en: 'Sprint' },
    { value: 'exam', zh: '考前狂暴', en: 'Exam crunch' }
  ];
  const normalizePlanPace = (value) => {
    const aliases = {
      '輕鬆': 'relaxed',
      '平衡': 'balanced',
      '衝刺': 'sprint',
      '考前狂暴': 'exam',
      relaxed: 'relaxed',
      balanced: 'balanced',
      sprint: 'sprint',
      exam: 'exam'
    };
    return aliases[value] || 'balanced';
  };
  const getPlanPaceLabel = (value) => {
    const option = PLAN_PACE_OPTIONS.find((x) => x.value === value) || PLAN_PACE_OPTIONS[1];
    return getLang() === 'en' ? option.en : option.zh;
  };
  const getBuddyMoodLabel = (value) => {
    const map = {
      chill: langText('佛系', 'chill'),
      hyped: langText('興奮', 'hyped'),
      strict: langText('嚴格', 'strict'),
      wise: langText('睿智', 'wise'),
      silly: langText('搞怪', 'silly')
    };
    return map[value] || value;
  };
  const loadAI = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(AI_KEY));
      return Object.assign(defaultAI(), raw || {});
    } catch { return defaultAI(); }
  };
  const saveAI = (s) => {
    try { localStorage.setItem(AI_KEY, JSON.stringify(s)); }
    catch (e) { console.error('[LernaAI] saveAI failed', e); }
  };
  let AI = loadAI();
  const updateAI = (patch) => {
    AI = typeof patch === 'function' ? patch(AI) : Object.assign({}, AI, patch);
    saveAI(AI);
    render();
  };

  /* ---------- 2. Gemini client ---------- */
  // Uses v1beta generateContent REST endpoint. Free tier for flash-lite.
  // Docs: https://ai.google.dev/gemini-api/docs
  async function gemini({prompt, system, images = [], model, json = false}) {
    const useModel = model || AI.model || 'gemini-2.5-flash-lite';
    if (!AI.apiKey) throw new Error(langText('請先到設定頁填入 Gemini API Key', 'Please add your Gemini API key in Settings first'));
    const parts = [];
    if (system) parts.push({ text: 'SYSTEM INSTRUCTION:\n' + system + '\n\n' });
    for (const im of images) parts.push({ inline_data: { mime_type: im.mime, data: im.data } });
    parts.push({ text: prompt });
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: json
        ? { responseMimeType: 'application/json', temperature: 0.4 }
        : { temperature: 0.6 }
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(AI.apiKey)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(langText('Gemini API 錯誤 ', 'Gemini API error ') + r.status + ': ' + txt.slice(0, 300));
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    return { text, raw: j };
  }

  /* ---------- 3. Subject / state utilities ---------- */
  const ctxSummary = () => {
    const s = loadYPT();
    if (!s) return { hasState: false, summary: t('ctx.noHistory') };
    const subs = (s.subjects || []).map(x => `${x.name}(${x.id})`).join(', ');
    const sess = s.sessions || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySess = sess.filter(se => (se.startedAt || '').slice(0, 10) === todayStr);
    const todayMin = todaySess.reduce((a, b) => a + (b.duration || 0) / 60, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const weekSess = sess.filter(se => new Date(se.startedAt || 0) >= weekStart);
    const weekMin = weekSess.reduce((a, b) => a + (b.duration || 0) / 60, 0);
    const countdowns = (s.countdowns || []).map(c => `${c.title}@${c.date}`).join('; ');
    return {
      hasState: true,
      state: s,
      summary:
`${t('ctx.subjects')}: ${subs || t('common.none')}
${t('ctx.today')}: ${Math.round(todayMin)} ${langText('分鐘', 'minutes')} (${todaySess.length} ${langText('節', 'sessions')})
${t('ctx.last7')}: ${Math.round(weekMin)} ${langText('分鐘', 'minutes')} (${weekSess.length} ${langText('節', 'sessions')})
${t('ctx.countdowns')}: ${countdowns || t('common.none')}
${t('ctx.cards')}: ${(s.decks || []).reduce((a, d) => a + (d.cards?.length || 0), 0)}
${t('ctx.tasks')}: ${(s.tasks || []).filter(t => !t.done).length}`
    };
  };

  /* ---------- 4. Apply generated content back into v20 state ---------- */
  const applyCardsToV20 = (subjectId, cards) => {
    const s = loadYPT() || {};
    s.decks = s.decks || [];
    let deck = s.decks.find(d => d.subjectId === subjectId);
    if (!deck) {
        deck = {
          id: 'deck_' + Date.now(),
          subjectId,
          name: (s.subjects?.find(x => x.id === subjectId)?.name || t('common.none')) + ' — ' + t('cards.generatedDeckSuffix'),
          cards: [],
          createdAt: new Date().toISOString()
        };
      s.decks.push(deck);
    }
    const now = Date.now();
    cards.forEach((c, i) => {
      deck.cards.push({
        id: 'card_' + now + '_' + i,
        front: c.front || c.q || '',
        back: c.back || c.a || '',
        ease: 2.5, interval: 0, due: new Date().toISOString(),
        starred: false, mastered: false, learning: true,
        createdAt: new Date().toISOString(),
        source: 'ai'
      });
    });
    saveYPT(s);
    return deck;
  };

  const applyPlanToV20 = (plan) => {
    const s = loadYPT() || {};
    s.studyBlocks = s.studyBlocks || [];
    const now = Date.now();
    let added = 0;
    (plan.days || []).forEach(day => {
      (day.blocks || []).forEach((b, i) => {
        s.studyBlocks.push({
          id: 'blk_ai_' + now + '_' + (added++),
          title: b.title || t('plan.defaultTitle'),
          date: day.date,
          startTime: b.startTime,
          endTime: b.endTime,
          subjectId: b.subjectId || null,
          taskId: b.taskId || null,
          createdAt: new Date().toISOString(),
          source: 'ai'
        });
      });
    });
    saveYPT(s);
    return added;
  };

  const applyNoteToV20 = (subjectId, title, body) => {
    const s = loadYPT() || {};
    s.notes = s.notes || [];
    const note = {
      id: 'note_ai_' + Date.now(),
      subjectId,
      title,
      body,
      createdAt: new Date().toISOString(),
      source: 'ai'
    };
    s.notes.push(note);
    saveYPT(s);
    return note;
  };

  /* ---------- 5. SM-2 for mistake-book review ---------- */
  const sm2 = (item, quality) => {
    // quality: 0-5 (0 = complete blackout, 5 = perfect)
    let ease = item.ease ?? 2.5;
    let interval = item.interval ?? 0;
    if (quality < 3) {
      interval = 0;
    } else {
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6;
      else interval = Math.round(interval * ease);
    }
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const due = new Date(); due.setDate(due.getDate() + interval);
    return { ...item, ease, interval, due: due.toISOString() };
  };

  /* ---------- 6. Shadow DOM host + styles ---------- */
  const host = document.createElement('div');
  host.id = 'lerna-ai-host';
  host.style.all = 'initial';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const syncShadowAccentVars = (hex = getLiveAccentHex()) => {
    const next = isAccentHex(hex) ? hex : '#4a7c74';
    host.style.setProperty('--lerna-accent', next);
    host.style.setProperty('--lerna-accent-soft', mixAccent(next, 0.92));
    host.style.setProperty('--lerna-accent-border', mixAccent(next, 0.70));
    host.style.setProperty('--lerna-accent-dark', darkenAccent(next, 0.18));
  };

  const style = document.createElement('style');
  style.textContent = `
    :host {
      --lerna-accent: #4a7c74;
      --lerna-accent-soft: #f0f7f5;
      --lerna-accent-border: #d4e7e4;
      --lerna-bg: #faf9f6;
      --lerna-surface: #ffffff;
      --lerna-muted: #f5f3ef;
      --lerna-border: #e5e2dc;
      --lerna-border-soft: #f0ede8;
      --lerna-text: #1a1a1a;
      --lerna-text-muted: #6b7280;
      --lerna-text-subtle: #9ca3af;
    }
    :host, * { box-sizing: border-box; }
    .fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      width: 56px; height: 56px; border-radius: 50%; border: 1px solid var(--lerna-border);
      background: var(--lerna-surface);
      color: var(--lerna-text); font-size: 22px; font-weight: 700; cursor: pointer;
      box-shadow: 0 10px 24px rgba(26,26,26,.12);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s, box-shadow .15s;
    }
    .fab:hover { transform: scale(1.05); box-shadow: 0 14px 28px rgba(26,26,26,.18); }
    .fab .dot { position:absolute; top:6px; right:6px; width:10px; height:10px;
      border-radius:50%; background:var(--lerna-accent); box-shadow:0 0 0 2px var(--lerna-surface); }
    .panel {
      position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
      width: min(440px, calc(100vw - 40px));
      height: min(640px, calc(100vh - 120px));
      background: var(--lerna-bg); color: var(--lerna-text);
      border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(26,26,26,.18);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
      font-size: 14px; line-height: 1.5;
      border: 1px solid var(--lerna-border);
    }
    .panel.hidden { display: none; }
    .panel header {
      padding: 12px 16px; background: var(--lerna-surface);
      display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid var(--lerna-border-soft);
    }
    .panel header .title-icon { width: 22px; height: 22px; display: inline-block; vertical-align: middle; margin-right: 6px; }
      .title { font-weight: 700; font-size: 15px; color: var(--lerna-text); }
    .panel header .grow { flex: 1; }
    .panel header button {
      background: transparent; border: 0; color: var(--lerna-text-muted); cursor: pointer;
      padding: 4px 8px; font-size: 16px; border-radius: 6px;
    }
    .panel header button:hover { color: var(--lerna-text); background: var(--lerna-muted); }
    .tabs { display: flex; gap: 2px; padding: 4px 10px 0; background: var(--lerna-surface);
      overflow-x: auto; scrollbar-width: thin; border-bottom: 1px solid var(--lerna-border-soft); }
    .tabs::-webkit-scrollbar { height: 4px; }
    .tabs button {
      background: transparent; border: 0; color: var(--lerna-text-muted);
      padding: 8px 10px 10px; border-radius: 0; cursor: pointer;
      font-size: 12px; white-space: nowrap; font-weight: 500;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: color .12s, border-color .12s;
    }
    .tabs button.active { color: var(--lerna-accent); border-bottom-color: var(--lerna-accent); font-weight: 600; }
    .tabs button:hover:not(.active) { color: var(--lerna-text); }
    .body { flex: 1; overflow-y: auto; padding: 14px 16px; background: var(--lerna-bg); }
    .body::-webkit-scrollbar { width: 6px; }
    .body::-webkit-scrollbar-thumb { background: var(--lerna-border); border-radius: 3px; }
    .footer { padding: 10px 12px; border-top: 1px solid var(--lerna-border-soft); background: var(--lerna-surface); }

    input, textarea, select {
      width: 100%; padding: 8px 10px; border-radius: 8px;
      background: var(--lerna-surface); color: var(--lerna-text); border: 1px solid var(--lerna-border);
      font-size: 13px; font-family: inherit;
    }
    textarea { resize: vertical; min-height: 70px; }
    input:focus, textarea:focus, select:focus { outline: 0; border-color: var(--lerna-accent); box-shadow: 0 0 0 3px var(--lerna-accent-soft); }
    label.field { display:block; font-size:12px; color: var(--lerna-text-muted); margin:10px 0 4px; }

    button.btn {
      padding: 8px 12px; border-radius: 8px; border: 1px solid var(--lerna-border);
      background: var(--lerna-surface); color: var(--lerna-text); cursor: pointer; font-size: 13px;
      font-family: inherit; font-weight: 500; transition: background .12s, border-color .12s;
    }
    button.btn:hover { background: var(--lerna-muted); }
    button.btn.primary { background: var(--lerna-accent); color: #fff; border-color: var(--lerna-accent); }
    button.btn.primary:hover { filter: brightness(1.08); background: var(--lerna-accent); }
    button.btn.ghost { background: transparent; border-color: transparent; }
    button.btn.danger { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    button.btn.danger:hover { background: #fee2e2; }
    button.btn[disabled] { opacity:.5; cursor: not-allowed; }
    .row { display:flex; gap:8px; align-items:center; }
    .row > * { flex: none; }
    .row.wrap { flex-wrap: wrap; }
    .grow { flex: 1; }

    .msg { padding: 10px 12px; border-radius: 10px; margin-bottom: 8px;
      white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--lerna-border-soft); }
    .msg.user { background: var(--lerna-surface); }
    .msg.ai { background: var(--lerna-accent-soft); border-color: var(--lerna-accent-border); color: var(--lerna-text); }
    .msg.sys { background: var(--lerna-muted); color: var(--lerna-text-muted); font-size:12px; }

    .card-preview { background: var(--lerna-surface); border-radius:10px; padding:10px; margin-bottom:8px;
      border: 1px solid var(--lerna-border); }
    .card-preview .front { font-weight:600; color: var(--lerna-text); margin-bottom:4px; }
    .card-preview .back { color: var(--lerna-text-muted); font-size:13px; }

    .chip { display:inline-block; padding:2px 8px; border-radius:999px;
      background: var(--lerna-muted); color: var(--lerna-text-muted); font-size:11px; margin-right:4px;
      border: 1px solid var(--lerna-border-soft); }
    .chip.ok { background: var(--lerna-accent-soft); color: var(--lerna-accent); border-color: var(--lerna-accent-border); }
    .chip.warn { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .chip.ai { background: var(--lerna-accent); color: #fff; border-color: var(--lerna-accent); }

    .empty { text-align:center; color: var(--lerna-text-subtle); padding:30px 10px; font-size:13px; }
    h3 { margin: 4px 0 8px; font-size:14px; color: var(--lerna-text); font-weight: 600; }
    hr.sep { border:0; border-top: 1px solid var(--lerna-border-soft); margin:12px 0; }
    .loading { color: var(--lerna-accent); font-size:12px; }
    .kbd { font-family: ui-monospace, monospace; background: var(--lerna-muted); padding:1px 5px; border-radius:4px; font-size:11px; border:1px solid var(--lerna-border-soft); }
    a { color: var(--lerna-accent); }
    a:hover { text-decoration: underline; }
    details { background: var(--lerna-surface); border:1px solid var(--lerna-border-soft); border-radius:8px; padding:6px 10px; margin-bottom:6px; }
    details summary { cursor:pointer; color: var(--lerna-text); font-size:13px; }
    .toast {
      position: fixed; left: 50%; top: 30px; transform: translateX(-50%);
      padding: 8px 16px; border-radius: 8px; background: var(--lerna-accent); color:#fff;
      z-index: 2147483647; font-size:13px; animation: fade 2.5s forwards;
      box-shadow: 0 8px 20px rgba(26,26,26,.2);
    }
    .toast.err { background:#b91c1c; color:#fff; }
    @keyframes fade { 0%{opacity:0;transform:translate(-50%,-8px);} 10%,85%{opacity:1;transform:translate(-50%,0);} 100%{opacity:0;transform:translate(-50%,-8px);} }
    .badge-buddy { display:inline-flex; align-items:center; gap:4px;
      padding: 2px 8px; border-radius: 999px; background: var(--lerna-muted); font-size:11px; color: var(--lerna-text-muted);
      border: 1px solid var(--lerna-border-soft); }
  `;
  shadow.appendChild(style);

  const toast = (msg, err = false) => {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    shadow.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  };

  /* ---------- 7. UI state ---------- */
  const ui = {
    open: false,
    tab: 'tutor',  // tutor | cards | notes | mistakes | plan | reflect | report | ocr | voice | buddy | settings
    tutorInput: '',
    tutorChatId: null,
    loading: null,
    drafts: {}     // per-tab scratch
  };

  /* ---------- 8. Panel & FAB containers ---------- */
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:28px;height:28px">
      <!-- Compass left leg (needle side) -->
      <line x1="24" y1="11" x2="15" y2="40" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round"/>
      <!-- Compass right leg (pencil side) -->
      <line x1="24" y1="11" x2="33" y2="40" stroke="#8b5a3c" stroke-width="2.6" stroke-linecap="round"/>
      <!-- Hinge joint -->
      <circle cx="24" cy="11" r="3" fill="#6b4423"/>
      <circle cx="24" cy="11" r="1" fill="#faf9f6"/>
      <!-- Needle point -->
      <circle cx="15" cy="40" r="1.6" fill="#1a1a1a"/>
      <!-- Pencil point -->
      <polygon points="32,38 33,41 34.5,38" fill="#1a1a1a"/>
      <!-- Small 2-tone rectangle -->
      <rect x="34" y="20" width="12" height="8" rx="1" fill="#f2ede2" stroke="#8b5a3c" stroke-width="0.9"/>
      <rect x="34" y="20" width="6" height="8" rx="1" fill="var(--lerna-accent-border)"/>
    </svg>
    <span class="dot"></span>`;
  fab.title = t('ai.fabTitle');
  fab.addEventListener('click', () => { ui.open = !ui.open; render(); });
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'panel hidden';
  shadow.appendChild(panel);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault(); ui.open = !ui.open; render();
    }
  });

  /* ---------- 9. Rendering ---------- */
  const esc = (s) => (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const render = () => {
    panel.className = 'panel' + (ui.open ? '' : ' hidden');
    panel.setAttribute('lang', getLang() === 'en' ? 'en' : 'zh-Hant');
    fab.title = t('ai.fabTitle');
    if (!ui.open) return;
    panel.innerHTML = `
      <header>
        <span class="title"><svg class="title-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="24" y1="11" x2="15" y2="40" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round"/><line x1="24" y1="11" x2="33" y2="40" stroke="#8b5a3c" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="11" r="3" fill="#6b4423"/><circle cx="24" cy="11" r="1" fill="#faf9f6"/><circle cx="15" cy="40" r="1.6" fill="#1a1a1a"/><polygon points="32,38 33,41 34.5,38" fill="#1a1a1a"/><rect x="34" y="20" width="12" height="8" rx="1" fill="#f2ede2" stroke="#8b5a3c" stroke-width="0.9"/><rect x="34" y="20" width="6" height="8" rx="1" fill="var(--lerna-accent-border)"/></svg>${t('ai.title')}</span>
        <span class="chip ai">${esc(AI.model)}</span>
        <span class="grow"></span>
        <span class="badge-buddy" title="${esc(langText('學習 Buddy', 'Study Buddy'))}">🔥 ${AI.buddy.streak}${langText('天', 'd')} · ${AI.buddy.points}${langText('點', 'pt')}</span>
        <button id="ai-close" title="${esc(t('ai.close'))}">✕</button>
      </header>
      <div class="tabs" id="ai-tabs">
        ${tabBtn('tutor', t('tabs.tutor'))}
        ${tabBtn('cards', t('tabs.cards'))}
        ${tabBtn('notes', t('tabs.notes'))}
        ${tabBtn('mistakes', t('tabs.mistakes'))}
        ${tabBtn('plan', t('tabs.plan'))}
        ${tabBtn('reflect', t('tabs.reflect'))}
        ${tabBtn('report', t('tabs.report'))}
        ${tabBtn('ocr', t('tabs.ocr'))}
        ${tabBtn('voice', t('tabs.voice'))}
        ${tabBtn('buddy', t('tabs.buddy'))}
        ${tabBtn('settings', t('tabs.settings'))}
      </div>
      <div class="body" id="ai-body"></div>
    `;
    panel.querySelector('#ai-close').onclick = () => { ui.open = false; render(); };
    panel.querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => { ui.tab = b.dataset.tab; render(); };
    });
    const body = panel.querySelector('#ai-body');
    const r = renderers[ui.tab] || renderers.tutor;
    r(body);
  };

  const tabBtn = (id, label) =>
    `<button data-tab="${id}" class="${ui.tab === id ? 'active' : ''}">${label}</button>`;

  const ensureKey = (body) => {
    if (AI.apiKey) return true;
    body.innerHTML = `
      <div class="empty">
        <p>${t('key.missing')}</p>
        <button class="btn primary" id="go-settings">${t('key.openSettings')}</button>
        <p style="margin-top:18px;font-size:12px;color:var(--lerna-text-muted)">
          ${t('key.getFree')}: <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a><br/>
          ${t('key.recommend')}<br/>
          ${t('key.localOnly')}
        </p>
      </div>
    `;
    body.querySelector('#go-settings').onclick = () => { ui.tab = 'settings'; render(); };
    return false;
  };

  const renderers = {};

  /* ---------- 9a. TUTOR ---------- */
  renderers.tutor = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const chats = AI.chats;
    if (!ui.tutorChatId && chats.length) ui.tutorChatId = chats[0].id;
    const chat = chats.find(c => c.id === ui.tutorChatId);
    body.innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <select id="chat-sel" class="grow">
          <option value="">${langText('— 新對話 —', '— New chat —')}</option>
          ${chats.map(c => `<option value="${c.id}" ${c.id === ui.tutorChatId ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}
        </select>
        <button class="btn" id="new-chat">＋</button>
        ${chat ? `<button class="btn danger" id="del-chat">🗑</button>` : ''}
      </div>
      <div id="chat-msgs">
        ${(chat?.messages || []).map(m =>
          `<div class="msg ${m.role}">${m.role === 'user' ? '' : '🤖 '}${esc(m.content)}</div>`
        ).join('') || `<div class="empty">${esc(langText('問我任何讀書/學科問題 — 我知道你現在在讀什麼', 'Ask anything about what you are studying — I know your current learning context.'))}</div>`}
      </div>
      ${ui.loading === 'tutor' ? `<div class="loading">${langText('思考中…', 'Thinking…')}</div>` : ''}
      <hr class="sep"/>
      <textarea id="tutor-input" placeholder="${esc(langText('問任何問題… (Ctrl+Enter 送出)', 'Ask anything… (Ctrl+Enter to send)'))}">${esc(ui.tutorInput)}</textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn primary grow" id="tutor-send">${langText('送出', 'Send')}</button>
        <button class="btn" id="tutor-ctx">🧠 ${langText('插入學習脈絡', 'Insert learning context')}</button>
      </div>
    `;
    body.querySelector('#chat-sel').onchange = (e) => {
      ui.tutorChatId = e.target.value || null; render();
    };
    body.querySelector('#new-chat').onclick = () => { ui.tutorChatId = null; render(); };
    const delBtn = body.querySelector('#del-chat');
    if (delBtn) delBtn.onclick = () => {
      if (!confirm(langText('刪除這個對話？', 'Delete this conversation?'))) return;
      updateAI({ chats: AI.chats.filter(c => c.id !== ui.tutorChatId) });
      ui.tutorChatId = null; render();
    };
    const inp = body.querySelector('#tutor-input');
    inp.oninput = (e) => { ui.tutorInput = e.target.value; };
    inp.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') body.querySelector('#tutor-send').click(); };
    body.querySelector('#tutor-ctx').onclick = () => {
      const c = ctxSummary();
      ui.tutorInput = (ui.tutorInput ? ui.tutorInput + '\n\n' : '') + langText('[我目前的狀態]\n', '[My current learning context]\n') + c.summary;
      render();
    };
    body.querySelector('#tutor-send').onclick = async () => {
      const q = ui.tutorInput.trim();
      if (!q) return;
      let c = chats.find(x => x.id === ui.tutorChatId);
      if (!c) {
        c = { id: 'chat_' + Date.now(), title: q.slice(0, 30), messages: [], createdAt: new Date().toISOString() };
        AI.chats.unshift(c);
        ui.tutorChatId = c.id;
      }
      c.messages.push({ role: 'user', content: q, ts: Date.now() });
      ui.tutorInput = '';
      ui.loading = 'tutor';
      saveAI(AI); render();
      try {
        const ctx = ctxSummary().summary;
        const sys = isEn
          ? `You are a warm, patient tutor who can teach across subjects. The student's current learning context is:\n${ctx}\nWhen you answer: 1) give the answer clearly first; 2) explain the core idea; 3) include one small practice task when useful. Be concise and avoid filler.`
          : `你是一位溫暖、耐心、精通各科的家教，用繁體中文回答。學生目前的學習狀態:\n${ctx}\n回答時：1) 先給出清楚答案；2) 解釋核心概念；3) 若適合，出 1 個小練習。避免廢話。`;
        const history = c.messages.slice(-10).map(m => `${m.role === 'user' ? langText('學生', 'Student') : langText('老師', 'Tutor')}: ${m.content}`).join('\n\n');
        const { text } = await gemini({ prompt: history, system: sys });
        c.messages.push({ role: 'ai', content: text, ts: Date.now() });
        if (c.messages.length === 2) {
          try {
            const titleResp = await gemini({
              prompt: isEn
                ? `Summarize this conversation in a short English title of 6 words or fewer: ${q}`
                : `用 6 字以內中文標題總結此對話主題: ${q}`,
              system: isEn ? 'Reply with the plain title only. No quotes.' : '只回標題純文字，無引號。'
            });
            c.title = (titleResp.text || q).slice(0, 24).replace(/[\n"“”「」]/g, '');
          } catch {}
        }
      } catch (e) {
        c.messages.push({ role: 'sys', content: langText('錯誤: ', 'Error: ') + e.message, ts: Date.now() });
      }
      ui.loading = null;
      saveAI(AI); render();
    };
  };

  /* ---------- 9b. CARDS (AutoCard) ---------- */
  renderers.cards = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const d = ui.drafts.cards || (ui.drafts.cards = { subjectId: subs[0]?.id || '', source: '', count: 10 });
    body.innerHTML = `
      <h3>AutoCard · ${langText('自動出字卡', 'Generate flashcards')}</h3>
      <label class="field">${langText('科目', 'Subject')}</label>
      <select id="c-sub">
        ${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        ${subs.length === 0 ? `<option value="">${langText('(請先在主畫面建立科目)', '(Create a subject in the main app first)')}</option>` : ''}
      </select>
      <label class="field">${langText('貼上筆記 / 內容 / 章節', 'Paste notes / content / section')}</label>
      <textarea id="c-src" style="min-height:120px" placeholder="${esc(langText('貼上教科書片段、上課筆記、英文單字表…', 'Paste a textbook excerpt, class notes, or a vocabulary list…'))}">${esc(d.source)}</textarea>
      <div class="row" style="margin-top:8px">
        <label class="field" style="margin:0">${langText('張數', 'Count')}</label>
        <input id="c-n" type="number" min="3" max="30" value="${d.count}" style="width:80px"/>
        <button class="btn primary grow" id="c-gen">${langText('生成', 'Generate')}</button>
      </div>
      <hr class="sep"/>
      <h3>${langText('待套用的卡片', 'Pending cards')}</h3>
      <div id="c-pending">
        ${AI.pendingCards.length === 0
          ? `<div class="empty">${langText('還沒有 AI 生成的卡片', 'No AI-generated cards yet')}</div>`
          : AI.pendingCards.map(p => `
            <details>
              <summary>📚 ${esc(subs.find(x=>x.id===p.subjectId)?.name || t('common.none'))} · ${p.cards.length} ${langText('張', 'cards')} · ${formatDateTime(p.createdAt)}</summary>
              ${p.cards.map(c => `<div class="card-preview"><div class="front">${esc(c.front)}</div><div class="back">${esc(c.back)}</div></div>`).join('')}
              <div class="row">
                <button class="btn primary" data-apply="${p.id}">${langText('套用到 Lerna', 'Add to Lerna')}</button>
                <button class="btn danger" data-del="${p.id}">${t('common.delete')}</button>
              </div>
            </details>
          `).join('')}
      </div>
      ${ui.loading === 'cards' ? `<div class="loading">${langText('生成中…', 'Generating…')}</div>` : ''}
    `;
    body.querySelector('#c-sub').onchange = (e) => { d.subjectId = e.target.value; };
    body.querySelector('#c-src').oninput = (e) => { d.source = e.target.value; };
    body.querySelector('#c-n').oninput = (e) => { d.count = +e.target.value || 10; };
    body.querySelector('#c-gen').onclick = async () => {
      if (!d.source.trim()) { toast(langText('請先貼上內容', 'Paste some content first'), true); return; }
      ui.loading = 'cards'; render();
      try {
        const { text } = await gemini({
          prompt: isEn
            ? `Create ${d.count} flashcards from the content below. Output a JSON array [{"front":"question","back":"answer"}]. Keep front concise and clear, and back to 1-3 complete sentences.\n\nContent:\n${d.source}`
            : `從下列內容產出 ${d.count} 張繁體中文字卡。輸出 JSON 陣列 [{"front":"問題","back":"答案"}]，front 精簡明確，back 1-3 句完整。\n\n內容:\n${d.source}`,
          system: isEn ? 'You are a flashcard teacher. Return JSON only with no extra explanation.' : '你是字卡出題老師。只回 JSON，不要任何解釋。',
          json: true
        });
        const arr = JSON.parse(text);
        AI.pendingCards.unshift({
          id: 'pc_' + Date.now(),
          subjectId: d.subjectId,
          source: d.source.slice(0, 120),
          cards: arr,
          createdAt: new Date().toISOString()
        });
        d.source = '';
        saveAI(AI);
        toast(langText('生成 ', 'Generated ') + arr.length + langText(' 張卡片', ' cards'));
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
    body.querySelectorAll('[data-apply]').forEach(btn => {
      btn.onclick = () => {
        const p = AI.pendingCards.find(x => x.id === btn.dataset.apply);
        if (!p) return;
        const deck = applyCardsToV20(p.subjectId, p.cards);
        updateAI({ pendingCards: AI.pendingCards.filter(x => x.id !== p.id) });
        toast(langText('已加入「', 'Added to "') + deck.name + langText('」,重新載入頁面後可看到', '". Reload to see it.'));
        setTimeout(() => location.reload(), 800);
      };
    });
    body.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => updateAI({ pendingCards: AI.pendingCards.filter(x => x.id !== btn.dataset.del) });
    });
  };

  /* ---------- 9c. NOTES assistant ---------- */
  renderers.notes = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const notes = s.notes || [];
    const d = ui.drafts.notes || (ui.drafts.notes = { subjectId: subs[0]?.id || '', text: '', mode: 'summary', result: '' });
    body.innerHTML = `
      <h3>${langText('筆記助手', 'Notes assistant')}</h3>
      <label class="field">${langText('科目', 'Subject')}</label>
      <select id="n-sub">${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label class="field">${langText('模式', 'Mode')}</label>
      <select id="n-mode">
        <option value="summary" ${d.mode==='summary'?'selected':''}>📝 ${langText('摘要', 'Summary')}</option>
        <option value="expand" ${d.mode==='expand'?'selected':''}>🧩 ${langText('擴寫/補充', 'Expand / enrich')}</option>
        <option value="cleanup" ${d.mode==='cleanup'?'selected':''}>✨ ${langText('整理與清理', 'Clean up')}</option>
        <option value="outline" ${d.mode==='outline'?'selected':''}>🗂 ${langText('提綱結構化', 'Outline')}</option>
        <option value="translate" ${d.mode==='translate'?'selected':''}>🌐 ${langText('翻譯成繁中', 'Translate to English')}</option>
      </select>
      <label class="field">${langText('輸入', 'Input')}</label>
      <textarea id="n-txt" style="min-height:100px" placeholder="${esc(langText('貼上原始筆記 / 段落…', 'Paste raw notes or a paragraph…'))}">${esc(d.text)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="n-go">${t('common.run')}</button>
      </div>
      ${ui.loading==='notes'?`<div class="loading">${langText('處理中…', 'Processing…')}</div>`:''}
      ${d.result ? `
        <hr class="sep"/>
        <h3>${langText('結果', 'Result')}</h3>
        <div class="msg ai" style="white-space:pre-wrap">${esc(d.result)}</div>
        <div class="row">
          <input id="n-title" placeholder="${esc(langText('標題', 'Title'))}" value="${esc(d.title||langText('AI 筆記 ', 'AI note ') + formatDate(new Date()))}" class="grow"/>
          <button class="btn primary" id="n-save">${langText('存成 Lerna 筆記', 'Save as Lerna note')}</button>
        </div>` : ''}
      <hr class="sep"/>
      <h3>${langText('現有筆記', 'Existing notes')} (${notes.length})</h3>
      ${notes.slice(0,5).map(n=>`<details><summary>${esc(n.title||t('common.untitled'))}</summary><div class="msg sys" style="white-space:pre-wrap">${esc(n.body||'').slice(0,500)}</div></details>`).join('') || `<div class="empty">${t('common.noNotes')}</div>`}
    `;
    body.querySelector('#n-sub').onchange = (e) => { d.subjectId = e.target.value; };
    body.querySelector('#n-mode').onchange = (e) => { d.mode = e.target.value; };
    body.querySelector('#n-txt').oninput = (e) => { d.text = e.target.value; };
    const saveBtn = body.querySelector('#n-save');
    if (saveBtn) {
      const titleInp = body.querySelector('#n-title');
      titleInp.oninput = (e) => { d.title = e.target.value; };
      saveBtn.onclick = () => {
        applyNoteToV20(d.subjectId, d.title || langText('AI 筆記', 'AI note'), d.result);
        toast(langText('已存為筆記', 'Saved as note'));
        setTimeout(() => location.reload(), 600);
      };
    }
    body.querySelector('#n-go').onclick = async () => {
      if (!d.text.trim()) { toast(langText('請先輸入內容', 'Enter some content first'), true); return; }
      ui.loading = 'notes'; d.result = ''; render();
      const promptMap = {
        summary: isEn ? 'Summarize the key points in English as 3-7 bullets.' : '簡要摘要重點（繁體中文，條列 3-7 點）',
        expand: isEn ? 'Expand the content with background, examples, and useful detail in English.' : '將內容擴寫補充背景、舉例、延伸（繁體中文）',
        cleanup: isEn ? 'Rewrite this as clean, structured English notes while preserving the meaning.' : '整理修訂成清晰結構化筆記，保留原意但表達精煉（繁體中文）',
        outline: isEn ? 'Turn this into a structured outline using bullets and indentation in English.' : '轉成樹狀提綱（- / 縮排），突顯層級（繁體中文）',
        translate: isEn ? 'Translate this into fluent English.' : '翻譯為流暢的繁體中文'
      };
      try {
        const { text } = await gemini({
          prompt: `${promptMap[d.mode]}:\n\n${d.text}`,
          system: isEn ? 'You are a notes assistant. Return plain text only, bullets are fine, and skip any extra preface.' : '你是筆記整理助理。輸出純文本（可含條列），不要多餘前言。'
        });
        d.result = text;
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9d. MISTAKES book ---------- */
  renderers.mistakes = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const d = ui.drafts.mistakes || (ui.drafts.mistakes = { subjectId: subs[0]?.id || '', q: '', w: '', c: '', note: '' });
    const now = Date.now();
    const due = AI.mistakes.filter(m => new Date(m.due).getTime() <= now);
    body.innerHTML = `
      <h3>${langText('錯題本', 'Mistake book')} <span class="chip">${AI.mistakes.length} ${langText('題', 'items')}</span> <span class="chip warn">${due.length} ${langText('待複習', 'due')}</span></h3>
      <details><summary>＋ ${langText('新增錯題', 'Add mistake')}</summary>
        <label class="field">${langText('科目', 'Subject')}</label>
        <select id="m-sub">${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <label class="field">${langText('題目', 'Question')}</label><textarea id="m-q">${esc(d.q)}</textarea>
        <label class="field">${langText('我的錯誤答案', 'My wrong answer')}</label><textarea id="m-w" style="min-height:50px">${esc(d.w)}</textarea>
        <label class="field">${langText('正確答案（可留空，AI 幫解）', 'Correct answer (optional — AI can fill it)')}</label><textarea id="m-c" style="min-height:50px">${esc(d.c)}</textarea>
        <div class="row" style="margin-top:6px">
          <button class="btn" id="m-ai">🤖 ${langText('AI 解析', 'AI explain')}</button>
          <button class="btn primary grow" id="m-save">${t('common.save')}</button>
        </div>
        ${ui.loading==='mistakes'?`<div class="loading">${langText('解析中…', 'Analyzing…')}</div>`:''}
      </details>
      <hr class="sep"/>
      <h3>${langText('待複習', 'Due to review')} (${due.length})</h3>
      ${due.length === 0
        ? `<div class="empty">${langText('今天沒有待複習的錯題 🎉', 'Nothing due today 🎉')}</div>`
        : due.slice(0,5).map(m => `
          <div class="card-preview">
            <div class="front">${esc(m.question)}</div>
            <div class="back"><b>${langText('正確', 'Correct')}:</b> ${esc(m.correct)}<br/><span style="color:var(--lerna-text-muted)">${langText('我的錯', 'Mine')}: ${esc(m.wrong)}</span></div>
            <div class="row wrap" style="margin-top:6px">
              ${[0,1,2,3,4,5].map(q => `<button class="btn" data-review="${m.id}" data-q="${q}">${['💣','😣','😐','🙂','😎','⭐'][q]}</button>`).join('')}
            </div>
          </div>`).join('')
      }
      <hr class="sep"/>
      <h3>${langText('全部錯題', 'All mistakes')}</h3>
      ${AI.mistakes.length === 0
        ? `<div class="empty">${langText('尚未登錄錯題', 'No mistakes saved yet')}</div>`
        : AI.mistakes.slice(0,20).map(m => `
          <details>
            <summary>${esc(m.question.slice(0,50))} · ${m.interval}d · ${formatDate(m.due)}</summary>
            <div class="msg sys"><b>${langText('錯', 'Wrong')}:</b> ${esc(m.wrong)}<br/><b>${langText('對', 'Correct')}:</b> ${esc(m.correct)}<br/>${m.note?'<b>'+langText('解析', 'Explanation')+':</b> '+esc(m.note):''}</div>
            <button class="btn danger" data-mdel="${m.id}">${t('common.delete')}</button>
          </details>
        `).join('')}
    `;
    const e = (id) => body.querySelector(id);
    e('#m-sub')?.addEventListener('change', ev => d.subjectId = ev.target.value);
    e('#m-q').oninput = ev => d.q = ev.target.value;
    e('#m-w').oninput = ev => d.w = ev.target.value;
    e('#m-c').oninput = ev => d.c = ev.target.value;
    e('#m-ai').onclick = async () => {
      if (!d.q) { toast(langText('請先輸入題目', 'Enter the question first'), true); return; }
      ui.loading = 'mistakes'; render();
      try {
        const { text } = await gemini({
          prompt: isEn
            ? `Question: ${d.q}\nMy wrong answer: ${d.w || '(blank)'}\nReply in English with: 1) the correct answer 2) why I was wrong 3) the key concept.`
            : `題目: ${d.q}\n我寫的錯誤答案: ${d.w || '(未填)'}\n請用繁體中文給出：1) 正確答案 2) 為什麼我錯了 3) 關鍵概念`,
          system: isEn ? 'You are a problem-solving teacher. Keep it concise in three sections.' : '你是解題老師。精簡 3 段式回答。',
        });
        d.note = text;
        if (!d.c) {
          const { text: cc } = await gemini({
            prompt: isEn ? `Output only the correct answer to this question in one short English sentence: ${d.q}` : `只輸出這題的正確答案（繁中、一句話）: ${d.q}`,
            system: isEn ? 'Short and direct.' : '簡短直接。'
          });
          d.c = cc.trim();
        }
        toast(langText('AI 解析完成', 'AI explanation ready'));
      } catch (err) { toast(t('common.failed') + ': ' + err.message, true); }
      ui.loading = null; render();
    };
    e('#m-save').onclick = () => {
      if (!d.q) { toast(langText('題目必填', 'A question is required'), true); return; }
      const item = {
        id: 'mis_' + Date.now(), subjectId: d.subjectId,
        question: d.q, wrong: d.w, correct: d.c, note: d.note || '',
        ease: 2.5, interval: 0, due: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      updateAI({ mistakes: [item, ...AI.mistakes] });
      ui.drafts.mistakes = { subjectId: d.subjectId, q: '', w: '', c: '', note: '' };
      toast(langText('已加入錯題本', 'Added to the mistake book'));
    };
    body.querySelectorAll('[data-review]').forEach(btn => {
      btn.onclick = () => {
        const m = AI.mistakes.find(x => x.id === btn.dataset.review);
        if (!m) return;
        const q = +btn.dataset.q;
        const updated = sm2(m, q);
        updateAI({ mistakes: AI.mistakes.map(x => x.id === m.id ? updated : x) });
        // buddy reward
        const today = new Date().toDateString();
        const last = AI.buddy.lastCheckIn ? new Date(AI.buddy.lastCheckIn).toDateString() : null;
        if (last !== today) {
          const yest = new Date(); yest.setDate(yest.getDate() - 1);
          const streak = last === yest.toDateString() ? AI.buddy.streak + 1 : 1;
          updateAI({ buddy: { ...AI.buddy, streak, lastCheckIn: new Date().toISOString(), points: AI.buddy.points + 5 }});
        } else {
          updateAI({ buddy: { ...AI.buddy, points: AI.buddy.points + 1 } });
        }
      };
    });
    body.querySelectorAll('[data-mdel]').forEach(btn => {
      btn.onclick = () => updateAI({ mistakes: AI.mistakes.filter(x => x.id !== btn.dataset.mdel) });
    });
  };

  /* ---------- 9e. PLAN generator ---------- */
  renderers.plan = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const cds = s.countdowns || [];
    const d = ui.drafts.plan || (ui.drafts.plan = { days: 7, hoursPerDay: 3, mood: 'balanced', note: '' });
    d.mood = normalizePlanPace(d.mood);
    body.innerHTML = `
      <h3>${langText('讀書計畫生成器', 'Study plan generator')}</h3>
      <div class="msg sys">
        ${langText(`已知 ${subs.length} 個科目, ${cds.length} 個倒數。AI 會依你的截止日 & 過往學習時數產生計畫。`, `I found ${subs.length} subjects and ${cds.length} countdowns. AI will plan around your deadlines and past study time.`)}
      </div>
      <label class="field">${langText('天數', 'Days')}</label>
      <input id="p-d" type="number" min="1" max="30" value="${d.days}"/>
      <label class="field">${langText('每日可讀書 (小時)', 'Study time per day (hours)')}</label>
      <input id="p-h" type="number" min="0.5" max="14" step="0.5" value="${d.hoursPerDay}"/>
      <label class="field">${langText('節奏', 'Pace')}</label>
      <select id="p-m">
        ${PLAN_PACE_OPTIONS.map(x=>`<option value="${x.value}" ${x.value===d.mood?'selected':''}>${getLang()==='en'?x.en:x.zh}</option>`).join('')}
      </select>
      <label class="field">${langText('備註 (選填)', 'Notes (optional)')}</label>
      <textarea id="p-n" placeholder="${esc(langText('例：下週三有英文模考、週六家庭日跳過…', 'Example: English mock exam next Wednesday, skip Saturday for family time…'))}">${esc(d.note)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="p-go">${langText('生成計畫', 'Generate plan')}</button>
      </div>
      ${ui.loading==='plan'?`<div class="loading">${langText('規劃中…', 'Planning…')}</div>`:''}
      ${AI.pendingPlan ? `
        <hr class="sep"/>
        <h3>${langText('建議計畫', 'Suggested plan')}</h3>
        ${(AI.pendingPlan.days||[]).map(day=>`
          <details>
            <summary>📅 ${day.date} · ${(day.blocks||[]).length} ${langText('個時段', 'blocks')}</summary>
            ${(day.blocks||[]).map(b=>`<div class="card-preview">
              <div class="front">${esc(b.startTime)}–${esc(b.endTime)} · ${esc(b.title)}</div>
              <div class="back">${langText('科目', 'Subject')}: ${esc(subs.find(x=>x.id===b.subjectId)?.name || '—')} · ${esc(b.reason||'')}</div>
            </div>`).join('')}
          </details>
        `).join('')}
        <div class="row" style="margin-top:8px">
          <button class="btn primary grow" id="p-apply">${langText('套用到 Lerna 時間表', 'Add to Lerna schedule')}</button>
          <button class="btn danger" id="p-clear">${langText('捨棄', 'Discard')}</button>
        </div>
      ` : ''}
    `;
    body.querySelector('#p-d').oninput = e => d.days = +e.target.value || 7;
    body.querySelector('#p-h').oninput = e => d.hoursPerDay = +e.target.value || 3;
    body.querySelector('#p-m').onchange = e => d.mood = e.target.value;
    body.querySelector('#p-n').oninput = e => d.note = e.target.value;
    body.querySelector('#p-go').onclick = async () => {
      ui.loading = 'plan'; render();
      try {
        const ctx = ctxSummary();
        const today = new Date().toISOString().slice(0,10);
        const { text } = await gemini({
          prompt: isEn
            ? `Make a ${d.days}-day study plan starting from ${today}. Limit each day to ${d.hoursPerDay} hours. Pace: ${getPlanPaceLabel(d.mood)}. Notes: ${d.note||'(none)'}.
Learning context:
${ctx.summary}
Subject IDs: ${subs.map(x=>`${x.name}=${x.id}`).join(', ')}
Countdowns: ${cds.map(c=>`${c.title}@${c.date}`).join('; ')||'(none)'}

Output JSON: {"days":[{"date":"YYYY-MM-DD","blocks":[{"title":"What to study","startTime":"HH:MM","endTime":"HH:MM","subjectId":"sub_xxx","reason":"Why this block is here"}]}]}
Use 24-hour time. Weight the schedule by deadline urgency. Weekends can be a bit lighter or heavier.`
            : `幫我做 ${d.days} 天讀書計畫，從 ${today} 起。每天最多 ${d.hoursPerDay} 小時。節奏: ${getPlanPaceLabel(d.mood)}。備註: ${d.note||'無'}。
學習脈絡:
${ctx.summary}
科目 ID 列表: ${subs.map(x=>`${x.name}=${x.id}`).join(', ')}
倒數事件: ${cds.map(c=>`${c.title}@${c.date}`).join('; ')||'無'}

輸出 JSON: {"days":[{"date":"YYYY-MM-DD","blocks":[{"title":"讀什麼","startTime":"HH:MM","endTime":"HH:MM","subjectId":"sub_xxx","reason":"為什麼排這裡"}]}]}
時間用 24 小時制。依倒數天數動態加權。週末可略少或略多。`,
          system: isEn ? 'You are a study planner. Return JSON only with no explanation.' : '你是讀書計畫師。只回 JSON 不要解釋。',
          json: true
        });
        const plan = JSON.parse(text);
        updateAI({ pendingPlan: plan });
        toast(langText('計畫生成完畢', 'Plan generated'));
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
    body.querySelector('#p-apply')?.addEventListener('click', () => {
      const n = applyPlanToV20(AI.pendingPlan);
      updateAI({ pendingPlan: null });
      toast(langText(`已加入 ${n} 個時段,重新載入…`, `Added ${n} blocks. Reloading…`));
      setTimeout(() => location.reload(), 800);
    });
    body.querySelector('#p-clear')?.addEventListener('click', () => updateAI({ pendingPlan: null }));
  };

  /* ---------- 9f. REFLECT coach ---------- */
  renderers.reflect = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const sess = (s.sessions || []).slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 12);
    const d = ui.drafts.reflect || (ui.drafts.reflect = { sessionId: sess[0]?.id || '', q: '', note: '', result: '' });
    const cur = sess.find(x => x.id === d.sessionId);
    body.innerHTML = `
      <h3>${langText('反思教練', 'Reflect coach')}</h3>
      <div class="msg sys">${langText('AI 幫你把一節課的「讀了什麼」轉成「真正的理解」。', 'AI turns “what I studied” into “what I actually understood.”')}</div>
      <label class="field">${langText('選一節學習', 'Pick a session')}</label>
      <select id="r-sess">
        ${sess.map(x => `<option value="${x.id}" ${x.id===d.sessionId?'selected':''}>
          ${formatDateTime(x.startedAt)} · ${Math.round((x.duration||0)/60)}m · ${esc(s.subjects?.find(y=>y.id===x.subjectId)?.name||'—')}
        </option>`).join('')}
        ${sess.length===0?`<option value="">${t('common.noRecord')}</option>`:''}
      </select>
      ${cur?.reflection ? `<div class="msg sys">${langText('已有反思', 'Existing reflection')}: ${langText('品質', 'quality')} ${cur.reflection.quality}/5 · ${esc(cur.reflection.note||'')}</div>`:''}
      <label class="field">${langText('你剛讀的主題 / 內容', 'What you just studied')}</label>
      <textarea id="r-q" placeholder="${esc(langText('例：二次函數的頂點公式、Kant 的定言令式…', 'Example: the vertex form of quadratics, Kant’s categorical imperative…'))}">${esc(d.q)}</textarea>
      <label class="field">${langText('你覺得自己學到什麼 (可留空)', 'What you think you learned (optional)')}</label>
      <textarea id="r-note">${esc(d.note)}</textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn primary grow" id="r-go">${langText('開始蘇格拉底式提問', 'Start the Socratic reflection')}</button>
      </div>
      ${ui.loading==='reflect'?`<div class="loading">${langText('產生中…', 'Generating…')}</div>`:''}
      ${d.result ? `<hr class="sep"/><div class="msg ai" style="white-space:pre-wrap">${esc(d.result)}</div>` : ''}
    `;
    body.querySelector('#r-sess').onchange = e => { d.sessionId = e.target.value; render(); };
    body.querySelector('#r-q').oninput = e => d.q = e.target.value;
    body.querySelector('#r-note').oninput = e => d.note = e.target.value;
    body.querySelector('#r-go').onclick = async () => {
      if (!d.q.trim()) { toast(langText('請輸入主題', 'Enter the topic first'), true); return; }
      ui.loading = 'reflect'; d.result = ''; render();
      try {
        const { text } = await gemini({
          prompt: isEn
            ? `A student just finished a study session.\nTopic: ${d.q}\nTheir own reflection: ${d.note || '(none)'}\nDuration: ${cur ? Math.round((cur.duration||0)/60) + ' minutes' : 'unknown'}\n\nWrite an English Socratic reflection:\n1) Ask 3 questions that go from shallow to deep.\n2) Point out 1 blind spot they may have missed.\n3) Give 1 small exercise they can do within 24 hours to reinforce the learning.\nEnd with one warm encouraging sentence.`
            : `學生剛完成一節學習。主題: ${d.q}\n他自述: ${d.note || '(無)'}\n時長: ${cur? Math.round((cur.duration||0)/60)+'分鐘':'未知'}\n
請用繁體中文做蘇格拉底式反思：
1) 問 3 個從淺到深的問題幫他釐清理解
2) 指出 1 個他可能沒注意到的誤區
3) 給 1 個 24 小時內可以做的小練習鞏固記憶
最後一句給溫暖鼓勵。`,
          system: isEn ? 'You are a reflection coach. Warm, but still challenging.' : '你是反思教練。溫暖但有挑戰性。'
        });
        d.result = text;
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9g. WEEKLY report ---------- */
  renderers.report = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const s = loadYPT() || {};
    const sess = s.sessions || [];
    const today = new Date(); const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
    const recent = sess.filter(se => new Date(se.startedAt) >= weekAgo);
    const bySub = {};
    recent.forEach(se => { bySub[se.subjectId] = (bySub[se.subjectId]||0) + (se.duration||0); });
    const topSub = Object.entries(bySub).sort((a,b)=>b[1]-a[1])[0];
    const totalMin = Math.round(recent.reduce((a,b)=>a+(b.duration||0)/60,0));
    body.innerHTML = `
      <h3>${langText('週報', 'Weekly report')}</h3>
      <div class="msg sys">
        ${langText('近 7 日', 'Last 7 days')}: <b>${totalMin}</b> ${langText('分鐘', 'minutes')} · ${recent.length} ${langText('節', 'sessions')} · ${langText('平均', 'avg')} <b>${(totalMin/7).toFixed(0)}</b> ${langText('分/日', 'min/day')}<br/>
        ${langText('最常讀', 'Top subject')}: ${topSub ? esc(s.subjects?.find(x=>x.id===topSub[0])?.name || '—') + ' (' + Math.round(topSub[1]/60) + langText('分', 'm') + ')' : '—'}
      </div>
      <button class="btn primary" id="rep-go">📝 ${langText('生成 AI 週報 & 建議', 'Generate AI weekly report')}</button>
      ${ui.loading==='report'?`<div class="loading">${langText('分析中…', 'Analyzing…')}</div>`:''}
      <hr class="sep"/>
      ${AI.weeklyReports.length === 0 ? `<div class="empty">${langText('尚未產生報告', 'No reports yet')}</div>` :
        AI.weeklyReports.slice(0,5).map(r => `
          <details ${r===AI.weeklyReports[0]?'open':''}>
            <summary>${esc(r.range)} · ${formatDate(r.createdAt)}</summary>
            <div class="msg ai" style="white-space:pre-wrap">${esc(r.body)}</div>
          </details>
        `).join('')}
    `;
    body.querySelector('#rep-go').onclick = async () => {
      ui.loading = 'report'; render();
      try {
        const byDay = {};
        recent.forEach(se => {
          const k = (se.startedAt||'').slice(0,10);
          byDay[k] = (byDay[k]||0) + (se.duration||0)/60;
        });
        const statsText = Object.entries(byDay).map(([d,m])=>`${d}: ${Math.round(m)}m`).join('; ');
        const subText = Object.entries(bySub).map(([id,sec])=>`${s.subjects?.find(x=>x.id===id)?.name||'?'}: ${Math.round(sec/60)}m`).join('; ');
        const { text } = await gemini({
          prompt: isEn
            ? `Write a weekly study report in English from the data below (under 220 words):
- Total time: ${totalMin} minutes / 7 days
- Per day: ${statsText}
- By subject: ${subText}
- Session count: ${recent.length}
Output:
1) 2-3 key findings
2) strengths and risks
3) 3 concrete action items for next week with measurable goals.
Use a Gen Z tone without becoming fluffy.`
            : `根據數據給一份繁體中文週報（300字內）：
- 總時數: ${totalMin} 分鐘 / 7 天
- 每日: ${statsText}
- 各科: ${subText}
- 節數: ${recent.length}
輸出：1) 關鍵發現 2-3 點 2) 強項與隱憂 3) 下週 3 個具體行動建議（含可量化目標）。用 Gen Z 口吻但不失專業。`,
          system: isEn ? 'You are a study analyst. Use real data, stay grounded, and do not flatter.' : '你是讀書分析師,用真實數據說話,不吹捧。'
        });
        const r = {
          id: 'rep_'+Date.now(),
          range: weekAgo.toISOString().slice(0,10) + ' ~ ' + today.toISOString().slice(0,10),
          body: text,
          createdAt: new Date().toISOString()
        };
        updateAI({ weeklyReports: [r, ...AI.weeklyReports].slice(0,20) });
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9h. OCR ---------- */
  renderers.ocr = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const d = ui.drafts.ocr || (ui.drafts.ocr = { imgData: null, mime: '', result: '', mode: 'transcribe' });
    body.innerHTML = `
      <h3>${langText('OCR / 圖片助手', 'OCR / Image assistant')}</h3>
      <div class="msg sys">${langText('上傳講義/筆記/題目照片,AI 幫你轉文字、解題、做字卡。', 'Upload lecture, notes, or question photos — AI can transcribe, solve, or turn them into flashcards.')}</div>
      <input type="file" id="ocr-file" accept="image/*"/>
      ${d.imgData ? `
        <div style="position:relative;display:inline-block;margin:6px 0;max-width:100%">
          <img src="data:${d.mime};base64,${d.imgData}" style="display:block;max-width:100%;max-height:180px;border-radius:8px"/>
          <button type="button" id="ocr-clear" aria-label="${esc(langText('移除圖片', 'Remove image'))}" title="${esc(langText('移除圖片', 'Remove image'))}"
            style="position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:999px;border:none;cursor:pointer;background:rgba(0,0,0,.65);color:#fff;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center">✕</button>
        </div>` : ''}
      <label class="field">${langText('要做什麼', 'What to do')}</label>
      <select id="ocr-mode">
        <option value="transcribe" ${d.mode==='transcribe'?'selected':''}>📝 ${langText('純轉文字', 'Transcribe only')}</option>
        <option value="summary" ${d.mode==='summary'?'selected':''}>📑 ${langText('轉文字 + 摘要', 'Transcribe + summary')}</option>
        <option value="solve" ${d.mode==='solve'?'selected':''}>🧮 ${langText('把題目解出來', 'Solve the problem')}</option>
        <option value="cards" ${d.mode==='cards'?'selected':''}>📚 ${langText('直接生成字卡', 'Generate flashcards')}</option>
      </select>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="ocr-go" ${d.imgData?'':'disabled'}>${t('common.run')}</button>
      </div>
      ${ui.loading==='ocr'?`<div class="loading">${langText('OCR 中…', 'Running OCR…')}</div>`:''}
      ${d.result ? `<hr class="sep"/><div class="msg ai" style="white-space:pre-wrap">${esc(d.result)}</div>` : ''}
    `;
    body.querySelector('#ocr-file').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        d.mime = f.type || 'image/png';
        d.imgData = reader.result.split(',')[1];
        render();
      };
      reader.readAsDataURL(f);
    };
    const ocrClearBtn = body.querySelector('#ocr-clear');
    if (ocrClearBtn) ocrClearBtn.onclick = () => {
      d.imgData = null; d.mime = ''; d.result = '';
      const inp = body.querySelector('#ocr-file'); if (inp) inp.value = '';
      render();
    };
    body.querySelector('#ocr-mode').onchange = e => d.mode = e.target.value;
    body.querySelector('#ocr-go').onclick = async () => {
      if (!d.imgData) return;
      ui.loading = 'ocr'; d.result = ''; render();
      const prompts = {
        transcribe: isEn ? 'Transcribe all text in the image exactly, preserving layout with line breaks and indentation.' : '把圖片中的文字完整轉成繁體中文文字,保留原排版 (用換行/縮排)。',
        summary: isEn ? 'First transcribe the image fully, then give 3-5 English summary bullets.' : '先完整轉文字,再用 3-5 條摘要。',
        solve: isEn ? 'Identify the problem in the image, then solve it step by step in English.' : '辨識題目,然後完整解題 (步驟 + 答案)。繁體中文。',
        cards: isEn ? 'Recognize the content and output a JSON array [{"front":"q","back":"a"}] with at least 8 flashcards in English.' : '辨識內容後,輸出 JSON 陣列 [{"front":"q","back":"a"}] 至少 8 張字卡,繁體中文。'
      };
      try {
        const isJson = d.mode === 'cards';
        const { text } = await gemini({
          prompt: prompts[d.mode],
          images: [{ mime: d.mime, data: d.imgData }],
          json: isJson
        });
        if (isJson) {
          const arr = JSON.parse(text);
          AI.pendingCards.unshift({
            id: 'pc_'+Date.now(),
            subjectId: loadYPT()?.subjects?.[0]?.id || '',
            source: langText('[OCR 圖片]', '[OCR image]'),
            cards: arr,
            createdAt: new Date().toISOString()
          });
          saveAI(AI);
          d.result = langText(`已生成 ${arr.length} 張字卡 — 到「字卡」頁套用。`, `Generated ${arr.length} flashcards — open Cards to apply them.`);
        } else {
          d.result = text;
        }
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9i. VOICE vocabulary ---------- */
  renderers.voice = (body) => {
    if (!ensureKey(body)) return;
    const isEn = getLang() === 'en';
    const d = ui.drafts.voice || (ui.drafts.voice = { word: '', listening: false });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canListen = !!SR;
    const canSpeak = !!window.speechSynthesis;
    const appLang = loadYPT()?.settings?.lang === 'en' ? 'en-US' : 'zh-TW';
    const isFileProtocol = location.protocol === 'file:';
    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
    const isOpera = /OPR|Opera/i.test(navigator.userAgent || '');
    const hasSpeechPreferredOrigin = location.protocol === 'https:' || isLocalhost;
    const getSpeechLang = (value) => {
      const word = String(value || '').trim();
      if (!word) return appLang;
      return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(word) ? 'zh-TW' : 'en-US';
    };
    const updateWordInput = () => {
      const el = body.querySelector('#v-word');
      if (el) el.value = d.word;
    };
    const setMicState = (on) => {
      d.listening = on;
      const mic = body.querySelector('#v-mic');
      if (mic) mic.textContent = on ? t('voice.stop') : '🎤';
    };
    const stopRecognizerStream = () => {
      const stream = window.__recogStream;
      window.__recogStream = null;
      if (!stream?.getTracks) return;
      try { stream.getTracks().forEach((track) => track.stop()); } catch {}
    };
    const releaseRecognizer = (stop = false) => {
      const active = window.__recog;
      window.__recog = null;
      if (active) {
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        if (stop) {
          try { active.stop(); } catch {}
        }
      }
      stopRecognizerStream();
      setMicState(false);
    };
    const explainSpeechError = (code) => {
      switch (code) {
        case 'not-allowed':
          return t('voice.error.permission');
        case 'no-speech':
          return t('voice.error.noSpeech');
        case 'audio-capture':
          return t('voice.error.audioCapture');
        case 'network':
          return t('voice.error.network');
        case 'service-not-allowed':
          return t('voice.error.serviceNotAllowed');
        case 'aborted':
          return t('voice.error.aborted');
        default:
          return t('voice.error.generic');
      }
    };
    const addSpeechContextHint = (msg, code) => {
      if ((code === 'not-allowed' || code === 'service-not-allowed') && isFileProtocol) {
        return msg + ' ' + t('voice.error.fileHint');
      }
      if ((code === 'not-allowed' || code === 'service-not-allowed') && !hasSpeechPreferredOrigin) {
        return msg + ' ' + t('voice.error.originHint');
      }
      return msg;
    };
    const getSilentFailureHint = () => {
      const parts = [t('voice.error.noTranscript')];
      if (isOpera) {
        parts.push(langText('Opera 對 Web Speech API 支援不穩，建議改用 Chrome / Edge。', 'Opera support for the Web Speech API is unreliable. Use Chrome / Edge instead.'));
      } else {
        parts.push(t('voice.error.noTranscriptHint'));
      }
      if (isFileProtocol) {
        parts.push(t('voice.error.fileHint'));
      } else if (!hasSpeechPreferredOrigin) {
        parts.push(t('voice.error.originHint'));
      }
      return parts.join(' ');
    };
    body.innerHTML = `
      <h3>${langText('語音單字', 'Voice vocabulary')} <span class="chip">${AI.voiceWords.length} ${langText('個', 'items')}</span></h3>
      <div class="msg sys">${langText('對麥克風說一個單字，或輸入 → AI 給定義/例句，按🔊聽發音。', 'Say a word into the microphone or type one. AI will return a definition and examples, and 🔊 plays the pronunciation.')}</div>
      ${!canListen ? `<div class="msg sys" style="margin-top:8px">${t('voice.unsupported')}</div>` : ''}
      ${canListen && !hasSpeechPreferredOrigin ? `<div class="msg sys" style="margin-top:8px">${t('voice.insecureHint')}</div>` : ''}
      <div class="row">
        <input id="v-word" placeholder="${langText('輸入或聽…', 'Type or dictate…')}" value="${esc(d.word)}" class="grow"/>
        <button class="btn" id="v-mic" ${canListen?'':'disabled'}>${d.listening ? t('voice.stop') : '🎤'}</button>
        <button class="btn" id="v-speak" ${canSpeak?'':'disabled'}>🔊</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="v-go">📖 ${langText('查詢', 'Look up')}</button>
      </div>
      ${ui.loading==='voice'?`<div class="loading">${t('common.searching')}</div>`:''}
      <hr class="sep"/>
      <h3>${langText('單字本', 'Word bank')}</h3>
      ${AI.voiceWords.length===0?`<div class="empty">${langText('還沒存單字', 'No saved words yet')}</div>`:
        AI.voiceWords.slice(0,30).map(w => `
          <details>
            <summary>${esc(w.word)} ${w.ipa?`<span class="chip">${esc(w.ipa)}</span>`:''}</summary>
            <div class="msg sys" style="white-space:pre-wrap">${esc(w.definition)}
${(w.examples||[]).map(x=>'• '+x).join('\n')}</div>
            <div class="row">
              <button class="btn" data-say="${esc(w.word)}">🔊</button>
              <button class="btn danger" data-vdel="${w.id}">${t('common.delete')}</button>
            </div>
          </details>
        `).join('')}
    `;
    const wInp = body.querySelector('#v-word');
    wInp.oninput = e => d.word = e.target.value;
    body.querySelector('#v-mic').onclick = () => {
      if (!canListen) {
        toast(t('voice.unsupported'), true);
        return;
      }
      if (d.listening && window.__recog) {
        releaseRecognizer(true);
        return;
      }
      if (window.__recog) releaseRecognizer(true);
      const r = new SR();
      const recogMeta = { heardTranscript: false, sawError: false, startedAt: Date.now() };
      r.lang = getSpeechLang(d.word);
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        let combined = '';
        for (let i = 0; i < e.results.length; i++) {
          combined += e.results[i][0].transcript;
        }
        d.word = combined.trim();
        if (d.word) recogMeta.heardTranscript = true;
        updateWordInput();
      };
      r.onerror = (ev) => {
        const code = ev?.error || 'unknown';
        recogMeta.sawError = true;
        releaseRecognizer(false);
        toast(addSpeechContextHint(explainSpeechError(code), code), true);
      };
      r.onend = () => {
        if (window.__recog === r) window.__recog = null;
        stopRecognizerStream();
        setMicState(false);
        if (!recogMeta.sawError && !recogMeta.heardTranscript && (Date.now() - recogMeta.startedAt) > 1200) {
          toast(getSilentFailureHint(), true);
        }
      };
      try {
        window.__recog = r;
        setMicState(true);
        r.start();
      } catch (e) {
        releaseRecognizer(false);
        toast(t('voice.error.startPrefix') + ': ' + (e?.message || e), true);
      }
    };
    body.querySelector('#v-speak').onclick = () => {
      if (!canSpeak || !d.word) return;
      const u = new SpeechSynthesisUtterance(d.word);
      u.lang = getSpeechLang(d.word);
      speechSynthesis.speak(u);
    };
    body.querySelector('#v-go').onclick = async () => {
      const w = d.word.trim(); if (!w) return;
      ui.loading = 'voice'; render();
      try {
        const { text } = await gemini({
          prompt: isEn
            ? `Word: "${w}". Return JSON: {"word":"original word","ipa":"IPA if applicable","definition":"short clear English definition","examples":["Example sentence 1","Example sentence 2"]}`
            : `單字: "${w}"。輸出 JSON: {"word":"原詞","ipa":"音標(若適用)","definition":"繁中精簡定義","examples":["例句1","例句2"]}`,
          system: isEn ? 'You are a dictionary. Return JSON only.' : '你是字典。只回 JSON。',
          json: true
        });
        const obj = JSON.parse(text);
        const item = { id:'vw_'+Date.now(), ...obj, createdAt:new Date().toISOString() };
        updateAI({ voiceWords: [item, ...AI.voiceWords] });
        d.word = '';
        toast(langText('已加入單字本', 'Added to Word bank'));
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
      ui.loading = null; render();
    };
    body.querySelectorAll('[data-say]').forEach(b => b.onclick = () => {
      if (!canSpeak) return;
      const u = new SpeechSynthesisUtterance(b.dataset.say);
      u.lang = getSpeechLang(b.dataset.say);
      speechSynthesis.speak(u);
    });
    body.querySelectorAll('[data-vdel]').forEach(b => b.onclick = () =>
      updateAI({ voiceWords: AI.voiceWords.filter(x => x.id !== b.dataset.vdel) }));
  };

  /* ---------- 9j. BUDDY ---------- */
  renderers.buddy = (body) => {
    const isEn = getLang() === 'en';
    const b = AI.buddy;
    const s = loadYPT() || {};
    const todaySess = (s.sessions||[]).filter(x=>(x.startedAt||'').slice(0,10)===new Date().toISOString().slice(0,10));
    const todayMin = Math.round(todaySess.reduce((a,c)=>a+(c.duration||0)/60,0));
    const goal = s.settings?.dailyGoalMinutes || 120;
    const progress = Math.min(100, (todayMin/goal)*100);
    const mood = todayMin >= goal
      ? langText('超讚! ✨', 'Crushed it ✨')
      : todayMin > goal*0.5
        ? langText('穩穩的 💪', 'Solid pace 💪')
        : todayMin > 0
          ? langText('開始了就贏一半 🌱', 'Starting is half the win 🌱')
          : langText('還沒開始哦 😴', 'Not started yet 😴');
    body.innerHTML = `
      <h3>${langText('學習 Buddy', 'Study Buddy')} — ${esc(b.name)}</h3>
      <div style="text-align:center;padding:16px;background:#1e293b;border-radius:12px;margin-bottom:10px">
        <div style="font-size:48px">${todayMin>=goal?'🎉':todayMin>0?'📚':'💤'}</div>
        <div style="font-size:13px;color:#94a3b8;margin:4px 0">${esc(mood)}</div>
        <div style="font-size:18px;font-weight:700">${todayMin} / ${goal} ${langText('分鐘', 'minutes')}</div>
        <div style="height:8px;background:#0f172a;border-radius:4px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#7c3aed,#2563eb)"></div>
        </div>
      </div>
      <div class="row wrap">
        <span class="chip">🔥 ${langText('連續', 'Streak')} ${b.streak} ${langText('天', 'days')}</span>
        <span class="chip">⭐ ${b.points} ${langText('點', 'pts')}</span>
        <span class="chip">🕐 ${langText('今日', 'Today')} ${todaySess.length} ${langText('節', 'sessions')}</span>
      </div>
      <hr class="sep"/>
      <label class="field">${langText('Buddy 名字', 'Buddy name')}</label>
      <input id="b-name" value="${esc(b.name)}"/>
      <label class="field">${langText('個性', 'Personality')}</label>
      <select id="b-mood">
        ${['chill','hyped','strict','wise','silly'].map(x=>`<option value="${x}" ${x===b.mood?'selected':''}>${esc(getBuddyMoodLabel(x))}</option>`).join('')}
      </select>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="b-talk">💬 ${langText('叫 Buddy 說話', 'Ask Buddy to talk')}</button>
      </div>
      ${ui.drafts.buddyMsg ? `<div class="msg ai" style="margin-top:8px">${esc(ui.drafts.buddyMsg)}</div>` : ''}
      ${ui.loading==='buddy'?`<div class="loading">${langText('Buddy 思考中…', 'Buddy is thinking…')}</div>`:''}
    `;
    body.querySelector('#b-name').onchange = e => updateAI({ buddy: {...AI.buddy, name: e.target.value }});
    body.querySelector('#b-mood').onchange = e => updateAI({ buddy: {...AI.buddy, mood: e.target.value }});
    body.querySelector('#b-talk').onclick = async () => {
      if (!AI.apiKey) { ui.drafts.buddyMsg = t('buddy.noApi'); render(); return; }
      ui.loading = 'buddy'; render();
      try {
        const ctx = ctxSummary();
        const { text } = await gemini({
          prompt: isEn
            ? `You are a study buddy named ${b.name}. Personality: ${getBuddyMoodLabel(b.mood)}. Write one casual Gen Z-style line in English, under 30 words. Based on this data, say one thing for today: encouragement, teasing, or a reminder.\n${ctx.summary}\nStreak ${b.streak} days, ${b.points} points.`
            : `你是名叫 ${b.name} 的讀書同伴，個性: ${getBuddyMoodLabel(b.mood)}。Gen Z 口吻、繁體中文，一段話 60 字內。根據數據給今天一句話 (鼓勵/吐槽/提醒都可):\n${ctx.summary}\n連續 ${b.streak} 天、${b.points} 點。`,
          system: isEn ? 'Sound like a friend, not a coach. No lecturing.' : '像朋友不是教練。別說教。'
        });
        ui.drafts.buddyMsg = text;
      } catch (e) { ui.drafts.buddyMsg = t('buddy.error') + ': ' + e.message; }
      ui.loading = null; render();
    };
  };

  /* ---------- 9k. SETTINGS ---------- */
  renderers.settings = (body) => {
    const isEn = getLang() === 'en';
    body.innerHTML = `
      <h3>⚙︎ ${langText('設定', 'Settings')}</h3>
      <label class="field">Gemini API Key <span style="color:#64748b">(${langText('只存瀏覽器', 'browser only')})</span></label>
      <input id="s-key" type="password" placeholder="AIza…" value="${esc(AI.apiKey)}"/>
      <p style="font-size:12px;color:#94a3b8;margin-top:4px">
        <a href="https://aistudio.google.com/apikey" target="_blank">${t('key.getFree')} →</a>
      </p>

      <label class="field">${langText('模型', 'Model')}</label>
      <select id="s-model">
        <option value="gemini-2.5-flash-lite" ${AI.model==='gemini-2.5-flash-lite'?'selected':''}>
          gemini-2.5-flash-lite (${langText('免費 1000/日, 推薦', 'free 1000/day, recommended')})
        </option>
        <option value="gemini-2.5-flash" ${AI.model==='gemini-2.5-flash'?'selected':''}>
          gemini-2.5-flash (${langText('更強, 付費', 'stronger, paid')})
        </option>
        <option value="gemini-2.5-pro" ${AI.model==='gemini-2.5-pro'?'selected':''}>
          gemini-2.5-pro (${langText('最強, 付費', 'strongest, paid')})
        </option>
      </select>

      <hr class="sep"/>
      <h3>${langText('資料管理', 'Data')}</h3>
      <div class="row wrap">
        <button class="btn" id="s-test">🧪 ${langText('測試 API', 'Test API')}</button>
        <button class="btn" id="s-export">📤 ${langText('匯出 AI 資料', 'Export AI data')}</button>
        <button class="btn" id="s-import">📥 ${langText('匯入', 'Import')}</button>
        <button class="btn danger" id="s-reset">🗑 ${langText('清空 AI 資料', 'Clear AI data')}</button>
      </div>
      <input type="file" id="s-file" accept=".json" style="display:none"/>

      <hr class="sep"/>
      <h3>${langText('關於 Lerna AI v22', 'About Lerna AI v22')}</h3>
      <div class="msg sys">
        ${langText('層疊在 v20 之上的 AI sidecar。', 'An AI sidecar layered on top of v20.')}<br/>
        • ${langText('原始資料 key', 'Main data key')}: <span class="kbd">ypt_app_state_v6</span><br/>
        • ${langText('AI 資料 key', 'AI data key')}: <span class="kbd">lerna_ai_v1</span><br/>
        • ${langText('快捷鍵', 'Shortcut')}: <span class="kbd">Ctrl + I</span> ${langText('開關面板', 'toggles the panel')}<br/>
        • ${langText('免註冊 / 無後端 / 離線也能用 (需 API Key 聯外 for AI 功能)', 'No signup, no backend, and works offline except AI calls that need an API key')}
      </div>
    `;
    body.querySelector('#s-key').onchange = e => updateAI({ apiKey: e.target.value.trim() });
    body.querySelector('#s-model').onchange = e => updateAI({ model: e.target.value });
    body.querySelector('#s-test').onclick = async () => {
      try {
        const { text } = await gemini({ prompt: isEn ? 'Reply with exactly OK.' : '回答「OK」兩個英文字母。' });
        toast(t('settings.apiOk') + ': ' + text.slice(0,30));
      } catch (e) { toast(t('common.failed') + ': ' + e.message, true); }
    };
    body.querySelector('#s-export').onclick = () => {
      const blob = new Blob([JSON.stringify(AI, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = t('settings.exportFile') + '-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
    };
    body.querySelector('#s-import').onclick = () => body.querySelector('#s-file').click();
    body.querySelector('#s-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (data && typeof data === 'object') {
            updateAI(data);
            toast((t('settings.importOk') || 'Imported'));
            render();
          }
        } catch (err) {
          toast((t('common.failed') || 'Failed') + ': ' + err.message, true);
        }
      };
      r.readAsText(f);
    };
    body.querySelector('#s-reset').onclick = () => {
      if (!confirm(t('settings.confirmClear') || 'Clear all AI data?')) return;
      try { localStorage.removeItem('lerna_ai_v1'); location.reload(); } catch (e) {}
    };
  };  /* close renderers.settings */
})();  /* close outer IIFE */
    