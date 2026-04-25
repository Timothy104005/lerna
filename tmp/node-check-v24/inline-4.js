
/* ============================================================
   YPT++ v23 Upgrade Sidecar
   - Layered on top of YPT++ v22 (does NOT modify the React bundle)
   - Reads app state from localStorage key: "ypt_app_state_v6"
   - Stores v23 additions in:    "ypt_v23_upgrade_v1"
   - Features:
       1. Avatar system  — upload / emoji / initial+color (editor modal)
       2. Group chat + announcement + admin roles
       3. Weekly challenge + new rank dimensions + contribution
   ============================================================ */
(() => {
  'use strict';

  const APP_KEY = 'ypt_app_state_v6';
  const V23_KEY = 'ypt_v23_upgrade_v1';

  // ========== localStorage helpers ==========
  function readApp() {
    try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeApp(s) {
    try { localStorage.setItem(APP_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function readV23() {
    try { return JSON.parse(localStorage.getItem(V23_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeV23(s) {
    try { localStorage.setItem(V23_KEY, JSON.stringify(s)); } catch (e) {}
  }

  // ========== i18n ==========
  const STR = {
    'zh-TW': {
      editAvatar: '編輯頭像',
      avatarKindImg: '自訂圖片',
      avatarKindEmoji: 'Emoji',
      avatarKindInit: '文字首字',
      avatarImageHint: '圖片會被壓縮至 256×256 並只儲存在本機',
      avatarBgColor: '底色',
      save: '儲存', cancel: '取消', reset: '重設',
      announcement: '公告',
      announcementPlaceholder: '（尚無公告）',
      editAnnouncement: '編輯公告',
      announcementHint: '僅管理員可編輯，成員皆可閱讀',
      chat: '聊天', chatPlaceholder: '輸入訊息後按 Enter 送出，Shift+Enter 換行…',
      chatEmpty: '還沒有訊息 — 打聲招呼吧！',
      roleAdmin: '管理員', roleMember: '成員',
      adminBadge: '你是管理員',
      onlyAdmins: '僅管理員可用',
      adminTools: '管理員工具',
      manageMembers: '管理成員',
      promoteDemote: '提權 / 降權',
      weekChallenge: '本週挑戰',
      weekChallengeHint: '本週群組累積專注分鐘的團體目標',
      weekChallengeTarget: '目標（分鐘）',
      setChallenge: '設定目標',
      rankFocus: '今日專注',
      rankWeek: '本週累積',
      rankLongest: '最長 Session',
      rankConsistency: '打卡率',
      contribution: '貢獻排行',
      personalContribution: '我的本週貢獻',
      challengeShare: '挑戰參與',
      memberProfile: '成員週統計',
      close: '關閉',
      daysActive: '活躍天數',
      longestSession: '最長 session',
      weekTotal: '本週累積',
      todayFocus: '今日專注',
      noData: '—',
      justNow: '剛剛',
      minAgo: '分鐘前',
      hrAgo: '小時前',
      yesterday: '昨天',
      send: '送出',
    },
    en: {
      editAvatar: 'Edit Avatar',
      avatarKindImg: 'Custom image',
      avatarKindEmoji: 'Emoji',
      avatarKindInit: 'Text initial',
      avatarImageHint: 'Image will be resized to 256×256 and stored only on this device',
      avatarBgColor: 'Background color',
      save: 'Save', cancel: 'Cancel', reset: 'Reset',
      announcement: 'Announcement',
      announcementPlaceholder: '(no announcement yet)',
      editAnnouncement: 'Edit announcement',
      announcementHint: 'Admins only can edit; visible to all members',
      chat: 'Chat', chatPlaceholder: 'Press Enter to send, Shift+Enter for a new line…',
      chatEmpty: 'No messages yet — say hi!',
      roleAdmin: 'Admin', roleMember: 'Member',
      adminBadge: 'You are an admin',
      onlyAdmins: 'Admins only',
      adminTools: 'Admin tools',
      manageMembers: 'Manage members',
      promoteDemote: 'Promote / demote',
      weekChallenge: 'Week Challenge',
      weekChallengeHint: 'Group-level target focus minutes for this week',
      weekChallengeTarget: 'Target (minutes)',
      setChallenge: 'Set target',
      rankFocus: 'Focus today',
      rankWeek: 'This-week total',
      rankLongest: 'Longest session',
      rankConsistency: 'Check-in rate',
      contribution: 'Contribution rank',
      personalContribution: 'My weekly contribution',
      challengeShare: 'Challenge share',
      memberProfile: 'Member week stats',
      close: 'Close',
      daysActive: 'Days active',
      longestSession: 'Longest session',
      weekTotal: 'This-week total',
      todayFocus: 'Focus today',
      noData: '—',
      justNow: 'just now',
      minAgo: 'm ago',
      hrAgo: 'h ago',
      yesterday: 'yesterday',
      send: 'Send',
    }
  };
  function normalizeLang(lang) {
    return /^en/i.test(String(lang || '')) ? 'en' : 'zh-TW';
  }
  function L() {
    const s = readApp();
    return normalizeLang(s.settings && s.settings.lang);
  }
  function T(k) {
    const m = STR[L()] || STR['zh-TW'];
    return (k in m) ? m[k] : k;
  }

  // ========== utilities ==========
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function mondayOfWeek(d) {
    const dt = new Date(d);
    const wd = (dt.getDay() + 6) % 7; // 0 = Monday
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() - wd);
    return dt.toISOString().slice(0, 10);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // Compress image file → base64 JPEG, square-cropped, max 256px
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 256; quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          try {
            const side = Math.min(img.width, img.height);
            const sx = Math.round((img.width - side) / 2);
            const sy = Math.round((img.height - side) / 2);
            const canvas = document.createElement('canvas');
            const out = Math.min(maxDim, side);
            canvas.width = out; canvas.height = out;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (err) { reject(err); }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ========== one-time CSS ==========
  const STYLE_CSS = [
    '.ypt-v23-groups-host{margin:12px 0 16px;}',
    '.ypt-v23-groups-shell{display:grid;gap:12px;}',
    '.ypt-v23-avatar-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:9999px;overflow:hidden;pointer-events:none;}',
    '.ypt-v23-avatar-overlay img{width:100%;height:100%;object-fit:cover;border-radius:9999px;}',
    '.ypt-v23-avatar-overlay .emo{line-height:1;}',
    '.ypt-v23-edit-avatar-btn{position:absolute;right:-6px;bottom:-6px;width:24px;height:24px;border-radius:9999px;background:#fff;border:1px solid var(--accent-border,#d4e7e4);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;color:var(--accent,#4a7c74);box-shadow:0 1px 2px rgba(0,0,0,.08);padding:0;}',
    '.ypt-v23-edit-avatar-btn:hover{background:var(--accent-soft,#f0f7f5);}',
    '.ypt-v23-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;}',
    '.ypt-v23-modal{background:#faf9f6;border-radius:16px;max-width:440px;width:100%;padding:24px;border:1px solid #e7e3dd;max-height:88vh;overflow:auto;font-family:inherit;color:#1a1a1a;box-shadow:0 20px 50px rgba(32,25,18,.14);}',
    '.ypt-v23-modal h2{font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 12px;}',
    '.ypt-v23-modal .tabs{display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid #f0ede8;}',
    '.ypt-v23-modal .tab{padding:8px 12px;font-size:12px;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;user-select:none;}',
    '.ypt-v23-modal .tab.active{color:var(--accent,#4a7c74);border-bottom-color:var(--accent,#4a7c74);font-weight:600;}',
    '.ypt-v23-modal input[type=text],.ypt-v23-modal input[type=number]{width:100%;padding:8px 12px;font-size:14px;border:1px solid #d1cec9;border-radius:8px;background:#f5f3ef;color:#1a1a1a;}',
    '.ypt-v23-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;border:1px solid #d1cec9;background:#fff;color:#1a1a1a;cursor:pointer;font-family:inherit;line-height:1.2;}',
    '.ypt-v23-btn.primary{background:var(--accent,#4a7c74);color:#fff;border-color:var(--accent,#4a7c74);}',
    '.ypt-v23-btn:hover{background:var(--accent-soft,#f0f7f5);}',
    '.ypt-v23-btn.primary:hover{opacity:.9;}',
    '.ypt-v23-emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;}',
    '.ypt-v23-emoji-grid button{font-size:22px;padding:6px;border-radius:8px;background:#fff;border:1px solid transparent;cursor:pointer;line-height:1;}',
    '.ypt-v23-emoji-grid button:hover{background:var(--accent-soft,#f0f7f5);}',
    '.ypt-v23-emoji-grid button.selected{border-color:var(--accent,#4a7c74);background:var(--accent-soft,#f0f7f5);}',
    '.ypt-v23-preview-circle{width:96px;height:96px;border-radius:9999px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;overflow:hidden;font-size:36px;font-weight:600;background:var(--accent-border,#d4e7e4);}',
    '.ypt-v23-preview-circle img{width:100%;height:100%;object-fit:cover;}',
    '.ypt-v23-card{background:#fff;border:1px solid #e7e3dd;border-radius:14px;padding:14px;box-shadow:0 1px 2px rgba(32,25,18,.04);}',
    '.ypt-v23-card h3{font-size:13px;font-weight:600;color:#1a1a1a;margin:0 0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.ypt-v23-admin-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--accent-soft,#f0f7f5);border:1px solid var(--accent-border,#d4e7e4);border-radius:12px;padding:9px 11px;font-size:12px;color:var(--accent,#4a7c74);}',
    '.ypt-v23-admin-bar:empty{display:none;}',
    '.ypt-v23-admin-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}',
    '.ypt-v23-muted{font-size:11px;color:#9ca3af;}',
    '.ypt-v23-ann-text{font-size:13px;color:#1a1a1a;white-space:pre-wrap;line-height:1.5;}',
    '.ypt-v23-chat-feed{max-height:300px;overflow-y:auto;padding:10px;background:#faf9f6;border:1px solid #f0ede8;border-radius:12px;display:flex;flex-direction:column;gap:8px;}',
    '.ypt-v23-chat-msg{display:flex;align-items:flex-end;gap:7px;font-size:13px;line-height:1.45;}',
    '.ypt-v23-chat-msg.mine{justify-content:flex-end;}',
    '.ypt-v23-chat-msg.other{justify-content:flex-start;}',
    '.ypt-v23-chat-bubble{max-width:78%;padding:8px 10px;border-radius:14px;background:#fff;border:1px solid #f0ede8;color:#1a1a1a;white-space:pre-wrap;overflow-wrap:anywhere;}',
    '.ypt-v23-chat-msg.mine .ypt-v23-chat-bubble{background:var(--accent,#4a7c74);border-color:var(--accent,#4a7c74);color:#fff;border-bottom-right-radius:5px;}',
    '.ypt-v23-chat-msg.other .ypt-v23-chat-bubble{border-bottom-left-radius:5px;}',
    '.ypt-v23-chat-msg.pinned .ypt-v23-chat-bubble{box-shadow:inset 3px 0 0 #f5c24a;}',
    '.ypt-v23-chat-avatar{width:24px;height:24px;border-radius:9999px;background:var(--accent-border,#d4e7e4);color:var(--accent,#4a7c74);display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:10px;font-weight:700;position:relative;overflow:hidden;}',
    '.ypt-v23-chat-meta{font-size:10px;color:#9ca3af;margin-bottom:3px;display:flex;gap:5px;align-items:center;}',
    '.ypt-v23-chat-msg.mine .ypt-v23-chat-meta{justify-content:flex-end;color:rgba(255,255,255,.78);}',
    '.ypt-v23-chat-actions{display:inline-flex;gap:3px;margin-left:4px;}',
    '.ypt-v23-chat-actions button{font-size:10px;border:0;background:transparent;color:inherit;cursor:pointer;padding:0 2px;}',
    '.ypt-v23-chat-input{display:flex;gap:8px;margin-top:8px;}',
    '.ypt-v23-chat-input textarea{flex:1;min-height:40px;max-height:110px;resize:vertical;padding:8px 12px;border:1px solid #d1cec9;border-radius:10px;font-size:13px;background:#fff;color:#1a1a1a;font-family:inherit;line-height:1.4;}',
    '.ypt-v23-bar{height:8px;background:#f0ede8;border-radius:4px;overflow:hidden;}',
    '.ypt-v23-bar>div{height:100%;background:var(--accent,#4a7c74);transition:width .3s;}',
    '.ypt-v23-role-pill{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-soft,#f0f7f5);color:var(--accent,#4a7c74);border:1px solid var(--accent-border,#d4e7e4);margin-left:6px;}',
    '.ypt-v23-role-pill.admin{background:#fff6d6;border-color:#f5ddaa;color:#8f6b17;}',
    '.ypt-v23-personal-card{background:#faf9f6;border:1px solid #f0ede8;border-radius:12px;padding:10px;margin-bottom:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
    '.ypt-v23-personal-card .stat{background:#fff;border:1px solid #f0ede8;border-radius:10px;padding:8px;}',
    '.ypt-v23-personal-card .label{font-size:10px;color:#9ca3af;margin-bottom:2px;}',
    '.ypt-v23-personal-card .value{font-size:14px;font-weight:700;color:#1a1a1a;}',
    '.ypt-v23-rank-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
    '.ypt-v23-rank-tabs button{font-size:11px;padding:4px 10px;border-radius:9999px;border:1px solid #d1cec9;background:#fff;color:#6b7280;cursor:pointer;font-family:inherit;}',
    '.ypt-v23-rank-tabs button.active{background:var(--accent,#4a7c74);color:#fff;border-color:var(--accent,#4a7c74);}',
    '.ypt-v23-rank-row{display:flex;align-items:center;padding:7px 4px;border-bottom:1px dashed #f0ede8;cursor:pointer;gap:8px;}',
    '.ypt-v23-rank-row:hover{background:#faf9f6;}',
    '.ypt-v23-rank-row:last-child{border-bottom:0;}',
    '.ypt-v23-member-admin-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #f0ede8;}',
    '.ypt-v23-member-admin-row:last-child{border-bottom:0;}',
  ].join('\n');

  let styleInjected = false;
  function ensureStyle() {
    if (styleInjected || !document.head) return;
    const s = document.createElement('style');
    s.id = 'ypt-v23-upgrade-style';
    s.textContent = STYLE_CSS;
    document.head.appendChild(s);
    styleInjected = true;
  }

  // ========== AVATAR SYSTEM ==========
  function getMyAvatar() {
    const s = readApp();
    const st = s.settings || {};
    const pf = s.profile || {};
    return {
      kind: st.avatarKind || 'initial',
      value: st.avatarValue || '',
      bg: st.avatarBg || '#d4e7e4',
      name: pf.name || st.userName || 'You',
    };
  }
  function setMyAvatar(av) {
    const s = readApp();
    s.settings = s.settings || {};
    s.settings.avatarKind = av.kind;
    s.settings.avatarValue = av.value;
    s.settings.avatarBg = av.bg;
    writeApp(s);
    applyAvatarOverlays();
  }

  const EMOJIS = ['🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐙','🦋','🐢','🦉','🐣','🌱','🍀','🌸','🌻','📘','✏️','🖊️','☕','🍵','🧋','⭐','🔥'];

  function renderAvatarInto(el, av) {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    let ov = el.querySelector(':scope > .ypt-v23-avatar-overlay');
    if (av.kind === 'initial' || !av.value) {
      if (ov) ov.remove();
      if (av.bg) el.style.backgroundColor = av.bg;
      return;
    }
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'ypt-v23-avatar-overlay';
      el.appendChild(ov);
    }
    ov.innerHTML = '';
    if (av.kind === 'image' && av.value) {
      const img = document.createElement('img');
      img.src = av.value;
      img.alt = '';
      ov.appendChild(img);
    } else if (av.kind === 'emoji' && av.value) {
      const span = document.createElement('span');
      span.className = 'emo';
      span.textContent = av.value;
      // Size emoji to roughly 60% of circle so padding reads right
      const rect = el.getBoundingClientRect();
      span.style.fontSize = Math.max(12, Math.round(rect.width * 0.62)) + 'px';
      ov.appendChild(span);
    }
    if (av.bg) el.style.backgroundColor = av.bg;
  }

  function findMyAvatarCircles() {
    const app = readApp();
    const name = (app.profile && app.profile.name) || (app.settings && app.settings.userName) || 'Y';
    const firstChar = ((name[0] || '?').toUpperCase());
    // v22 uses Tailwind arbitrary class bg-[#d4e7e4] for "my" avatar everywhere it appears
    const sel = 'div.rounded-full.bg-\\[\\#d4e7e4\\]';
    const candidates = document.querySelectorAll(sel);
    const mine = [];
    candidates.forEach(el => {
      const txt = (el.textContent || '').trim();
      if (txt.length <= 3 && txt.toUpperCase().indexOf(firstChar) === 0) {
        mine.push(el);
      }
    });
    return mine;
  }

  function applyAvatarOverlays() {
    try {
      const av = getMyAvatar();
      const circles = findMyAvatarCircles();
      circles.forEach(el => renderAvatarInto(el, av));
    } catch (e) { /* ignore */ }
  }

  function injectEditAvatarButton() {
    // Target the 64px circle on the Profile page: w-16 h-16 rounded-full bg-[#d4e7e4]
    const sel = 'div.w-16.h-16.rounded-full.bg-\\[\\#d4e7e4\\]';
    const el = document.querySelector(sel);
    if (!el) return;
    if (el.querySelector(':scope > .ypt-v23-edit-avatar-btn')) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ypt-v23-edit-avatar-btn';
    btn.title = T('editAvatar');
    btn.setAttribute('aria-label', T('editAvatar'));
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    btn.onclick = e => { e.stopPropagation(); e.preventDefault(); openAvatarEditor(); };
    el.appendChild(btn);
  }

  function openAvatarEditor() {
    ensureStyle();
    const cur = getMyAvatar();
    let tmp = { kind: cur.kind, value: cur.value, bg: cur.bg };
    let active = (cur.kind === 'image' || cur.kind === 'emoji') ? cur.kind : 'initial';

    const bg = document.createElement('div');
    bg.className = 'ypt-v23-modal-bg';
    bg.onclick = e => { if (e.target === bg) close(); };
    const modal = document.createElement('div');
    modal.className = 'ypt-v23-modal';
    bg.appendChild(modal);

    function renderPreview() {
      const p = modal.querySelector('#v23-preview');
      if (!p) return;
      const app = readApp();
      const nm = (app.profile && app.profile.name) || 'Y';
      p.style.backgroundColor = tmp.bg || '#d4e7e4';
      if (tmp.kind === 'image' && tmp.value) {
        p.innerHTML = '<img src="' + esc(tmp.value) + '" alt=""/>';
      } else if (tmp.kind === 'emoji' && tmp.value) {
        p.innerHTML = '<span style="font-size:54px;line-height:1;">' + esc(tmp.value) + '</span>';
      } else {
        p.innerHTML = '<span style="color:#4a7c74;">' + esc((nm[0] || '?').toUpperCase()) + '</span>';
      }
    }

    function renderTabBody() {
      const b = modal.querySelector('#v23-tab-body');
      if (!b) return;
      if (active === 'image') {
        b.innerHTML =
          '<input type="file" accept="image/*" id="v23-file" style="margin-bottom:8px;"/>' +
          '<div style="font-size:11px;color:#6b7280;">' + esc(T('avatarImageHint')) + '</div>' +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">' +
          '<label style="font-size:12px;color:#6b7280;">' + esc(T('avatarBgColor')) + '</label>' +
          '<input type="color" value="' + esc(tmp.bg || '#d4e7e4') + '" id="v23-bg" style="width:40px;height:28px;padding:0;border:1px solid #d1cec9;border-radius:6px;background:#fff;"/>' +
          '</div>';
        b.querySelector('#v23-file').onchange = async (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          try {
            const dataUrl = await compressImage(f, 256, 0.82);
            tmp.value = dataUrl; tmp.kind = 'image';
            renderPreview();
          } catch (err) { alert('Image error: ' + (err.message || err)); }
        };
        b.querySelector('#v23-bg').oninput = e => { tmp.bg = e.target.value; renderPreview(); };
      } else if (active === 'emoji') {
        b.innerHTML =
          '<div class="ypt-v23-emoji-grid" id="v23-emoji-grid"></div>' +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">' +
          '<label style="font-size:12px;color:#6b7280;">' + esc(T('avatarBgColor')) + '</label>' +
          '<input type="color" value="' + esc(tmp.bg || '#d4e7e4') + '" id="v23-bg" style="width:40px;height:28px;padding:0;border:1px solid #d1cec9;border-radius:6px;background:#fff;"/>' +
          '</div>';
        const grid = b.querySelector('#v23-emoji-grid');
        EMOJIS.forEach(em => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = em;
          if (tmp.value === em && tmp.kind === 'emoji') btn.classList.add('selected');
          btn.onclick = () => { tmp.value = em; tmp.kind = 'emoji'; renderModal(); };
          grid.appendChild(btn);
        });
        b.querySelector('#v23-bg').oninput = e => { tmp.bg = e.target.value; renderPreview(); };
      } else {
        b.innerHTML =
          '<div style="font-size:12px;color:#6b7280;margin-bottom:8px;">' + esc(T('avatarKindInit')) + '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<label style="font-size:12px;color:#6b7280;">' + esc(T('avatarBgColor')) + '</label>' +
          '<input type="color" value="' + esc(tmp.bg || '#d4e7e4') + '" id="v23-bg" style="width:60px;height:28px;padding:0;border:1px solid #d1cec9;border-radius:6px;background:#fff;"/>' +
          '</div>';
        b.querySelector('#v23-bg').oninput = e => { tmp.bg = e.target.value; tmp.kind = 'initial'; tmp.value = ''; renderPreview(); };
      }
    }

    function renderModal() {
      modal.innerHTML =
        '<h2>' + esc(T('editAvatar')) + '</h2>' +
        '<div class="ypt-v23-preview-circle" id="v23-preview"></div>' +
        '<div class="tabs">' +
        '<div class="tab ' + (active === 'image' ? 'active' : '') + '" data-tab="image">' + esc(T('avatarKindImg')) + '</div>' +
        '<div class="tab ' + (active === 'emoji' ? 'active' : '') + '" data-tab="emoji">' + esc(T('avatarKindEmoji')) + '</div>' +
        '<div class="tab ' + (active === 'initial' ? 'active' : '') + '" data-tab="initial">' + esc(T('avatarKindInit')) + '</div>' +
        '</div>' +
        '<div id="v23-tab-body" style="min-height:140px"></div>' +
        '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px;">' +
        '<button type="button" class="ypt-v23-btn" id="v23-reset">' + esc(T('reset')) + '</button>' +
        '<div style="display:flex;gap:8px;">' +
        '<button type="button" class="ypt-v23-btn" id="v23-cancel">' + esc(T('cancel')) + '</button>' +
        '<button type="button" class="ypt-v23-btn primary" id="v23-save">' + esc(T('save')) + '</button>' +
        '</div></div>';
      renderPreview();
      renderTabBody();
      modal.querySelectorAll('.tab').forEach(t => {
        t.onclick = () => { active = t.getAttribute('data-tab'); renderModal(); };
      });
      modal.querySelector('#v23-save').onclick = save;
      modal.querySelector('#v23-cancel').onclick = close;
      modal.querySelector('#v23-reset').onclick = () => {
        tmp = { kind: 'initial', value: '', bg: '#d4e7e4' };
        active = 'initial';
        renderModal();
      };
    }

    function save() {
      if (active === 'initial') { tmp.kind = 'initial'; tmp.value = ''; }
      else if (active === 'image' && !tmp.value) { tmp.kind = 'initial'; tmp.value = ''; }
      else if (active === 'emoji' && !tmp.value) { tmp.kind = 'initial'; tmp.value = ''; }
      setMyAvatar(tmp);
      close();
    }
    function close() { try { bg.remove(); } catch (e) {} }

    document.body.appendChild(bg);
    renderModal();
  }

  // ========== GROUPS UPGRADE ==========
  const GROUP_PAGE_TITLES = ['群組', 'Groups', '學習小組', 'Study Group', 'Study Groups'];
  let loggedMemberShape = false;

  function normText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }
  function isVisible(el) {
    if (!el) return false;
    try {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    } catch (e) {
      return false;
    }
  }
  function firstFinite() {
    for (let i = 0; i < arguments.length; i++) {
      const n = Number(arguments[i]);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }
  function fmtMin(v) {
    if (v == null) return T('noData');
    const n = Math.max(0, Math.round(v));
    return L() === 'en' ? n + ' min' : n + ' 分';
  }
  function fmtPct(v) {
    return v == null ? T('noData') : Math.max(0, Math.round(v)) + '%';
  }
  function memberKey(member) {
    return String((member && (member.id || member.userId || member.email || member.name)) || '');
  }
  function myId(app) {
    const s = app || readApp();
    return String((s.user && s.user.id) || (s.profile && s.profile.id) || (s.settings && s.settings.userId) || 'u1');
  }
  function myName(app) {
    const s = app || readApp();
    return (s.user && s.user.name) || (s.profile && s.profile.name) || (s.settings && s.settings.userName) || 'You';
  }
  function myAvatarInitial(app) {
    return ((myName(app)[0] || '?') + '').toUpperCase();
  }

  function readGroupExt(gid) {
    const s = readV23();
    const all = s.groupsExt || {};
    return all[gid] || { announcement: '', roles: {}, chat: [], weeklyChallenge: null };
  }
  function writeGroupExt(gid, ext) {
    const s = readV23();
    s.groupsExt = s.groupsExt || {};
    s.groupsExt[gid] = ext;
    writeV23(s);
  }
  function ensureGroupExt(group, app) {
    const store = readV23();
    store.groupsExt = store.groupsExt || {};
    let ext = store.groupsExt[group.id];
    let changed = false;
    if (!ext || typeof ext !== 'object') {
      ext = { announcement: '', roles: {}, chat: [], weeklyChallenge: null };
      store.groupsExt[group.id] = ext;
      changed = true;
    }
    if (typeof ext.announcement !== 'string') { ext.announcement = ''; changed = true; }
    if (!ext.roles || typeof ext.roles !== 'object') { ext.roles = {}; changed = true; }
    if (!Array.isArray(ext.chat)) { ext.chat = []; changed = true; }

    const leaders = [];
    if (group.leaderId) leaders.push(String(group.leaderId));
    (group.members || []).forEach(m => {
      if (m && (m.role === 'leader' || m.role === 'admin')) leaders.push(memberKey(m));
      if (m && m.isSelf && !group.leaderId) leaders.push(memberKey(m));
    });
    leaders.filter(Boolean).forEach(id => {
      if (ext.roles[id] !== 'admin') { ext.roles[id] = 'admin'; changed = true; }
    });
    if (!(group.members || []).length) {
      const id = myId(app);
      if (ext.roles[id] !== 'admin') { ext.roles[id] = 'admin'; changed = true; }
    }

    const weekStart = mondayOfWeek(new Date());
    const oldTarget = ext.weeklyChallenge && Number(ext.weeklyChallenge.target);
    if (!ext.weeklyChallenge || ext.weeklyChallenge.weekStart !== weekStart) {
      ext.weeklyChallenge = {
        target: Number.isFinite(oldTarget) && oldTarget > 0 ? oldTarget : 600,
        weekStart,
        contrib: {},
        lastObservedMinutes: {},
      };
      changed = true;
    } else {
      if (!ext.weeklyChallenge.contrib || typeof ext.weeklyChallenge.contrib !== 'object') {
        ext.weeklyChallenge.contrib = {};
        changed = true;
      }
      if (!ext.weeklyChallenge.lastObservedMinutes || typeof ext.weeklyChallenge.lastObservedMinutes !== 'object') {
        ext.weeklyChallenge.lastObservedMinutes = {};
        changed = true;
      }
      if (!Number.isFinite(Number(ext.weeklyChallenge.target)) || Number(ext.weeklyChallenge.target) <= 0) {
        ext.weeklyChallenge.target = 600;
        changed = true;
      }
    }
    if (changed) writeV23(store);
    return ext;
  }
  function isAdminOf(group, ext, app) {
    if (!group) return false;
    const id = myId(app);
    ext = ext || ensureGroupExt(group, app);
    if (ext.roles && ext.roles[id] === 'admin') return true;
    if (group.leaderId && String(group.leaderId) === id) return true;
    return (group.members || []).some(m => {
      const mid = memberKey(m);
      return mid === id && (m.role === 'leader' || m.role === 'admin' || m.isSelf === true);
    });
  }

  function getLocalStudyStats(app) {
    app = app || readApp();
    const sessions = Array.isArray(app.sessions) ? app.sessions : [];
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = mondayOfWeek(new Date());
    const activeDays = new Set();
    let todaySec = 0, weekSec = 0, longestSec = 0;
    sessions.forEach(s => {
      if (!s || !s.startedAt) return;
      const date = String(s.startedAt).slice(0, 10);
      const sec = Number(s.duration || s.durationSeconds || s.seconds || 0);
      if (!Number.isFinite(sec) || sec <= 0) return;
      if (date === today) todaySec += sec;
      if (date >= weekStart) {
        weekSec += sec;
        activeDays.add(date);
        if (sec > longestSec) longestSec = sec;
      }
    });
    return {
      todayMinutes: Math.round(todaySec / 60),
      weekMinutes: Math.round(weekSec / 60),
      longestMinutes: Math.round(longestSec / 60),
      activeDays: activeDays.size,
    };
  }
  function syncChallengeContrib(group, ext, app) {
    const ch = ext.weeklyChallenge;
    if (!ch) return ext;
    ch.contrib = ch.contrib || {};
    ch.lastObservedMinutes = ch.lastObservedMinutes || {};
    const id = myId(app);
    const localWeek = getLocalStudyStats(app).weekMinutes;
    const prev = Number.isFinite(Number(ch.lastObservedMinutes[id])) ? Number(ch.lastObservedMinutes[id]) : 0;
    let changed = false;
    if (localWeek > prev) {
      ch.contrib[id] = Math.max(0, Number(ch.contrib[id]) || 0) + (localWeek - prev);
      changed = true;
    }
    if (ch.lastObservedMinutes[id] !== localWeek) {
      ch.lastObservedMinutes[id] = localWeek;
      changed = true;
    }
    if (changed) writeGroupExt(group.id, ext);
    return ext;
  }
  function challengeTotal(challenge) {
    return Object.values((challenge && challenge.contrib) || {})
      .reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  function findActiveGroupsPanel() {
    const panels = Array.from(document.querySelectorAll('.lerna-panel-page')).filter(isVisible);
    for (const panel of panels) {
      const title = panel.querySelector('h1');
      if (!title) continue;
      if (GROUP_PAGE_TITLES.indexOf(normText(title.textContent)) !== -1) return panel;
    }
    return null;
  }
  function findHeaderCard(titleEl) {
    let cur = titleEl.parentElement;
    for (let i = 0; cur && i < 8; i++, cur = cur.parentElement) {
      if (cur.classList && cur.classList.contains('bg-white') && cur.classList.contains('rounded-xl')) return cur;
    }
    return titleEl.parentElement;
  }
  function resolveGroupDetailContext() {
    const app = readApp();
    const groups = Array.isArray(app.groups) ? app.groups : [];
    if (!groups.length) return null;
    const panel = findActiveGroupsPanel();
    if (!panel) return null;
    const names = new Map(groups.map(g => [normText(g.name), g]));
    const headings = Array.from(panel.querySelectorAll('h2')).filter(isVisible);
    for (const h of headings) {
      const group = names.get(normText(h.textContent));
      if (group) {
        const headerEl = findHeaderCard(h);
        if (headerEl) return { app, panel, group, headerEl };
      }
    }
    return null;
  }
  function teardownGroupHosts(keep) {
    document.querySelectorAll('.ypt-v23-groups-host').forEach(n => {
      if (n !== keep) n.remove();
    });
  }

  function injectGroupsUpgrade() {
    const ctx = resolveGroupDetailContext();
    if (!ctx) {
      teardownGroupHosts(null);
      return;
    }
    let host = ctx.headerEl.nextElementSibling;
    if (!host || !host.classList || !host.classList.contains('ypt-v23-groups-host')) {
      host = ctx.panel.querySelector('.ypt-v23-groups-host') || document.createElement('div');
      host.className = 'ypt-v23-groups-host';
      ctx.headerEl.insertAdjacentElement('afterend', host);
    } else if (host.previousElementSibling !== ctx.headerEl) {
      ctx.headerEl.insertAdjacentElement('afterend', host);
    }
    teardownGroupHosts(host);
    const lang = L();
    const needsBuild = host.dataset.gid !== String(ctx.group.id) || host.dataset.lang !== lang || !host.__v23Refs;
    if (needsBuild) buildGroupUpgradePanel(host, ctx.group, lang);
    updateGroupUpgradePanel(host, ctx.group, ctx.app, { forceChatScroll: needsBuild });
  }

  function buildGroupUpgradePanel(hostEl, group, lang) {
    hostEl.dataset.gid = String(group.id);
    hostEl.dataset.lang = lang;
    hostEl.__v23RankDim = 'focus';
    hostEl.__v23ChatSig = '';
    hostEl.__v23RankSig = '';
    hostEl.innerHTML =
      '<div class="ypt-v23-groups-shell">' +
        '<div class="ypt-v23-admin-bar" data-ref="adminBar">' +
          '<span data-ref="adminText"></span>' +
          '<div class="ypt-v23-admin-actions">' +
            '<button type="button" class="ypt-v23-btn" data-act="manage-members" style="font-size:11px;padding:5px 9px;">' + esc(T('manageMembers')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ypt-v23-card">' +
          '<h3><span>📣 ' + esc(T('announcement')) + '</span><button type="button" class="ypt-v23-btn" data-act="edit-ann" style="font-size:11px;padding:4px 9px;">' + esc(T('editAnnouncement')) + '</button></h3>' +
          '<div class="ypt-v23-ann-text" data-ref="annText"></div>' +
          '<div class="ypt-v23-muted" style="margin-top:8px;">' + esc(T('announcementHint')) + '</div>' +
        '</div>' +
        '<div class="ypt-v23-card">' +
          '<h3><span>🎯 ' + esc(T('weekChallenge')) + '</span><button type="button" class="ypt-v23-btn" data-act="set-challenge" style="font-size:11px;padding:4px 9px;">' + esc(T('setChallenge')) + '</button></h3>' +
          '<div class="ypt-v23-muted" style="margin-bottom:7px;">' + esc(T('weekChallengeHint')) + '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">' +
            '<span data-ref="challengeCount"></span>' +
            '<span data-ref="challengePct" style="color:var(--accent,#4a7c74);font-weight:700;"></span>' +
          '</div>' +
          '<div class="ypt-v23-bar"><div data-ref="challengeBar"></div></div>' +
        '</div>' +
        '<div class="ypt-v23-card">' +
          '<h3><span>💬 ' + esc(T('chat')) + '</span></h3>' +
          '<div class="ypt-v23-chat-feed" data-ref="chatFeed"></div>' +
          '<div class="ypt-v23-chat-input">' +
            '<textarea id="v23-chat-text" data-ref="chatText" maxlength="500" rows="2" placeholder="' + esc(T('chatPlaceholder')) + '"></textarea>' +
            '<button type="button" class="ypt-v23-btn primary" data-act="send-chat" style="font-size:12px;padding:8px 11px;">↑</button>' +
          '</div>' +
        '</div>' +
        '<div class="ypt-v23-card">' +
          '<h3><span>🏆 ' + esc(T('contribution')) + '</span></h3>' +
          '<div class="ypt-v23-personal-card" data-ref="personalCard"></div>' +
          '<div class="ypt-v23-rank-tabs" data-ref="rankTabs">' +
            '<button type="button" data-d="focus" class="active">' + esc(T('rankFocus')) + '</button>' +
            '<button type="button" data-d="week">' + esc(T('rankWeek')) + '</button>' +
            '<button type="button" data-d="longest">' + esc(T('rankLongest')) + '</button>' +
            '<button type="button" data-d="consistency">' + esc(T('rankConsistency')) + '</button>' +
          '</div>' +
          '<div data-ref="rankList" style="font-size:13px;"></div>' +
        '</div>' +
      '</div>';
    const q = sel => hostEl.querySelector(sel);
    hostEl.__v23Refs = {
      adminBar: q('[data-ref="adminBar"]'),
      adminText: q('[data-ref="adminText"]'),
      annText: q('[data-ref="annText"]'),
      editAnn: q('[data-act="edit-ann"]'),
      setChallenge: q('[data-act="set-challenge"]'),
      manageMembers: q('[data-act="manage-members"]'),
      challengeCount: q('[data-ref="challengeCount"]'),
      challengePct: q('[data-ref="challengePct"]'),
      challengeBar: q('[data-ref="challengeBar"]'),
      chatFeed: q('[data-ref="chatFeed"]'),
      chatText: q('[data-ref="chatText"]'),
      sendChat: q('[data-act="send-chat"]'),
      personalCard: q('[data-ref="personalCard"]'),
      rankTabs: q('[data-ref="rankTabs"]'),
      rankList: q('[data-ref="rankList"]'),
    };
    hostEl.__v23Refs.editAnn.onclick = () => editAnnouncement(hostEl, group);
    hostEl.__v23Refs.setChallenge.onclick = () => editChallenge(hostEl, group);
    hostEl.__v23Refs.manageMembers.onclick = () => openMemberAdmin(group);
    hostEl.__v23Refs.sendChat.onclick = () => sendChat(hostEl, group);
    hostEl.__v23Refs.chatText.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat(hostEl, group);
      }
    };
  }
})();
    