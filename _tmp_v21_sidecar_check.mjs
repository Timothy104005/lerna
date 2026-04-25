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
    try { return JSON.parse(localStorage.getItem(YPT_KEY)) || null; }
    catch { return null; }
  };
  const saveYPT = (s) => {
    try { localStorage.setItem(YPT_KEY, JSON.stringify(s)); }
    catch (e) { console.error('[LernaAI] saveYPT failed', e); }
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
    if (!AI.apiKey) throw new Error('請先到設定頁填入 Gemini API Key');
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
      throw new Error('Gemini API 錯誤 ' + r.status + ': ' + txt.slice(0, 300));
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    return { text, raw: j };
  }

  /* ---------- 3. Subject / state utilities ---------- */
  const ctxSummary = () => {
    const s = loadYPT();
    if (!s) return { hasState: false, summary: '尚未使用過 Lerna — 無歷史資料' };
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
`科目: ${subs || '(無)'}
今日學習: ${Math.round(todayMin)} 分鐘 (${todaySess.length} 節)
近 7 日: ${Math.round(weekMin)} 分鐘 (${weekSess.length} 節)
重要倒數: ${countdowns || '(無)'}
卡片數: ${(s.decks || []).reduce((a, d) => a + (d.cards?.length || 0), 0)}
待辦: ${(s.tasks || []).filter(t => !t.done).length}`
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
        name: (s.subjects?.find(x => x.id === subjectId)?.name || '未分類') + ' — AI 生成',
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
          title: b.title || '讀書',
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

  const style = document.createElement('style');
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      width: 56px; height: 56px; border-radius: 50%; border: 0;
      background: linear-gradient(135deg,#7c3aed,#2563eb);
      color: #fff; font-size: 22px; font-weight: 700; cursor: pointer;
      box-shadow: 0 10px 30px rgba(124,58,237,.35);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s;
    }
    .fab:hover { transform: scale(1.05); }
    .fab .dot { position:absolute; top:8px; right:8px; width:10px; height:10px;
      border-radius:50%; background:#22c55e; box-shadow:0 0 0 2px #fff; }
    .panel {
      position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
      width: min(440px, calc(100vw - 40px));
      height: min(640px, calc(100vh - 120px));
      background: #0b1020; color: #e2e8f0;
      border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,.45);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
      font-size: 14px; line-height: 1.5;
      border: 1px solid #1e293b;
    }
    .panel.hidden { display: none; }
    .panel header {
      padding: 12px 16px; background: #111827;
      display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid #1f2937;
    }
    .panel header .title { font-weight: 700; font-size: 15px; }
    .panel header .grow { flex: 1; }
    .panel header button {
      background: transparent; border: 0; color: #9ca3af; cursor: pointer;
      padding: 4px 8px; font-size: 16px;
    }
    .panel header button:hover { color: #fff; }
    .tabs { display: flex; gap: 4px; padding: 6px; background:#0f172a;
      overflow-x: auto; scrollbar-width: thin; }
    .tabs::-webkit-scrollbar { height: 4px; }
    .tabs button {
      background: transparent; border: 0; color: #94a3b8;
      padding: 6px 10px; border-radius: 6px; cursor: pointer;
      font-size: 12px; white-space: nowrap; font-weight: 500;
    }
    .tabs button.active { background: #1e293b; color: #fff; }
    .tabs button:hover:not(.active) { background: #111827; color: #e2e8f0; }
    .body { flex: 1; overflow-y: auto; padding: 12px 14px; }
    .body::-webkit-scrollbar { width: 6px; }
    .body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
    .footer { padding: 10px 12px; border-top: 1px solid #1f2937; background:#0f172a; }

    input, textarea, select {
      width: 100%; padding: 8px 10px; border-radius: 8px;
      background: #0f172a; color: #e2e8f0; border: 1px solid #334155;
      font-size: 13px; font-family: inherit;
    }
    textarea { resize: vertical; min-height: 70px; }
    input:focus, textarea:focus, select:focus { outline: 0; border-color:#7c3aed; }
    label.field { display:block; font-size:12px; color:#94a3b8; margin:10px 0 4px; }

    button.btn {
      padding: 8px 12px; border-radius: 8px; border: 1px solid #334155;
      background: #1e293b; color: #e2e8f0; cursor: pointer; font-size: 13px;
      font-family: inherit; font-weight: 500;
    }
    button.btn:hover { background: #334155; }
    button.btn.primary { background: linear-gradient(135deg,#7c3aed,#2563eb); border-color: transparent; }
    button.btn.primary:hover { filter: brightness(1.1); }
    button.btn.ghost { background: transparent; }
    button.btn.danger { background: #7f1d1d; border-color: #991b1b; }
    button.btn[disabled] { opacity:.5; cursor: not-allowed; }
    .row { display:flex; gap:8px; align-items:center; }
    .row > * { flex: none; }
    .row.wrap { flex-wrap: wrap; }
    .grow { flex: 1; }

    .msg { padding: 10px 12px; border-radius: 10px; margin-bottom: 8px;
      white-space: pre-wrap; word-wrap: break-word; }
    .msg.user { background: #1e293b; }
    .msg.ai { background: #312e81; }
    .msg.sys { background: #0f172a; color:#94a3b8; font-size:12px; font-style: italic; }

    .card-preview { background:#1e293b; border-radius:10px; padding:10px; margin-bottom:8px;
      border: 1px solid #334155; }
    .card-preview .front { font-weight:600; color:#f1f5f9; margin-bottom:4px; }
    .card-preview .back { color:#cbd5e1; font-size:13px; }

    .chip { display:inline-block; padding:2px 8px; border-radius:999px;
      background:#1e293b; color:#94a3b8; font-size:11px; margin-right:4px; }
    .chip.ok { background:#064e3b; color:#6ee7b7; }
    .chip.warn { background:#713f12; color:#fde68a; }
    .chip.ai { background: linear-gradient(135deg,#4c1d95,#1e3a8a); color:#fff; }

    .empty { text-align:center; color:#64748b; padding:30px 10px; font-size:13px; }
    h3 { margin: 4px 0 8px; font-size:14px; color:#f1f5f9; }
    hr.sep { border:0; border-top: 1px solid #1f2937; margin:12px 0; }
    .loading { color:#a78bfa; font-size:12px; }
    .kbd { font-family: ui-monospace, monospace; background:#1e293b; padding:1px 5px; border-radius:4px; font-size:11px; }
    a { color:#a78bfa; }
    details { background:#0f172a; border:1px solid #1f2937; border-radius:8px; padding:6px 10px; margin-bottom:6px; }
    details summary { cursor:pointer; color:#cbd5e1; font-size:13px; }
    .toast {
      position: fixed; left: 50%; top: 30px; transform: translateX(-50%);
      padding: 8px 16px; border-radius: 8px; background:#064e3b; color:#6ee7b7;
      z-index: 2147483647; font-size:13px; animation: fade 2.5s forwards;
    }
    .toast.err { background:#7f1d1d; color:#fecaca; }
    @keyframes fade { 0%{opacity:0;transform:translate(-50%,-8px);} 10%,85%{opacity:1;transform:translate(-50%,0);} 100%{opacity:0;transform:translate(-50%,-8px);} }
    .badge-buddy { display:inline-flex; align-items:center; gap:4px;
      padding: 2px 6px; border-radius: 999px; background:#1e293b; font-size:11px; color:#fde68a; }
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
  fab.innerHTML = '<span>AI</span><span class="dot"></span>';
  fab.title = 'Lerna AI 助手 (Ctrl+I)';
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
    if (!ui.open) return;
    panel.innerHTML = `
      <header>
        <span class="title">✨ Lerna AI</span>
        <span class="chip ai">${esc(AI.model)}</span>
        <span class="grow"></span>
        <span class="badge-buddy" title="Study Buddy">🔥 ${AI.buddy.streak}d · ${AI.buddy.points}pt</span>
        <button id="ai-close" title="關閉">✕</button>
      </header>
      <div class="tabs" id="ai-tabs">
        ${tabBtn('tutor', '家教')}
        ${tabBtn('cards', '字卡')}
        ${tabBtn('notes', '筆記')}
        ${tabBtn('mistakes', '錯題')}
        ${tabBtn('plan', '計畫')}
        ${tabBtn('reflect', '反思')}
        ${tabBtn('report', '週報')}
        ${tabBtn('ocr', 'OCR')}
        ${tabBtn('voice', '語音')}
        ${tabBtn('buddy', 'Buddy')}
        ${tabBtn('settings', '⚙︎')}
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
        <p>尚未設定 Gemini API Key</p>
        <button class="btn primary" id="go-settings">前往設定</button>
        <p style="margin-top:18px;font-size:12px;color:#64748b">
          免費取得: <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a><br/>
          建議用 <b>gemini-2.5-flash-lite</b>（免費層 1000 req/day）<br/>
          Key 只存你本機 localStorage，不會上傳給我們。
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
    const chats = AI.chats;
    if (!ui.tutorChatId && chats.length) ui.tutorChatId = chats[0].id;
    const chat = chats.find(c => c.id === ui.tutorChatId);
    body.innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <select id="chat-sel" class="grow">
          <option value="">— 新對話 —</option>
          ${chats.map(c => `<option value="${c.id}" ${c.id === ui.tutorChatId ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}
        </select>
        <button class="btn" id="new-chat">＋</button>
        ${chat ? `<button class="btn danger" id="del-chat">🗑</button>` : ''}
      </div>
      <div id="chat-msgs">
        ${(chat?.messages || []).map(m =>
          `<div class="msg ${m.role}">${m.role === 'user' ? '' : '🤖 '}${esc(m.content)}</div>`
        ).join('') || '<div class="empty">問我任何讀書/學科問題 — 我知道你現在在讀什麼</div>'}
      </div>
      ${ui.loading === 'tutor' ? '<div class="loading">思考中…</div>' : ''}
      <hr class="sep"/>
      <textarea id="tutor-input" placeholder="問任何問題… (Ctrl+Enter 送出)">${esc(ui.tutorInput)}</textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn primary grow" id="tutor-send">送出</button>
        <button class="btn" id="tutor-ctx">🧠 插入學習脈絡</button>
      </div>
    `;
    body.querySelector('#chat-sel').onchange = (e) => {
      ui.tutorChatId = e.target.value || null; render();
    };
    body.querySelector('#new-chat').onclick = () => { ui.tutorChatId = null; render(); };
    const delBtn = body.querySelector('#del-chat');
    if (delBtn) delBtn.onclick = () => {
      if (!confirm('刪除這個對話？')) return;
      updateAI({ chats: AI.chats.filter(c => c.id !== ui.tutorChatId) });
      ui.tutorChatId = null; render();
    };
    const inp = body.querySelector('#tutor-input');
    inp.oninput = (e) => { ui.tutorInput = e.target.value; };
    inp.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') body.querySelector('#tutor-send').click(); };
    body.querySelector('#tutor-ctx').onclick = () => {
      const c = ctxSummary();
      ui.tutorInput = (ui.tutorInput ? ui.tutorInput + '\n\n' : '') + '[我目前的狀態]\n' + c.summary;
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
        const sys = `你是一位溫暖、耐心、精通各科的家教，用繁體中文回答。學生目前的學習狀態:\n${ctx}\n回答時：1) 先給出清楚答案；2) 解釋核心概念；3) 若適合，出 1 個小練習。避免廢話。`;
        const history = c.messages.slice(-10).map(m => `${m.role === 'user' ? '學生' : '老師'}: ${m.content}`).join('\n\n');
        const { text } = await gemini({ prompt: history, system: sys });
        c.messages.push({ role: 'ai', content: text, ts: Date.now() });
        if (c.messages.length === 2) {
          try {
            const t = await gemini({ prompt: `用 6 字以內中文標題總結此對話主題: ${q}`, system: '只回標題純文字，無引號。' });
            c.title = (t.text || q).slice(0, 20).replace(/[\n"「」]/g, '');
          } catch {}
        }
      } catch (e) {
        c.messages.push({ role: 'sys', content: '錯誤: ' + e.message, ts: Date.now() });
      }
      ui.loading = null;
      saveAI(AI); render();
    };
  };

  /* ---------- 9b. CARDS (AutoCard) ---------- */
  renderers.cards = (body) => {
    if (!ensureKey(body)) return;
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const d = ui.drafts.cards || (ui.drafts.cards = { subjectId: subs[0]?.id || '', source: '', count: 10 });
    body.innerHTML = `
      <h3>AutoCard · 自動出字卡</h3>
      <label class="field">科目</label>
      <select id="c-sub">
        ${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        ${subs.length === 0 ? '<option value="">(請先在主畫面建立科目)</option>' : ''}
      </select>
      <label class="field">貼上筆記 / 內容 / 章節</label>
      <textarea id="c-src" style="min-height:120px" placeholder="貼上教科書片段、上課筆記、英文單字表…">${esc(d.source)}</textarea>
      <div class="row" style="margin-top:8px">
        <label class="field" style="margin:0">張數</label>
        <input id="c-n" type="number" min="3" max="30" value="${d.count}" style="width:80px"/>
        <button class="btn primary grow" id="c-gen">生成</button>
      </div>
      <hr class="sep"/>
      <h3>待套用的卡片</h3>
      <div id="c-pending">
        ${AI.pendingCards.length === 0
          ? '<div class="empty">還沒有 AI 生成的卡片</div>'
          : AI.pendingCards.map(p => `
            <details>
              <summary>📚 ${esc(subs.find(x=>x.id===p.subjectId)?.name || '未分類')} · ${p.cards.length} 張 · ${new Date(p.createdAt).toLocaleString()}</summary>
              ${p.cards.map(c => `<div class="card-preview"><div class="front">${esc(c.front)}</div><div class="back">${esc(c.back)}</div></div>`).join('')}
              <div class="row">
                <button class="btn primary" data-apply="${p.id}">套用到 Lerna</button>
                <button class="btn danger" data-del="${p.id}">刪除</button>
              </div>
            </details>
          `).join('')}
      </div>
      ${ui.loading === 'cards' ? '<div class="loading">生成中…</div>' : ''}
    `;
    body.querySelector('#c-sub').onchange = (e) => { d.subjectId = e.target.value; };
    body.querySelector('#c-src').oninput = (e) => { d.source = e.target.value; };
    body.querySelector('#c-n').oninput = (e) => { d.count = +e.target.value || 10; };
    body.querySelector('#c-gen').onclick = async () => {
      if (!d.source.trim()) { toast('請先貼上內容', true); return; }
      ui.loading = 'cards'; render();
      try {
        const { text } = await gemini({
          prompt: `從下列內容產出 ${d.count} 張繁體中文字卡。輸出 JSON 陣列 [{"front":"問題","back":"答案"}]，front 精簡明確，back 1-3 句完整。\n\n內容:\n${d.source}`,
          system: '你是字卡出題老師。只回 JSON，不要任何解釋。',
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
        toast('生成 ' + arr.length + ' 張卡片');
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
    body.querySelectorAll('[data-apply]').forEach(btn => {
      btn.onclick = () => {
        const p = AI.pendingCards.find(x => x.id === btn.dataset.apply);
        if (!p) return;
        const deck = applyCardsToV20(p.subjectId, p.cards);
        updateAI({ pendingCards: AI.pendingCards.filter(x => x.id !== p.id) });
        toast('已加入「' + deck.name + '」,重新載入頁面後可看到');
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
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const notes = s.notes || [];
    const d = ui.drafts.notes || (ui.drafts.notes = { subjectId: subs[0]?.id || '', text: '', mode: 'summary', result: '' });
    body.innerHTML = `
      <h3>筆記助手</h3>
      <label class="field">科目</label>
      <select id="n-sub">${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label class="field">模式</label>
      <select id="n-mode">
        <option value="summary" ${d.mode==='summary'?'selected':''}>📝 摘要</option>
        <option value="expand" ${d.mode==='expand'?'selected':''}>🧩 擴寫/補充</option>
        <option value="cleanup" ${d.mode==='cleanup'?'selected':''}>✨ 整理與清理</option>
        <option value="outline" ${d.mode==='outline'?'selected':''}>🗂 提綱結構化</option>
        <option value="translate" ${d.mode==='translate'?'selected':''}>🌐 翻譯成繁中</option>
      </select>
      <label class="field">輸入</label>
      <textarea id="n-txt" style="min-height:100px" placeholder="貼上原始筆記 / 段落…">${esc(d.text)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="n-go">執行</button>
      </div>
      ${ui.loading==='notes'?'<div class="loading">處理中…</div>':''}
      ${d.result ? `
        <hr class="sep"/>
        <h3>結果</h3>
        <div class="msg ai" style="white-space:pre-wrap">${esc(d.result)}</div>
        <div class="row">
          <input id="n-title" placeholder="標題" value="${esc(d.title||'AI 筆記 ' + new Date().toLocaleDateString())}" class="grow"/>
          <button class="btn primary" id="n-save">存成 Lerna 筆記</button>
        </div>` : ''}
      <hr class="sep"/>
      <h3>現有筆記 (${notes.length})</h3>
      ${notes.slice(0,5).map(n=>`<details><summary>${esc(n.title||'(無標題)')}</summary><div class="msg sys" style="white-space:pre-wrap">${esc(n.body||'').slice(0,500)}</div></details>`).join('') || '<div class="empty">(沒有筆記)</div>'}
    `;
    body.querySelector('#n-sub').onchange = (e) => { d.subjectId = e.target.value; };
    body.querySelector('#n-mode').onchange = (e) => { d.mode = e.target.value; };
    body.querySelector('#n-txt').oninput = (e) => { d.text = e.target.value; };
    const saveBtn = body.querySelector('#n-save');
    if (saveBtn) {
      const titleInp = body.querySelector('#n-title');
      titleInp.oninput = (e) => { d.title = e.target.value; };
      saveBtn.onclick = () => {
        const n = applyNoteToV20(d.subjectId, d.title || 'AI 筆記', d.result);
        toast('已存為筆記');
        setTimeout(() => location.reload(), 600);
      };
    }
    body.querySelector('#n-go').onclick = async () => {
      if (!d.text.trim()) { toast('請先輸入內容', true); return; }
      ui.loading = 'notes'; d.result = ''; render();
      const promptMap = {
        summary: '簡要摘要重點（繁體中文，條列 3-7 點）',
        expand: '將內容擴寫補充背景、舉例、延伸（繁體中文）',
        cleanup: '整理修訂成清晰結構化筆記，保留原意但表達精煉（繁體中文）',
        outline: '轉成樹狀提綱（- / 縮排），突顯層級（繁體中文）',
        translate: '翻譯為流暢的繁體中文'
      };
      try {
        const { text } = await gemini({
          prompt: `${promptMap[d.mode]}:\n\n${d.text}`,
          system: '你是筆記整理助理。輸出純文本（可含條列），不要多餘前言。'
        });
        d.result = text;
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9d. MISTAKES book ---------- */
  renderers.mistakes = (body) => {
    if (!ensureKey(body)) return;
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const d = ui.drafts.mistakes || (ui.drafts.mistakes = { subjectId: subs[0]?.id || '', q: '', w: '', c: '', note: '' });
    const now = Date.now();
    const due = AI.mistakes.filter(m => new Date(m.due).getTime() <= now);
    body.innerHTML = `
      <h3>錯題本 <span class="chip">${AI.mistakes.length} 題</span> <span class="chip warn">${due.length} 待複習</span></h3>
      <details><summary>＋ 新增錯題</summary>
        <label class="field">科目</label>
        <select id="m-sub">${subs.map(x => `<option value="${x.id}" ${x.id === d.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <label class="field">題目</label><textarea id="m-q">${esc(d.q)}</textarea>
        <label class="field">我的錯誤答案</label><textarea id="m-w" style="min-height:50px">${esc(d.w)}</textarea>
        <label class="field">正確答案（可留空，AI 幫解）</label><textarea id="m-c" style="min-height:50px">${esc(d.c)}</textarea>
        <div class="row" style="margin-top:6px">
          <button class="btn" id="m-ai">🤖 AI 解析</button>
          <button class="btn primary grow" id="m-save">儲存</button>
        </div>
        ${ui.loading==='mistakes'?'<div class="loading">解析中…</div>':''}
      </details>
      <hr class="sep"/>
      <h3>待複習 (${due.length})</h3>
      ${due.length === 0
        ? '<div class="empty">今天沒有待複習的錯題 🎉</div>'
        : due.slice(0,5).map(m => `
          <div class="card-preview">
            <div class="front">${esc(m.question)}</div>
            <div class="back"><b>正確:</b> ${esc(m.correct)}<br/><span style="color:#94a3b8">我的錯: ${esc(m.wrong)}</span></div>
            <div class="row wrap" style="margin-top:6px">
              ${[0,1,2,3,4,5].map(q => `<button class="btn" data-review="${m.id}" data-q="${q}">${['💣','😣','😐','🙂','😎','⭐'][q]}</button>`).join('')}
            </div>
          </div>`).join('')
      }
      <hr class="sep"/>
      <h3>全部錯題</h3>
      ${AI.mistakes.length === 0
        ? '<div class="empty">尚未登錄錯題</div>'
        : AI.mistakes.slice(0,20).map(m => `
          <details>
            <summary>${esc(m.question.slice(0,50))} · ${m.interval}d · ${new Date(m.due).toLocaleDateString()}</summary>
            <div class="msg sys"><b>錯:</b> ${esc(m.wrong)}<br/><b>對:</b> ${esc(m.correct)}<br/>${m.note?'<b>解析:</b> '+esc(m.note):''}</div>
            <button class="btn danger" data-mdel="${m.id}">刪除</button>
          </details>
        `).join('')}
    `;
    const e = (id) => body.querySelector(id);
    e('#m-sub')?.addEventListener('change', ev => d.subjectId = ev.target.value);
    e('#m-q').oninput = ev => d.q = ev.target.value;
    e('#m-w').oninput = ev => d.w = ev.target.value;
    e('#m-c').oninput = ev => d.c = ev.target.value;
    e('#m-ai').onclick = async () => {
      if (!d.q) { toast('請先輸入題目', true); return; }
      ui.loading = 'mistakes'; render();
      try {
        const { text } = await gemini({
          prompt: `題目: ${d.q}\n我寫的錯誤答案: ${d.w || '(未填)'}\n請用繁體中文給出：1) 正確答案 2) 為什麼我錯了 3) 關鍵概念`,
          system: '你是解題老師。精簡 3 段式回答。',
        });
        d.note = text;
        if (!d.c) {
          const { text: cc } = await gemini({
            prompt: `只輸出這題的正確答案（繁中、一句話）: ${d.q}`,
            system: '簡短直接。'
          });
          d.c = cc.trim();
        }
        toast('AI 解析完成');
      } catch (err) { toast('失敗: ' + err.message, true); }
      ui.loading = null; render();
    };
    e('#m-save').onclick = () => {
      if (!d.q) { toast('題目必填', true); return; }
      const item = {
        id: 'mis_' + Date.now(), subjectId: d.subjectId,
        question: d.q, wrong: d.w, correct: d.c, note: d.note || '',
        ease: 2.5, interval: 0, due: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      updateAI({ mistakes: [item, ...AI.mistakes] });
      ui.drafts.mistakes = { subjectId: d.subjectId, q: '', w: '', c: '', note: '' };
      toast('已加入錯題本');
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
    const s = loadYPT() || {};
    const subs = s.subjects || [];
    const cds = s.countdowns || [];
    const d = ui.drafts.plan || (ui.drafts.plan = { days: 7, hoursPerDay: 3, mood: '平衡', note: '' });
    body.innerHTML = `
      <h3>讀書計畫生成器</h3>
      <div class="msg sys">
        已知 ${subs.length} 個科目, ${cds.length} 個倒數。AI 會依你的截止日 & 過往學習時數產生計畫。
      </div>
      <label class="field">天數</label>
      <input id="p-d" type="number" min="1" max="30" value="${d.days}"/>
      <label class="field">每日可讀書 (小時)</label>
      <input id="p-h" type="number" min="0.5" max="14" step="0.5" value="${d.hoursPerDay}"/>
      <label class="field">節奏</label>
      <select id="p-m">
        ${['輕鬆','平衡','衝刺','考前狂暴'].map(x=>`<option ${x===d.mood?'selected':''}>${x}</option>`).join('')}
      </select>
      <label class="field">備註 (選填)</label>
      <textarea id="p-n" placeholder="例：下週三有英文模考、週六家庭日跳過…">${esc(d.note)}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="p-go">生成計畫</button>
      </div>
      ${ui.loading==='plan'?'<div class="loading">規劃中…</div>':''}
      ${AI.pendingPlan ? `
        <hr class="sep"/>
        <h3>建議計畫</h3>
        ${(AI.pendingPlan.days||[]).map(day=>`
          <details>
            <summary>📅 ${day.date} · ${(day.blocks||[]).length} 個時段</summary>
            ${(day.blocks||[]).map(b=>`<div class="card-preview">
              <div class="front">${esc(b.startTime)}–${esc(b.endTime)} · ${esc(b.title)}</div>
              <div class="back">科目: ${esc(subs.find(x=>x.id===b.subjectId)?.name || '—')} · ${esc(b.reason||'')}</div>
            </div>`).join('')}
          </details>
        `).join('')}
        <div class="row" style="margin-top:8px">
          <button class="btn primary grow" id="p-apply">套用到 Lerna 時間表</button>
          <button class="btn danger" id="p-clear">捨棄</button>
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
          prompt: `幫我做 ${d.days} 天讀書計畫，從 ${today} 起。每天最多 ${d.hoursPerDay} 小時。節奏: ${d.mood}。備註: ${d.note||'無'}。
學習脈絡:
${ctx.summary}
科目 ID 列表: ${subs.map(x=>`${x.name}=${x.id}`).join(', ')}
倒數事件: ${cds.map(c=>`${c.title}@${c.date}`).join('; ')||'無'}

輸出 JSON: {"days":[{"date":"YYYY-MM-DD","blocks":[{"title":"讀什麼","startTime":"HH:MM","endTime":"HH:MM","subjectId":"sub_xxx","reason":"為什麼排這裡"}]}]}
時間用 24 小時制。依倒數天數動態加權。週末可略少或略多。`,
          system: '你是讀書計畫師。只回 JSON 不要解釋。',
          json: true
        });
        const plan = JSON.parse(text);
        updateAI({ pendingPlan: plan });
        toast('計畫生成完畢');
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
    body.querySelector('#p-apply')?.addEventListener('click', () => {
      const n = applyPlanToV20(AI.pendingPlan);
      updateAI({ pendingPlan: null });
      toast(`已加入 ${n} 個時段,重新載入…`);
      setTimeout(() => location.reload(), 800);
    });
    body.querySelector('#p-clear')?.addEventListener('click', () => updateAI({ pendingPlan: null }));
  };

  /* ---------- 9f. REFLECT coach ---------- */
  renderers.reflect = (body) => {
    if (!ensureKey(body)) return;
    const s = loadYPT() || {};
    const sess = (s.sessions || []).slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 12);
    const d = ui.drafts.reflect || (ui.drafts.reflect = { sessionId: sess[0]?.id || '', q: '', note: '', result: '' });
    const cur = sess.find(x => x.id === d.sessionId);
    body.innerHTML = `
      <h3>反思教練</h3>
      <div class="msg sys">AI 幫你把一節課的「讀了什麼」轉成「真正的理解」。</div>
      <label class="field">選一節學習</label>
      <select id="r-sess">
        ${sess.map(x => `<option value="${x.id}" ${x.id===d.sessionId?'selected':''}>
          ${new Date(x.startedAt).toLocaleString()} · ${Math.round((x.duration||0)/60)}m · ${esc(s.subjects?.find(y=>y.id===x.subjectId)?.name||'—')}
        </option>`).join('')}
        ${sess.length===0?'<option value="">(沒有紀錄)</option>':''}
      </select>
      ${cur?.reflection ? `<div class="msg sys">已有反思: 品質 ${cur.reflection.quality}/5 · ${esc(cur.reflection.note||'')}</div>`:''}
      <label class="field">你剛讀的主題 / 內容</label>
      <textarea id="r-q" placeholder="例：二次函數的頂點公式、Kant 的定言令式…">${esc(d.q)}</textarea>
      <label class="field">你覺得自己學到什麼 (可留空)</label>
      <textarea id="r-note">${esc(d.note)}</textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn primary grow" id="r-go">開始蘇格拉底式提問</button>
      </div>
      ${ui.loading==='reflect'?'<div class="loading">產生中…</div>':''}
      ${d.result ? `<hr class="sep"/><div class="msg ai" style="white-space:pre-wrap">${esc(d.result)}</div>` : ''}
    `;
    body.querySelector('#r-sess').onchange = e => { d.sessionId = e.target.value; render(); };
    body.querySelector('#r-q').oninput = e => d.q = e.target.value;
    body.querySelector('#r-note').oninput = e => d.note = e.target.value;
    body.querySelector('#r-go').onclick = async () => {
      if (!d.q.trim()) { toast('請輸入主題', true); return; }
      ui.loading = 'reflect'; d.result = ''; render();
      try {
        const { text } = await gemini({
          prompt: `學生剛完成一節學習。主題: ${d.q}\n他自述: ${d.note || '(無)'}\n時長: ${cur? Math.round((cur.duration||0)/60)+'分鐘':'未知'}\n
請用繁體中文做蘇格拉底式反思：
1) 問 3 個從淺到深的問題幫他釐清理解
2) 指出 1 個他可能沒注意到的誤區
3) 給 1 個 24 小時內可以做的小練習鞏固記憶
最後一句給溫暖鼓勵。`,
          system: '你是反思教練。溫暖但有挑戰性。'
        });
        d.result = text;
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9g. WEEKLY report ---------- */
  renderers.report = (body) => {
    if (!ensureKey(body)) return;
    const s = loadYPT() || {};
    const sess = s.sessions || [];
    const today = new Date(); const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
    const recent = sess.filter(se => new Date(se.startedAt) >= weekAgo);
    const bySub = {};
    recent.forEach(se => { bySub[se.subjectId] = (bySub[se.subjectId]||0) + (se.duration||0); });
    const topSub = Object.entries(bySub).sort((a,b)=>b[1]-a[1])[0];
    const totalMin = Math.round(recent.reduce((a,b)=>a+(b.duration||0)/60,0));
    body.innerHTML = `
      <h3>週報</h3>
      <div class="msg sys">
        近 7 日：<b>${totalMin}</b> 分鐘 · ${recent.length} 節 · 平均 <b>${(totalMin/7).toFixed(0)}</b> 分/日<br/>
        最常讀：${topSub ? esc(s.subjects?.find(x=>x.id===topSub[0])?.name || '—') + ' (' + Math.round(topSub[1]/60) + '分)' : '—'}
      </div>
      <button class="btn primary" id="rep-go">📝 生成 AI 週報 & 建議</button>
      ${ui.loading==='report'?'<div class="loading">分析中…</div>':''}
      <hr class="sep"/>
      ${AI.weeklyReports.length === 0 ? '<div class="empty">尚未產生報告</div>' :
        AI.weeklyReports.slice(0,5).map(r => `
          <details ${r===AI.weeklyReports[0]?'open':''}>
            <summary>${esc(r.range)} · ${new Date(r.createdAt).toLocaleDateString()}</summary>
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
          prompt: `根據數據給一份繁體中文週報（300字內）：
- 總時數: ${totalMin} 分鐘 / 7 天
- 每日: ${statsText}
- 各科: ${subText}
- 節數: ${recent.length}
輸出：1) 關鍵發現 2-3 點 2) 強項與隱憂 3) 下週 3 個具體行動建議（含可量化目標）。用 Gen Z 口吻但不失專業。`,
          system: '你是讀書分析師,用真實數據說話,不吹捧。'
        });
        const r = {
          id: 'rep_'+Date.now(),
          range: weekAgo.toISOString().slice(0,10) + ' ~ ' + today.toISOString().slice(0,10),
          body: text,
          createdAt: new Date().toISOString()
        };
        updateAI({ weeklyReports: [r, ...AI.weeklyReports].slice(0,20) });
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9h. OCR ---------- */
  renderers.ocr = (body) => {
    if (!ensureKey(body)) return;
    const d = ui.drafts.ocr || (ui.drafts.ocr = { imgData: null, mime: '', result: '', mode: 'transcribe' });
    body.innerHTML = `
      <h3>OCR / 圖片助手</h3>
      <div class="msg sys">上傳講義/筆記/題目照片,AI 幫你轉文字、解題、做字卡。</div>
      <input type="file" id="ocr-file" accept="image/*"/>
      ${d.imgData ? `
        <div style="position:relative;display:inline-block;margin:6px 0;max-width:100%">
          <img src="data:${d.mime};base64,${d.imgData}" style="display:block;max-width:100%;max-height:180px;border-radius:8px"/>
          <button type="button" id="ocr-clear" aria-label="移除圖片" title="移除圖片"
            style="position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:999px;border:none;cursor:pointer;background:rgba(0,0,0,.65);color:#fff;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center">✕</button>
        </div>` : ''}
      <label class="field">要做什麼</label>
      <select id="ocr-mode">
        <option value="transcribe" ${d.mode==='transcribe'?'selected':''}>📝 純轉文字</option>
        <option value="summary" ${d.mode==='summary'?'selected':''}>📑 轉文字 + 摘要</option>
        <option value="solve" ${d.mode==='solve'?'selected':''}>🧮 把題目解出來</option>
        <option value="cards" ${d.mode==='cards'?'selected':''}>📚 直接生成字卡</option>
      </select>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="ocr-go" ${d.imgData?'':'disabled'}>執行</button>
      </div>
      ${ui.loading==='ocr'?'<div class="loading">OCR 中…</div>':''}
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
        transcribe: '把圖片中的文字完整轉成繁體中文文字,保留原排版 (用換行/縮排)。',
        summary: '先完整轉文字,再用 3-5 條摘要。',
        solve: '辨識題目,然後完整解題 (步驟 + 答案)。繁體中文。',
        cards: '辨識內容後,輸出 JSON 陣列 [{"front":"q","back":"a"}] 至少 8 張字卡,繁體中文。'
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
            source: '[OCR 圖片]',
            cards: arr,
            createdAt: new Date().toISOString()
          });
          saveAI(AI);
          d.result = `已生成 ${arr.length} 張字卡 — 到「字卡」頁套用。`;
        } else {
          d.result = text;
        }
      } catch (e) { toast('失敗: ' + e.message, true); }
      ui.loading = null; render();
    };
  };

  /* ---------- 9i. VOICE vocabulary ---------- */
  renderers.voice = (body) => {
    if (!ensureKey(body)) return;
    const d = ui.drafts.voice || (ui.drafts.voice = { word: '', listening: false });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canListen = !!SR;
    const canSpeak = !!window.speechSynthesis;
    const appLang = loadYPT()?.settings?.lang === 'en' ? 'en-US' : 'zh-TW';
    const isFileProtocol = location.protocol === 'file:';
    const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
    const hasSpeechSafeOrigin = location.protocol === 'https:' || isLocalhost || isFileProtocol;
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
      if (mic) mic.textContent = on ? '🔴 停止' : '🎤';
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
      setMicState(false);
    };
    const explainSpeechError = (code) => {
      switch (code) {
        case 'not-allowed':
          return '麥克風權限被拒，請在瀏覽器網址列點鎖頭重新授權。';
        case 'no-speech':
          return '沒偵測到聲音，請再試一次。';
        case 'audio-capture':
          return '找不到可用的麥克風，請確認裝置或系統輸入來源。';
        case 'network':
          return '語音辨識連線失敗，請檢查網路後再試。';
        case 'service-not-allowed':
          return '這個瀏覽器環境不允許語音辨識服務，請改用 Chrome / Edge。';
        case 'aborted':
          return '語音辨識已中止。';
        default:
          return '麥克風啟動失敗，請再試一次。';
      }
    };
    const addSpeechContextHint = (msg, code) => {
      if ((code === 'not-allowed' || code === 'service-not-allowed') && isFileProtocol) {
        return msg + ' file:// 可能被瀏覽器阻擋，可改用本地 web server（如 npx serve）載入。';
      }
      if ((code === 'not-allowed' || code === 'service-not-allowed') && !hasSpeechSafeOrigin) {
        return msg + ' 目前不是 https / localhost，請改用安全來源或本地 web server 載入。';
      }
      return msg;
    };
    body.innerHTML = `
      <h3>語音單字 <span class="chip">${AI.voiceWords.length} 個</span></h3>
      <div class="msg sys">對麥克風說一個單字，或輸入 → AI 給定義/例句，按🔊聽發音。</div>
      ${!canListen ? '<div class="msg sys" style="margin-top:8px">此瀏覽器不支援 Web Speech API — 請用 Chrome / Edge，或直接輸入。</div>' : ''}
      ${canListen && !hasSpeechSafeOrigin ? '<div class="msg sys" style="margin-top:8px">目前不是 https / localhost，瀏覽器可能阻擋麥克風或語音辨識。建議改用安全來源、localhost，或本地 web server 載入。</div>' : ''}
      <div class="row">
        <input id="v-word" placeholder="輸入或聽…" value="${esc(d.word)}" class="grow"/>
        <button class="btn" id="v-mic" ${canListen?'':'disabled'}>${d.listening?'🔴 停止':'🎤'}</button>
        <button class="btn" id="v-speak" ${canSpeak?'':'disabled'}>🔊</button>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="v-go">📖 查詢</button>
      </div>
      ${ui.loading==='voice'?'<div class="loading">查詢中…</div>':''}
      <hr class="sep"/>
      <h3>單字本</h3>
      ${AI.voiceWords.length===0?'<div class="empty">還沒存單字</div>':
        AI.voiceWords.slice(0,30).map(w => `
          <details>
            <summary>${esc(w.word)} ${w.ipa?`<span class="chip">${esc(w.ipa)}</span>`:''}</summary>
            <div class="msg sys" style="white-space:pre-wrap">${esc(w.definition)}
${(w.examples||[]).map(x=>'• '+x).join('\n')}</div>
            <div class="row">
              <button class="btn" data-say="${esc(w.word)}">🔊</button>
              <button class="btn danger" data-vdel="${w.id}">刪</button>
            </div>
          </details>
        `).join('')}
    `;
    const wInp = body.querySelector('#v-word');
    wInp.oninput = e => d.word = e.target.value;
    body.querySelector('#v-mic').onclick = () => {
      if (!canListen) {
        toast('此瀏覽器不支援 Web Speech API — 請用 Chrome / Edge，或直接輸入。', true);
        return;
      }
      if (d.listening && window.__recog) {
        releaseRecognizer(true);
        return;
      }
      if (window.__recog) releaseRecognizer(true);
      const r = new SR();
      r.lang = getSpeechLang(d.word);
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e) => {
        let final = '', interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const txt = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += txt;
          else interim += txt;
        }
        d.word = (final + interim).trim();
        updateWordInput();
      };
      r.onerror = (ev) => {
        const code = ev?.error || 'unknown';
        releaseRecognizer(false);
        toast(addSpeechContextHint(explainSpeechError(code), code), true);
      };
      r.onend = () => {
        if (window.__recog === r) window.__recog = null;
        setMicState(false);
      };
      try {
        window.__recog = r;
        setMicState(true);
        r.start();
      } catch (e) {
        releaseRecognizer(false);
        toast('麥克風啟動失敗: ' + (e?.message || e), true);
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
          prompt: `單字: "${w}"。輸出 JSON: {"word":"原詞","ipa":"音標(若適用)","definition":"繁中精簡定義","examples":["例句1","例句2"]}`,
          system: '你是字典。只回 JSON。',
          json: true
        });
        const obj = JSON.parse(text);
        const item = { id:'vw_'+Date.now(), ...obj, createdAt:new Date().toISOString() };
        updateAI({ voiceWords: [item, ...AI.voiceWords] });
        d.word = '';
        toast('已加入單字本');
      } catch (e) { toast('失敗: ' + e.message, true); }
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
    const b = AI.buddy;
    const s = loadYPT() || {};
    const todaySess = (s.sessions||[]).filter(x=>(x.startedAt||'').slice(0,10)===new Date().toISOString().slice(0,10));
    const todayMin = Math.round(todaySess.reduce((a,c)=>a+(c.duration||0)/60,0));
    const goal = s.settings?.dailyGoalMinutes || 120;
    const progress = Math.min(100, (todayMin/goal)*100);
    const mood = todayMin >= goal ? '超讚! ✨' : todayMin > goal*0.5 ? '穩穩的 💪' : todayMin > 0 ? '開始了就贏一半 🌱' : '還沒開始哦 😴';
    body.innerHTML = `
      <h3>Study Buddy — ${esc(b.name)}</h3>
      <div style="text-align:center;padding:16px;background:#1e293b;border-radius:12px;margin-bottom:10px">
        <div style="font-size:48px">${todayMin>=goal?'🎉':todayMin>0?'📚':'💤'}</div>
        <div style="font-size:13px;color:#94a3b8;margin:4px 0">${esc(mood)}</div>
        <div style="font-size:18px;font-weight:700">${todayMin} / ${goal} 分鐘</div>
        <div style="height:8px;background:#0f172a;border-radius:4px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#7c3aed,#2563eb)"></div>
        </div>
      </div>
      <div class="row wrap">
        <span class="chip">🔥 連續 ${b.streak} 天</span>
        <span class="chip">⭐ ${b.points} 點</span>
        <span class="chip">🕐 今日 ${todaySess.length} 節</span>
      </div>
      <hr class="sep"/>
      <label class="field">Buddy 名字</label>
      <input id="b-name" value="${esc(b.name)}"/>
      <label class="field">個性</label>
      <select id="b-mood">
        ${['chill','hyped','strict','wise','silly'].map(x=>`<option ${x===b.mood?'selected':''}>${x}</option>`).join('')}
      </select>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" id="b-talk">💬 叫 Buddy 說話</button>
      </div>
      ${ui.drafts.buddyMsg ? `<div class="msg ai" style="margin-top:8px">${esc(ui.drafts.buddyMsg)}</div>` : ''}
      ${ui.loading==='buddy'?'<div class="loading">Buddy 思考中…</div>':''}
    `;
    body.querySelector('#b-name').onchange = e => updateAI({ buddy: {...AI.buddy, name: e.target.value }});
    body.querySelector('#b-mood').onchange = e => updateAI({ buddy: {...AI.buddy, mood: e.target.value }});
    body.querySelector('#b-talk').onclick = async () => {
      if (!AI.apiKey) { ui.drafts.buddyMsg = '（設定 API Key 後我才有話說）'; render(); return; }
      ui.loading = 'buddy'; render();
      try {
        const ctx = ctxSummary();
        const { text } = await gemini({
          prompt: `你是名叫 ${b.name} 的讀書同伴，個性: ${b.mood}。Gen Z 口吻、繁體中文，一段話 60 字內。根據數據給今天一句話 (鼓勵/吐槽/提醒都可):\n${ctx.summary}\n連續 ${b.streak} 天、${b.points} 點。`,
          system: '像朋友不是教練。別說教。'
        });
        ui.drafts.buddyMsg = text;
      } catch (e) { ui.drafts.buddyMsg = 'Buddy 卡住了: '+e.message; }
      ui.loading = null; render();
    };
  };

  /* ---------- 9k. SETTINGS ---------- */
  renderers.settings = (body) => {
    body.innerHTML = `
      <h3>⚙︎ 設定</h3>
      <label class="field">Gemini API Key <span style="color:#64748b">(只存瀏覽器)</span></label>
      <input id="s-key" type="password" placeholder="AIza…" value="${esc(AI.apiKey)}"/>
      <p style="font-size:12px;color:#94a3b8;margin-top:4px">
        <a href="https://aistudio.google.com/apikey" target="_blank">免費取得 →</a>
      </p>

      <label class="field">模型</label>
      <select id="s-model">
        <option value="gemini-2.5-flash-lite" ${AI.model==='gemini-2.5-flash-lite'?'selected':''}>
          gemini-2.5-flash-lite (免費 1000/日, 推薦)
        </option>
        <option value="gemini-2.5-flash" ${AI.model==='gemini-2.5-flash'?'selected':''}>
          gemini-2.5-flash (更強, 付費)
        </option>
        <option value="gemini-2.5-pro" ${AI.model==='gemini-2.5-pro'?'selected':''}>
          gemini-2.5-pro (最強, 付費)
        </option>
      </select>

      <hr class="sep"/>
      <h3>資料管理</h3>
      <div class="row wrap">
        <button class="btn" id="s-test">🧪 測試 API</button>
        <button class="btn" id="s-export">📤 匯出 AI 資料</button>
        <button class="btn" id="s-import">📥 匯入</button>
        <button class="btn danger" id="s-reset">🗑 清空 AI 資料</button>
      </div>
      <input type="file" id="s-file" accept=".json" style="display:none"/>

      <hr class="sep"/>
      <h3>關於 Lerna AI v21</h3>
      <div class="msg sys">
        層疊在 v20 之上的 AI sidecar。<br/>
        • 原始資料 key: <span class="kbd">ypt_app_state_v6</span><br/>
        • AI 資料 key: <span class="kbd">lerna_ai_v1</span><br/>
        • 快捷鍵: <span class="kbd">Ctrl + I</span> 開關面板<br/>
        • 免註冊 / 無後端 / 離線也能用 (需 API Key 聯外 for AI 功能)
      </div>
    `;
    body.querySelector('#s-key').onchange = e => updateAI({ apiKey: e.target.value.trim() });
    body.querySelector('#s-model').onchange = e => updateAI({ model: e.target.value });
    body.querySelector('#s-test').onclick = async () => {
      try { const { text } = await gemini({ prompt: '回答「OK」兩個英文字母。' }); toast('API 正常: '+text.slice(0,30)); }
      catch (e) { toast('失敗: '+e.message, true); }
    };
    body.querySelector('#s-export').onclick = () => {
      const blob = new Blob([JSON.stringify(AI, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lerna-ai-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
    };
    body.querySelector('#s-import').onclick = () => body.querySelector('#s-file').click();
    body.querySelector('#s-file').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { const obj = JSON.parse(r.result); updateAI(Object.assign(defaultAI(), obj)); toast('匯入成功'); }
        catch { toast('檔案無效', true); }
      };
      r.readAsText(f);
    };
    body.querySelector('#s-reset').onclick = () => {
      if (!confirm('清空所有 AI 資料？(不會動到 Lerna 主資料)')) return;
      localStorage.removeItem(AI_KEY);
      AI = defaultAI(); saveAI(AI); render();
      toast('已清空');
    };
  };

  /* ---------- 10. Session-reflection auto-hook (P0) ---------- */
  // When v20 writes a new reflection into a session, offer AI follow-up.
  let lastSessionCount = (loadYPT()?.sessions || []).length;
  setInterval(() => {
    const s = loadYPT();
    if (!s?.sessions) return;
    if (s.sessions.length > lastSessionCount) {
      const latest = s.sessions[s.sessions.length - 1];
      lastSessionCount = s.sessions.length;
      if (latest?.reflection && AI.apiKey) {
        // open panel to reflect tab with this session
        ui.drafts.reflect = {
          sessionId: latest.id,
          q: latest.reflection.whatFinished || '',
          note: latest.reflection.note || '',
          result: ''
        };
        toast('偵測到新反思 — 點 AI 按鈕 → 反思頁深化');
      }
    }
  }, 5000);

  /* ---------- 11. Initial render ---------- */
  console.info('[Lerna AI v21] sidecar loaded · key='+YPT_KEY+' · ai-key='+AI_KEY);
  render();
})();

