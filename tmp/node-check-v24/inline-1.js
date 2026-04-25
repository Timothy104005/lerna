
      /* Hydrate accent from persisted YPT state before React mounts to avoid flash. */
      (function () {
        try {
          const raw = localStorage.getItem('ypt_app_state_v6');
          if (!raw) return;
          const s = JSON.parse(raw);
          const state = s && (s.state || s);
          const hex = state && state.settings && state.settings.accent;
          if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return;
          const root = document.documentElement;
          root.style.setProperty('--accent', hex);
          // darker tone ~ multiply lightness by 0.82
          const r = parseInt(hex.slice(1,3), 16);
          const g = parseInt(hex.slice(3,5), 16);
          const b = parseInt(hex.slice(5,7), 16);
          root.style.setProperty('--accent-rgb', `${r} ${g} ${b}`);
          const dark = '#' + [r, g, b].map(c => Math.round(c * 0.82).toString(16).padStart(2, '0')).join('');
          root.style.setProperty('--accent-dark', dark);
          const mix = (c, f) => Math.round(c + (255 - c) * f);
          const soft = '#' + [r, g, b].map(c => mix(c, 0.92).toString(16).padStart(2, '0')).join('');
          const border = '#' + [r, g, b].map(c => mix(c, 0.70).toString(16).padStart(2, '0')).join('');
          root.style.setProperty('--accent-soft', soft);
          root.style.setProperty('--accent-border', border);
        } catch (e) {}
      })();
    