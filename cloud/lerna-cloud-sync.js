import { createClient } from "@supabase/supabase-js";

(() => {
  if (window.__lernaCloudSyncLoaded) return;
  window.__lernaCloudSyncLoaded = true;

  const DATA_KEYS = {
    appState: "ypt_app_state_v6",
    aiState: "lerna_ai_v1",
    v23State: "ypt_v23_upgrade_v1"
  };
  const CONFIG_KEY = "lerna_cloud_config_v1";
  const META_KEY = "lerna_cloud_meta_v1";
  const DEVICE_KEY = "lerna_cloud_device_id_v1";
  const AUTH_KEY = "lerna_cloud_auth_v1";
  const ACTIVE_USER_KEY = "lerna_cloud_active_user_v1";
  const USER_PAYLOAD_PREFIX = "lerna_cloud_user_payload_v1:";
  const REMOTE_BACKUP_KEY = "lerna_cloud_remote_backup_v1";
  const CLOUD_LOGIN_NOT_CONFIGURED = "Cloud login is not configured. Please contact the developer.";
  const FALLBACK_ACCENT = "#4a7c74";

  let supabase = null;
  let session = null;
  let busy = false;
  let message = "";
  let messageKind = "info";
  let conflict = null;
  let open = false;

  const text = {
    zh: {
      cloud: "雲端",
      title: "Lerna 雲端同步",
      close: "關閉",
      configTitle: "Supabase 專案",
      url: "Project URL",
      anon: "Anon key",
      saveConfig: "儲存設定",
      changeConfig: "變更專案設定",
      authTitle: "登入雲端帳號",
      email: "Email",
      password: "Password",
      signIn: "登入",
      signUp: "註冊",
      googleSignIn: "使用 Google 登入",
      googleConfigMissing: "請先設定 Supabase 專案，才能使用 Google 登入。",
      signOut: "登出",
      sync: "智慧同步",
      upload: "上傳此裝置",
      download: "下載雲端",
      local: "本機資料",
      remote: "雲端資料",
      noRemote: "雲端尚無資料",
      dirty: "本機有未同步變更",
      clean: "本機已同步",
      conflict: "本機與雲端都有新變更，請選擇保留哪一份。",
      keepLocal: "保留本機並上傳",
      keepRemote: "保留雲端並下載",
      reload: "已套用雲端資料，重新載入中。",
      configSaved: "雲端設定已儲存。",
      authRequired: "請先登入。",
      uploadOk: "已上傳到雲端。",
      downloadOk: "已下載雲端資料。",
      syncOk: "同步完成。",
      signingUp: "註冊完成後，如果 Supabase 要求 email 驗證，請先到信箱確認。",
      unsafeDownload: "下載會覆蓋目前本機資料，已先建立本機備份。",
      setupHint: "需要先建立 Supabase 專案並執行 schema.sql。",
      lastCloud: "雲端更新",
      device: "裝置",
      unknown: "未知",
      failed: "失敗"
    },
    en: {
      cloud: "Cloud",
      title: "Lerna Cloud Sync",
      close: "Close",
      configTitle: "Supabase project",
      url: "Project URL",
      anon: "Anon key",
      saveConfig: "Save config",
      changeConfig: "Change project config",
      authTitle: "Sign in",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      signUp: "Create account",
      googleSignIn: "Continue with Google",
      googleConfigMissing: "Set up the Supabase project before using Google sign-in.",
      signOut: "Sign out",
      sync: "Smart sync",
      upload: "Upload this device",
      download: "Download cloud",
      local: "Local data",
      remote: "Cloud data",
      noRemote: "No cloud data yet",
      dirty: "Local changes not synced",
      clean: "Local is synced",
      conflict: "Both local and cloud changed. Choose which copy to keep.",
      keepLocal: "Keep local and upload",
      keepRemote: "Keep cloud and download",
      reload: "Cloud data applied. Reloading.",
      configSaved: "Cloud config saved.",
      authRequired: "Sign in first.",
      uploadOk: "Uploaded to cloud.",
      downloadOk: "Downloaded cloud data.",
      syncOk: "Sync complete.",
      signingUp: "Account created. If Supabase requires email confirmation, check your inbox.",
      unsafeDownload: "Download overwrites local data. A local backup was created first.",
      setupHint: "Create a Supabase project and run schema.sql first.",
      lastCloud: "Cloud updated",
      device: "Device",
      unknown: "unknown",
      failed: "Failed"
    }
  };

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function lang() {
    try {
      const app = JSON.parse(localStorage.getItem(DATA_KEYS.appState) || "{}");
      const state = app.state || app;
      return /^en/i.test(state?.settings?.lang || "") ? "en" : "zh";
    } catch {
      return "zh";
    }
  }

  function t(key) {
    return (text[lang()] || text.zh)[key] || key;
  }

  function validUrl(url) {
    return /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(String(url || "").trim());
  }

  function readJson(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { __raw: raw };
    }
  }

  function writeJson(key, value) {
    if (value == null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  async function hashPayload(payload) {
    const body = stableStringify(payload);
    if (window.crypto?.subtle) {
      const bytes = new TextEncoder().encode(body);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    let hash = 0;
    for (let index = 0; index < body.length; index += 1) {
      hash = ((hash << 5) - hash + body.charCodeAt(index)) | 0;
    }
    return `fallback-${hash >>> 0}`;
  }

  function currentPayload() {
    return {
      schemaVersion: 1,
      appState: readJson(DATA_KEYS.appState),
      aiState: readJson(DATA_KEYS.aiState),
      v23State: readJson(DATA_KEYS.v23State)
    };
  }

  function rowToPayload(row) {
    return {
      schemaVersion: row?.schema_version || 1,
      appState: row?.app_state ?? null,
      aiState: row?.ai_state ?? null,
      v23State: row?.v23_state ?? null
    };
  }

  function payloadHasData(payload) {
    return !!(payload?.appState || payload?.aiState || payload?.v23State);
  }

  function payloadUserEmail(payload) {
    const app = payload?.appState;
    const state = app?.state || app || {};
    return String(state?.user?.email || "").trim().toLowerCase();
  }

  function payloadBelongsToDifferentEmail(payload, user) {
    const payloadEmail = payloadUserEmail(payload);
    const authEmail = String(user?.email || "").trim().toLowerCase();
    if (!payloadEmail || payloadEmail === "hello@lerna.app" || !authEmail) return false;
    return payloadEmail !== authEmail;
  }

  function appProfileFromAuthUser(user) {
    const email = String(user?.email || "").trim();
    if (!email) return null;
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      name: metadata.name || metadata.full_name || email.split("@")[0] || "Lerna user",
      email
    };
  }

  function syncInAppProfileForUser(user, { createIfMissing = false } = {}) {
    const profile = appProfileFromAuthUser(user);
    if (!profile) return false;

    const app = readJson(DATA_KEYS.appState);
    if (!app) {
      if (!createIfMissing) return false;
      writeJson(DATA_KEYS.appState, {
        user: profile,
        meta: { userId: profile.id },
        page: "focus"
      });
      return true;
    }

    const state = app.state || app;
    if (!state || typeof state !== "object") return false;
    const localUser = state.user || {};
    const localEmail = String(localUser.email || "").trim().toLowerCase();
    const profileEmail = profile.email.toLowerCase();
    const isDefault = !localEmail || localEmail === "hello@lerna.app";
    const sameUser = localEmail === profileEmail;
    const sameAuthUser = localUser.id === profile.id;
    if (!isDefault && !sameUser) return false;

    const nextUser = {
      id: profile.id,
      name: sameAuthUser && localUser.name ? localUser.name : profile.name,
      email: profile.email
    };
    const changed =
      !state.user ||
      localUser.id !== nextUser.id ||
      localUser.name !== nextUser.name ||
      localUser.email !== nextUser.email ||
      state.meta?.userId !== profile.id ||
      state.page === "auth";
    if (!changed) return false;

    state.user = nextUser;
    state.meta = {
      ...(state.meta || {}),
      userId: profile.id
    };
    if (state.page === "auth") state.page = "focus";
    if (app.state) app.state = state;
    writeJson(DATA_KEYS.appState, app);
    return true;
  }

  function userPayloadKey(userId) {
    return `${USER_PAYLOAD_PREFIX}${userId}`;
  }

  function readStoredAuthUser() {
    const auth = readJson(AUTH_KEY);
    const user =
      auth?.user ||
      auth?.currentSession?.user ||
      auth?.session?.user ||
      auth?.data?.session?.user ||
      null;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email || user.user_metadata?.email || "",
      user_metadata: user.user_metadata || {}
    };
  }

  function readActiveUser() {
    const active = readJson(ACTIVE_USER_KEY) || {};
    if (active.userId) return active;
    const meta = readMeta();
    if (!meta.userId) return {};
    return {
      userId: meta.userId,
      email: meta.email || ""
    };
  }

  function writeActiveUser(user, reason = "unknown") {
    if (!user?.id) return;
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify({
      userId: user.id,
      email: user.email || "",
      activatedAt: new Date().toISOString(),
      reason
    }));
  }

  function readUserPayload(userId) {
    if (!userId) return null;
    const stored = readJson(userPayloadKey(userId));
    return stored?.payload || null;
  }

  function saveUserPayload(user, payload = currentPayload(), reason = "unknown") {
    const userId = user?.id || user?.userId;
    if (!userId || !payloadHasData(payload)) return false;
    localStorage.setItem(userPayloadKey(userId), JSON.stringify({
      version: 1,
      userId,
      email: user.email || "",
      savedAt: new Date().toISOString(),
      reason,
      payload
    }));
    return true;
  }

  function saveCurrentPayloadForActiveUser(reason = "unknown") {
    const active = readActiveUser();
    if (!active.userId) return false;
    return saveUserPayload(active, currentPayload(), reason);
  }

  function clearPrimaryPayload() {
    Object.values(DATA_KEYS).forEach((key) => localStorage.removeItem(key));
  }

  function clearUserScopedStorage({ includeAuth = false } = {}) {
    [
      ...Object.values(DATA_KEYS),
      REMOTE_BACKUP_KEY,
      ACTIVE_USER_KEY,
      META_KEY
    ].forEach((key) => localStorage.removeItem(key));
    if (includeAuth) localStorage.removeItem(AUTH_KEY);
  }

  function applyPayloadToPrimaryStorage(payload) {
    if (!payload) {
      clearPrimaryPayload();
      return;
    }
    writeJson(DATA_KEYS.appState, payload.appState ?? null);
    writeJson(DATA_KEYS.aiState, payload.aiState ?? null);
    writeJson(DATA_KEYS.v23State, payload.v23State ?? null);
  }

  function activateLocalUser(user, { reason = "unknown", reloadOnSwitch = false, previousActiveUser = null } = {}) {
    if (!user?.id) return { switched: false };

    const active = previousActiveUser?.userId ? previousActiveUser : readActiveUser();
    const previousUserId = active.userId || null;
    const switched = !!previousUserId && previousUserId !== user.id;

    if (switched) {
      saveUserPayload(active, currentPayload(), `${reason}:previous-user`);
      const storedPayload = readUserPayload(user.id);
      clearUserScopedStorage({ includeAuth: false });
      applyPayloadToPrimaryStorage(storedPayload);
      try {
        console.warn("[lerna-cloud] switched local account namespace", {
          previousUserId,
          nextUserId: user.id,
          restoredSavedPayload: !!storedPayload
        });
      } catch {}
      if (reloadOnSwitch) {
        setTimeout(() => location.reload(), 250);
      }
    } else if (!previousUserId) {
      const storedPayload = readUserPayload(user.id);
      if (storedPayload) {
        if (payloadHasData(currentPayload())) backupLocal();
        clearUserScopedStorage({ includeAuth: false });
        applyPayloadToPrimaryStorage(storedPayload);
      } else {
        const current = currentPayload();
        if (payloadBelongsToDifferentEmail(current, user)) {
          backupLocal();
          clearUserScopedStorage({ includeAuth: false });
        }
      }
    } else if (previousUserId === user.id && !payloadHasData(currentPayload())) {
      const storedPayload = readUserPayload(user.id);
      if (storedPayload) applyPayloadToPrimaryStorage(storedPayload);
    }

    writeActiveUser(user, reason);
    return { switched };
  }

  function clearSignedOutUserData(reason = "sign-out") {
    saveCurrentPayloadForActiveUser(reason);
    clearUserScopedStorage({ includeAuth: true });
  }

  function bootstrapAccountIsolation() {
    const user = readStoredAuthUser();
    if (user) {
      activateLocalUser(user, { reason: "bootstrap" });
      syncInAppProfileForUser(user, { createIfMissing: true });
    }
  }

  bootstrapAccountIsolation();

  function readConfig() {
    const embedded = window.LERNA_SUPABASE_CONFIG || window.__LERNA_SUPABASE_CONFIG || {};
    const saved = readJson(CONFIG_KEY) || {};
    return {
      url: saved.url || embedded.url || "",
      anonKey: saved.anonKey || embedded.anonKey || "",
      hidden: !!embedded.url && !!embedded.anonKey
    };
  }

  function writeConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      url: String(config.url || "").trim(),
      anonKey: String(config.anonKey || "").trim()
    }));
  }

  function readMeta() {
    return readJson(META_KEY) || {};
  }

  function writeMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify({
      ...readMeta(),
      ...meta
    }));
  }

  function deviceId() {
    let value = localStorage.getItem(DEVICE_KEY);
    if (value) return value;
    value = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, value);
    return value;
  }

  function getAccent() {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    } catch {}
    return FALLBACK_ACCENT;
  }

  function mix(hex, pct) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const one = (n) => Math.round(n + (255 - n) * pct).toString(16).padStart(2, "0");
    return `#${one(r)}${one(g)}${one(b)}`;
  }

  function setMessage(value, kind = "info") {
    message = value;
    messageKind = kind;
    render();
  }

  function initClient() {
    const config = readConfig();
    if (!validUrl(config.url) || !config.anonKey) {
      supabase = null;
      session = null;
      return null;
    }
    if (supabase?.__lernaUrl === config.url && supabase?.__lernaAnonKey === config.anonKey) {
      return supabase;
    }
    supabase = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "lerna_cloud_auth_v1"
      }
    });
    supabase.__lernaUrl = config.url;
    supabase.__lernaAnonKey = config.anonKey;
    supabase.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      if (event === "SIGNED_IN" && nextSession?.user) {
        activateLocalUser(nextSession.user, {
          reason: "auth-state",
          reloadOnSwitch: true
        });
      } else if (event === "SIGNED_OUT") {
        clearSignedOutUserData("auth-state-sign-out");
      }
      render();
    });
    supabase.auth.getSession().then(({ data }) => {
      session = data?.session || null;
      if (session?.user) {
        activateLocalUser(session.user, { reason: "session-restore" });
        if (syncInAppProfileForUser(session.user, { createIfMissing: true })) {
          setTimeout(() => location.reload(), 250);
        }
      }
      render();
    });
    return supabase;
  }

  async function requireSession() {
    const client = initClient();
    if (!client) throw new Error(t("setupHint"));
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data?.session || null;
    if (!session?.user) throw new Error(t("authRequired"));
    activateLocalUser(session.user, { reason: "require-session" });
    return { client, user: session.user };
  }

  async function fetchRemote() {
    const { client, user } = await requireSession();
    const { data, error } = await client
      .from("lerna_snapshots")
      .select("schema_version,app_state,ai_state,v23_state,payload_hash,device_id,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function ensureProfile(user) {
    const client = initClient();
    if (!client || !user) return;
    await client.from("lerna_profiles").upsert({
      user_id: user.id,
      email: user.email || null,
      display_name: user.user_metadata?.name || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
  }

  async function uploadLocal() {
    busy = true;
    render();
    try {
      const { client, user } = await requireSession();
      await ensureProfile(user);
      const payload = currentPayload();
      const payloadHash = await hashPayload(payload);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("lerna_snapshots")
        .upsert({
          user_id: user.id,
          schema_version: payload.schemaVersion,
          app_state: payload.appState,
          ai_state: payload.aiState,
          v23_state: payload.v23State,
          payload_hash: payloadHash,
          device_id: deviceId(),
          updated_at: now
        }, { onConflict: "user_id" })
        .select("payload_hash,device_id,updated_at")
        .single();
      if (error) throw error;
      writeMeta({
        userId: user.id,
        email: user.email || null,
        lastSyncedHash: payloadHash,
        lastRemoteUpdatedAt: data?.updated_at || now,
        lastPushedAt: now
      });
      saveUserPayload(user, payload, "manual-upload");
      conflict = null;
      setMessage(t("uploadOk"), "ok");
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  function backupLocal() {
    const backupKey = `lerna_cloud_local_backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    localStorage.setItem(backupKey, JSON.stringify({
      createdAt: new Date().toISOString(),
      payload: currentPayload()
    }));
    return backupKey;
  }

  async function applyRemote(row, { reload = true } = {}) {
    if (!row) throw new Error(t("noRemote"));
    const payload = rowToPayload(row);
    const payloadHash = row.payload_hash || await hashPayload(payload);
    backupLocal();
    writeJson(DATA_KEYS.appState, payload.appState);
    writeJson(DATA_KEYS.aiState, payload.aiState);
    writeJson(DATA_KEYS.v23State, payload.v23State);
    writeMeta({
      userId: session?.user?.id || null,
      email: session?.user?.email || null,
      lastSyncedHash: payloadHash,
      lastRemoteUpdatedAt: row.updated_at,
      lastPulledAt: new Date().toISOString()
    });
    saveUserPayload(session?.user, payload, "manual-download");
    conflict = null;
    setMessage(`${t("downloadOk")} ${t("unsafeDownload")}`, "ok");
    if (reload) {
      setMessage(t("reload"), "ok");
      setTimeout(() => location.reload(), 700);
    }
  }

  async function downloadRemote() {
    busy = true;
    render();
    try {
      const row = await fetchRemote();
      await applyRemote(row);
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function smartSync() {
    busy = true;
    render();
    try {
      const { user } = await requireSession();
      await ensureProfile(user);
      const localPayload = currentPayload();
      const localHash = await hashPayload(localPayload);
      const meta = readMeta();
      const remote = await fetchRemote();
      if (!remote) {
        busy = false;
        await uploadLocal();
        return;
      }
      const remotePayload = rowToPayload(remote);
      const remoteHash = remote.payload_hash || await hashPayload(remotePayload);
      const localDirty = localHash !== meta.lastSyncedHash;
      const remoteChanged = remote.updated_at !== meta.lastRemoteUpdatedAt && remoteHash !== meta.lastSyncedHash;

      if (localDirty && remoteChanged) {
        conflict = { remote, remoteHash, localHash };
        setMessage(t("conflict"), "warn");
        return;
      }
      if (remoteChanged && !localDirty) {
        await applyRemote(remote);
        return;
      }
      if (localDirty) {
        busy = false;
        await uploadLocal();
        return;
      }
      writeMeta({
        userId: user.id,
        email: user.email || null,
        lastSyncedHash: remoteHash,
        lastRemoteUpdatedAt: remote.updated_at
      });
      saveUserPayload(user, localPayload, "manual-sync-clean");
      conflict = null;
      setMessage(t("syncOk"), "ok");
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function signIn(email, password) {
    busy = true;
    render();
    try {
      const client = initClient();
      if (!client) throw new Error(CLOUD_LOGIN_NOT_CONFIGURED);
      const previousActiveUser = readActiveUser();
      saveCurrentPayloadForActiveUser("manual-sign-in-before-auth");
      clearUserScopedStorage({ includeAuth: true });
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      session = data?.session || null;
      const userResult = await client.auth.getUser();
      if (userResult.error) throw userResult.error;
      const authUser = userResult.data?.user || session?.user;
      if (!authUser?.id) throw new Error(t("authRequired"));
      activateLocalUser(authUser, {
        reason: "manual-sign-in",
        reloadOnSwitch: true,
        previousActiveUser
      });
      await ensureProfile(authUser);
      if (syncInAppProfileForUser(authUser, { createIfMissing: true })) {
        setTimeout(() => location.reload(), 600);
      }
      setTimeout(() => autoSyncQuiet({ pull: true }), 700);
      setMessage(t("syncOk"), "ok");
      return { user: authUser, session };
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
      throw error;
    } finally {
      busy = false;
      render();
    }
  }

  async function signUp(email, password) {
    busy = true;
    render();
    try {
      const client = initClient();
      if (!client) throw new Error(CLOUD_LOGIN_NOT_CONFIGURED);
      const previousActiveUser = readActiveUser();
      saveCurrentPayloadForActiveUser("manual-sign-up-before-auth");
      clearUserScopedStorage({ includeAuth: true });
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      session = data?.session || session;
      let authUser = null;
      if (session?.access_token) {
        const userResult = await client.auth.getUser();
        if (userResult.error) throw userResult.error;
        authUser = userResult.data?.user || null;
      }
      if (authUser?.id) {
        activateLocalUser(authUser, {
          reason: "manual-sign-up",
          reloadOnSwitch: true,
          previousActiveUser
        });
        await ensureProfile(authUser);
        syncInAppProfileForUser(authUser, { createIfMissing: true });
        setTimeout(() => autoSyncQuiet({ pull: true }), 700);
      }
      setMessage(t("signingUp"), "ok");
      return {
        user: authUser,
        session,
        pendingConfirmation: !authUser?.id
      };
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
      throw error;
    } finally {
      busy = false;
      render();
    }
  }

  function oauthRedirectTo() {
    try {
      const url = new URL(location.href);
      url.hash = "";
      return `${url.origin}${url.pathname}`;
    } catch {
      return location.href.split("#")[0];
    }
  }

  async function signInWithGoogle() {
    busy = true;
    render();
    try {
      const client = initClient();
      if (!client) {
        open = true;
        host.style.display = "";
        setMessage(t("googleConfigMissing"), "warn");
        return;
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectTo(),
          queryParams: {
            prompt: "select_account"
          }
        }
      });
      if (error) throw error;
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  async function signOut() {
    busy = true;
    render();
    try {
      const client = initClient();
      const user = session?.user || readStoredAuthUser();
      if (user?.id) {
        saveUserPayload(user, currentPayload(), "manual-sign-out");
      }
      await client?.auth.signOut();
      session = null;
      clearSignedOutUserData("manual-sign-out");
      setMessage("", "info");
      setTimeout(() => location.reload(), 250);
    } catch (error) {
      setMessage(`${t("failed")}: ${error.message || error}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  // In-app profile auto-fill from cloud auth identity.
  // Lerna's local sign-in form pre-fills with `hello@lerna.app`. Many users
  // hit "Sign In" without typing anything, so the in-app `app_state.user`
  // ends up as the default `hello@lerna.app`. Visually the avatar then
  // shows "H" for every account, which is confusing — users assume cloud
  // sync isn't isolating data.
  // This helper rewrites the in-app user from the *cloud* auth identity
  // when (and only when) the local profile is still the default. We never
  // overwrite a customised in-app email — that's a deliberate user choice.
  // Returns true iff localStorage was changed.
  function syncInAppProfileFromAuth(options = {}) {
    return syncInAppProfileForUser(session?.user || readStoredAuthUser(), options);
  }

  const host = document.createElement("div");
  host.id = "lerna-cloud-sync-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      --cloud-accent: ${FALLBACK_ACCENT};
      --cloud-soft: #f0f7f5;
      --cloud-border: #d4e7e4;
      --cloud-bg: #faf9f6;
      --cloud-surface: #fff;
      --cloud-line: #e5e2dc;
      --cloud-muted: #6b7280;
      --cloud-subtle: #9ca3af;
      --cloud-text: #1a1a1a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
    }
    * { box-sizing: border-box; }
    .fab {
      position: fixed;
      left: 18px;
      bottom: max(18px, env(safe-area-inset-bottom));
      z-index: 2147482500;
      min-width: 46px;
      height: 42px;
      border-radius: 999px;
      border: 1px solid var(--cloud-line);
      background: var(--cloud-surface);
      color: var(--cloud-accent);
      box-shadow: 0 10px 24px rgba(26,26,26,.12);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 0 13px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
    }
    .fab[data-busy="true"] { opacity: .72; cursor: wait; }
    .panel {
      position: fixed;
      left: 18px;
      bottom: 70px;
      z-index: 2147482500;
      width: min(390px, calc(100vw - 36px));
      max-height: min(620px, calc(100vh - 110px));
      overflow: auto;
      background: var(--cloud-bg);
      color: var(--cloud-text);
      border: 1px solid var(--cloud-line);
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(26,26,26,.18);
      padding: 14px;
      font-size: 13px;
      line-height: 1.45;
    }
    .panel.hidden { display: none; }
    .head { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .title { font-size: 15px; font-weight: 800; flex: 1; }
    .close { border:0; background:transparent; color:var(--cloud-muted); cursor:pointer; font-size:18px; padding:2px 7px; }
    .section { background: var(--cloud-surface); border: 1px solid var(--cloud-line); border-radius: 12px; padding: 12px; margin-top: 10px; }
    .section h3 { margin: 0 0 9px; font-size: 13px; }
    label { display:block; color: var(--cloud-muted); font-size: 11px; margin: 9px 0 4px; }
    input {
      width:100%;
      border:1px solid var(--cloud-line);
      border-radius:9px;
      background:#fff;
      color:var(--cloud-text);
      padding:8px 10px;
      font: inherit;
    }
    input:focus { outline:0; border-color:var(--cloud-accent); box-shadow:0 0 0 3px var(--cloud-soft); }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .btn {
      border:1px solid var(--cloud-line);
      border-radius:9px;
      background:#fff;
      color:var(--cloud-text);
      padding:8px 10px;
      font: inherit;
      font-weight:700;
      cursor:pointer;
    }
    .btn.primary { background: var(--cloud-accent); border-color: var(--cloud-accent); color:#fff; }
    .btn.soft { background: var(--cloud-soft); border-color: var(--cloud-border); color: var(--cloud-accent); }
    .btn.google { background:#fff; border-color:#d1cec9; color:#1a1a1a; }
    .btn.danger { color:#b91c1c; border-color:#fecaca; background:#fef2f2; }
    .btn[disabled] { opacity:.55; cursor:not-allowed; }
    .status { border-radius:10px; padding:9px 10px; border:1px solid var(--cloud-line); color:var(--cloud-muted); background:#fff; margin-top:10px; white-space:pre-wrap; }
    .status.ok { color:var(--cloud-accent); background:var(--cloud-soft); border-color:var(--cloud-border); }
    .status.warn { color:#8a5a00; background:#fff8df; border-color:#f4df9f; }
    .status.error { color:#b91c1c; background:#fef2f2; border-color:#fecaca; }
    .meta { color: var(--cloud-subtle); font-size: 11px; overflow-wrap:anywhere; }
    .pill { display:inline-flex; align-items:center; border:1px solid var(--cloud-border); color:var(--cloud-accent); background:var(--cloud-soft); border-radius:999px; padding:2px 8px; font-size:11px; font-weight:700; }
    @media (max-width: 767px) {
      .fab { bottom: calc(86px + env(safe-area-inset-bottom)); left: 14px; height: 40px; padding: 0 12px; }
      .panel { left: 12px; bottom: calc(136px + env(safe-area-inset-bottom)); width: calc(100vw - 24px); max-height: calc(100vh - 170px); }
    }
  `;
  shadow.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.type = "button";
  shadow.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "panel hidden";
  shadow.appendChild(panel);

  function syncAccent() {
    const accent = getAccent();
    host.style.setProperty("--cloud-accent", accent);
    host.style.setProperty("--cloud-soft", mix(accent, 0.92));
    host.style.setProperty("--cloud-border", mix(accent, 0.7));
  }

  function render() {
    syncAccent();
    const config = readConfig();
    const configured = validUrl(config.url) && !!config.anonKey;
    const meta = readMeta();
    fab.dataset.busy = busy ? "true" : "false";
    fab.title = t("title");
    fab.innerHTML = `<span aria-hidden="true">Cloud</span><span class="pill">${session?.user ? "on" : "off"}</span>`;
    panel.className = `panel${open ? "" : " hidden"}`;
    if (!open) return;

    const configBlock = !configured || !config.hidden ? `
      <div class="section">
        <h3>${esc(t("configTitle"))}</h3>
        <div class="meta">${esc(t("setupHint"))}</div>
        <label for="cloud-url">${esc(t("url"))}</label>
        <input id="cloud-url" value="${esc(config.url)}" placeholder="https://xxxx.supabase.co" autocomplete="off" />
        <label for="cloud-anon">${esc(t("anon"))}</label>
        <input id="cloud-anon" value="${esc(config.anonKey)}" placeholder="eyJ..." autocomplete="off" />
        <div class="row" style="margin-top:10px">
          <button class="btn soft" id="cloud-save-config">${esc(t("saveConfig"))}</button>
        </div>
      </div>
    ` : `
      <div class="section">
        <div class="row">
          <span class="pill">${esc(t("configTitle"))}</span>
          <button class="btn" id="cloud-clear-config">${esc(t("changeConfig"))}</button>
        </div>
        <div class="meta" style="margin-top:8px">${esc(config.url)}</div>
      </div>
    `;

    const authBlock = configured && !session?.user ? `
      <div class="section">
        <h3>${esc(t("authTitle"))}</h3>
        <label for="cloud-email">${esc(t("email"))}</label>
        <input id="cloud-email" type="email" autocomplete="email" />
        <label for="cloud-password">${esc(t("password"))}</label>
        <input id="cloud-password" type="password" autocomplete="current-password" />
        <div class="row" style="margin-top:10px">
          <button class="btn primary" id="cloud-sign-in" ${busy ? "disabled" : ""}>${esc(t("signIn"))}</button>
          <button class="btn" id="cloud-sign-up" ${busy ? "disabled" : ""}>${esc(t("signUp"))}</button>
        </div>
        <button class="btn google" id="cloud-google-sign-in" ${busy ? "disabled" : ""} style="width:100%;margin-top:10px">${esc(t("googleSignIn"))}</button>
      </div>
    ` : "";

    const syncBlock = configured && session?.user ? `
      <div class="section">
        <div class="row">
          <span class="pill">${esc(session.user.email || "")}</span>
          <button class="btn" id="cloud-sign-out" ${busy ? "disabled" : ""}>${esc(t("signOut"))}</button>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="cloud-sync" ${busy ? "disabled" : ""}>${esc(t("sync"))}</button>
          <button class="btn soft" id="cloud-upload" ${busy ? "disabled" : ""}>${esc(t("upload"))}</button>
          <button class="btn" id="cloud-download" ${busy ? "disabled" : ""}>${esc(t("download"))}</button>
        </div>
        ${conflict ? `
          <div class="status warn">
            ${esc(t("conflict"))}
            <div class="row" style="margin-top:10px">
              <button class="btn primary" id="cloud-keep-local">${esc(t("keepLocal"))}</button>
              <button class="btn" id="cloud-keep-remote">${esc(t("keepRemote"))}</button>
            </div>
          </div>
        ` : ""}
        <div class="meta" style="margin-top:10px">
          ${esc(t("lastCloud"))}: ${esc(meta.lastRemoteUpdatedAt || t("unknown"))}<br/>
          ${esc(t("device"))}: ${esc(deviceId())}
        </div>
      </div>
    ` : "";

    panel.innerHTML = `
      <div class="head">
        <div class="title">${esc(t("title"))}</div>
        <button class="close" id="cloud-close" aria-label="${esc(t("close"))}">×</button>
      </div>
      ${configBlock}
      ${authBlock}
      ${syncBlock}
      ${message ? `<div class="status ${esc(messageKind)}">${esc(message)}</div>` : ""}
    `;

    panel.querySelector("#cloud-close")?.addEventListener("click", () => {
      open = false;
      render();
    });
    panel.querySelector("#cloud-save-config")?.addEventListener("click", () => {
      const url = panel.querySelector("#cloud-url")?.value || "";
      const anonKey = panel.querySelector("#cloud-anon")?.value || "";
      writeConfig({ url, anonKey });
      supabase = null;
      initClient();
      setMessage(t("configSaved"), "ok");
    });
    panel.querySelector("#cloud-clear-config")?.addEventListener("click", () => {
      localStorage.removeItem(CONFIG_KEY);
      supabase = null;
      session = null;
      render();
    });
    panel.querySelector("#cloud-sign-in")?.addEventListener("click", () => {
      signIn(panel.querySelector("#cloud-email")?.value || "", panel.querySelector("#cloud-password")?.value || "");
    });
    panel.querySelector("#cloud-sign-up")?.addEventListener("click", () => {
      signUp(panel.querySelector("#cloud-email")?.value || "", panel.querySelector("#cloud-password")?.value || "");
    });
    panel.querySelector("#cloud-google-sign-in")?.addEventListener("click", signInWithGoogle);
    panel.querySelector("#cloud-sign-out")?.addEventListener("click", signOut);
    panel.querySelector("#cloud-sync")?.addEventListener("click", smartSync);
    panel.querySelector("#cloud-upload")?.addEventListener("click", uploadLocal);
    panel.querySelector("#cloud-download")?.addEventListener("click", downloadRemote);
    panel.querySelector("#cloud-keep-local")?.addEventListener("click", uploadLocal);
    panel.querySelector("#cloud-keep-remote")?.addEventListener("click", () => applyRemote(conflict?.remote));
  }

  fab.addEventListener("click", () => {
    open = !open;
    render();
  });

  // ==== Auto sync (added 2026-04-25) =================================
  // Goal: once a user has signed in successfully (meta.userId present),
  // hide the visible Cloud FAB by default and run periodic + lifecycle
  // pushes so users don't have to think about syncing.
  //
  // Override: visit the page with `#cloud=show` in the URL to force the
  // FAB back on (useful for sign out, swapping accounts, debugging).
  // Also `localStorage.setItem('lerna_cloud_auto_v1','false')` disables
  // auto-mode and re-shows the FAB on next reload.
  //
  // Conflict policy (auto-mode only): lifecycle pushes keep the local
  // copy, but boot/pull sync prefers a newer remote snapshot. Applying a
  // remote snapshot still creates a timestamped local backup first.
  const AUTO_KEY = "lerna_cloud_auto_v1";
  const AUTO_INTERVAL_MS = 5 * 60 * 1000; // 5 min push tick

  function isAutoMode() {
    const stored = localStorage.getItem(AUTO_KEY);
    if (stored === "false") return false;
    const authUser = readStoredAuthUser();
    if (!authUser?.id) return false;
    if (stored === "true") return true;
    const meta = readMeta();
    const active = readActiveUser();
    return meta.userId === authUser.id || active.userId === authUser.id;
  }

  function isDebugShow() {
    return /#cloud=(show|panel|debug)/i.test(location.hash);
  }

  function shouldHideUi() {
    return isAutoMode() && !isDebugShow();
  }

  function applyHostVisibility() {
    host.style.display = shouldHideUi() ? "none" : "";
  }

  async function getActiveUser() {
    const client = initClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      session = data?.session || null;
      if (session?.user) {
        activateLocalUser(session.user, { reason: "active-session" });
      }
      return session?.user || null;
    } catch {
      return null;
    }
  }

  async function uploadLocalQuiet(user, payload, payloadHash) {
    const client = initClient();
    if (!client) return;
    await ensureProfile(user);
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("lerna_snapshots")
      .upsert({
        user_id: user.id,
        schema_version: payload.schemaVersion,
        app_state: payload.appState,
        ai_state: payload.aiState,
        v23_state: payload.v23State,
        payload_hash: payloadHash,
        device_id: deviceId(),
        updated_at: now
      }, { onConflict: "user_id" })
      .select("payload_hash,device_id,updated_at")
      .single();
    if (error) throw error;
    writeMeta({
      userId: user.id,
      email: user.email || null,
      lastSyncedHash: payloadHash,
      lastRemoteUpdatedAt: data?.updated_at || now,
      lastPushedAt: now
    });
    saveUserPayload(user, payload, "auto-upload");
  }

  function timeValue(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function applyRemoteQuiet(row, { reload, user = null }) {
    const payload = rowToPayload(row);
    const payloadHash = row.payload_hash || await hashPayload(payload);
    backupLocal();
    writeJson(DATA_KEYS.appState, payload.appState);
    writeJson(DATA_KEYS.aiState, payload.aiState);
    writeJson(DATA_KEYS.v23State, payload.v23State);
    writeMeta({
      userId: user?.id || session?.user?.id || readMeta().userId || null,
      email: user?.email || session?.user?.email || readMeta().email || null,
      lastSyncedHash: payloadHash,
      lastRemoteUpdatedAt: row.updated_at,
      lastPulledAt: new Date().toISOString()
    });
    // Apply in-app profile auto-fill before reload so post-reload UI shows
    // the cloud gmail rather than a freshly-pulled `hello@lerna.app`.
    syncInAppProfileFromAuth();
    saveUserPayload(user || session?.user || readActiveUser(), payload, "auto-download");
    if (reload) {
      setTimeout(() => location.reload(), 400);
    }
  }

  let autoSyncRunning = false;
  async function autoSyncQuiet({ pull = false } = {}) {
    if (autoSyncRunning || busy) return;
    autoSyncRunning = true;
    try {
      const user = await getActiveUser();
      if (!user) return;

      // Defensive: catch user-switches that bypassed `onAuthStateChange`
      // (e.g. if a refresh-token cycle restored a different session).
      const metaCheck = readMeta();
      if (metaCheck.userId && metaCheck.userId !== user.id) {
        activateLocalUser(user, {
          reason: "auto-sync-user-switch",
          reloadOnSwitch: true
        });
        return;
      }

      // Auto-fill in-app profile so the upload payload reflects the cloud
      // identity instead of leftover `hello@lerna.app`.
      const profileChanged = syncInAppProfileFromAuth({ createIfMissing: pull });
      if (profileChanged && pull) {
        // On the boot pull tick, reload so the UI picks up the new profile
        // immediately rather than waiting for the next render cycle.
        setTimeout(() => location.reload(), 600);
        return;
      }

      const localPayload = currentPayload();
      const localHash = await hashPayload(localPayload);
      const meta = readMeta();
      const localDirty = localHash !== meta.lastSyncedHash;

      if (!pull) {
        if (localDirty) await uploadLocalQuiet(user, localPayload, localHash);
        return;
      }

      const remote = await fetchRemote();
      if (!remote) {
        if (localDirty) await uploadLocalQuiet(user, localPayload, localHash);
        return;
      }
      const remoteHash = remote.payload_hash || await hashPayload(rowToPayload(remote));
      const remoteChanged =
        remote.updated_at !== meta.lastRemoteUpdatedAt &&
        remoteHash !== meta.lastSyncedHash;

      if (localDirty && remoteChanged) {
        if (pull && timeValue(remote.updated_at) >= timeValue(meta.lastRemoteUpdatedAt)) {
          await applyRemoteQuiet(remote, { reload: true, user });
          return;
        }
        try {
          localStorage.setItem(REMOTE_BACKUP_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            remoteUpdatedAt: remote.updated_at,
            payload: rowToPayload(remote)
          }));
        } catch {}
        await uploadLocalQuiet(user, localPayload, localHash);
        return;
      }
      if (remoteChanged && !localDirty) {
        await applyRemoteQuiet(remote, { reload: true, user });
        return;
      }
      if (localDirty) {
        await uploadLocalQuiet(user, localPayload, localHash);
      } else {
        writeMeta({
          userId: user.id,
          email: user.email || null,
          lastSyncedHash: remoteHash,
          lastRemoteUpdatedAt: remote.updated_at
        });
        saveUserPayload(user, localPayload, "auto-sync-clean");
      }
    } catch (error) {
      try { console.warn("[lerna-cloud] auto sync error:", error?.message || error); } catch {}
    } finally {
      autoSyncRunning = false;
    }
  }

  let autoTriggersInstalled = false;
  function setupAutoTriggers() {
    if (autoTriggersInstalled) return;
    autoTriggersInstalled = true;
    setInterval(() => autoSyncQuiet({ pull: false }), AUTO_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        saveCurrentPayloadForActiveUser("visibility-hidden");
        autoSyncQuiet({ pull: false });
      }
    });
    window.addEventListener("pagehide", () => {
      saveCurrentPayloadForActiveUser("pagehide");
      autoSyncQuiet({ pull: false });
    });
  }
  // ====================================================================

  function ensureAuthBridgeStyles() {
    if (document.getElementById("lerna-google-auth-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "lerna-google-auth-bridge-style";
    style.textContent = `
      .lerna-google-auth-bridge {
        display: grid;
        gap: 12px;
        margin-bottom: 16px;
      }
      .lerna-google-auth-button {
        width: 100%;
        min-height: 42px;
        border: 1px solid #d1cec9;
        border-radius: 10px;
        background: #fff;
        color: #1a1a1a;
        font: inherit;
        font-size: 14px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(26, 26, 26, 0.04);
      }
      .lerna-google-auth-button:hover {
        border-color: #4a7c74;
      }
      .lerna-google-auth-g {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 1px solid #e5e2dc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #4285f4;
        background: #fff;
      }
      .lerna-google-auth-divider {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #9ca3af;
        font-size: 11px;
      }
      .lerna-google-auth-divider::before,
      .lerna-google-auth-divider::after {
        content: "";
        height: 1px;
        flex: 1;
        background: #e5e2dc;
      }
    `;
    document.head.appendChild(style);
  }

  function installAuthPageGoogleButton() {
    if (!document.body) return;
    ensureAuthBridgeStyles();
    const forms = Array.from(document.querySelectorAll("form"));
    const form = forms.find((candidate) =>
      candidate.querySelector('input[type="email"]') &&
      candidate.querySelector('input[type="password"]')
    );
    if (!form || form.querySelector("[data-lerna-google-auth-bridge]")) return;

    const langCode = lang();
    const bridge = document.createElement("div");
    bridge.className = "lerna-google-auth-bridge";
    bridge.dataset.lernaGoogleAuthBridge = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lerna-google-auth-button";
    button.innerHTML = `<span class="lerna-google-auth-g" aria-hidden="true">G</span><span>${esc(t("googleSignIn"))}</span>`;
    button.addEventListener("click", signInWithGoogle);

    const divider = document.createElement("div");
    divider.className = "lerna-google-auth-divider";
    divider.textContent = langCode === "zh" ? "或使用 email" : "or use email";

    bridge.append(button, divider);
    form.insertBefore(bridge, form.firstElementChild);
  }

  function setupAuthPageBridge() {
    installAuthPageGoogleButton();
    try {
      new MutationObserver(() => installAuthPageGoogleButton()).observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch {}
  }

  window.__LernaCloudSync = {
    open: () => {
      open = true;
      host.style.display = "";
      render();
    },
    sync: smartSync,
    upload: uploadLocal,
    download: downloadRemote,
    signInWithGoogle,
    signInWithPassword: signIn,
    signUpWithPassword: signUp,
    signOut,
    getUser: async () => {
      const client = initClient();
      if (!client) return null;
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      session = data?.user ? session : null;
      return data?.user || null;
    },
    getCachedUser: () => session?.user || readStoredAuthUser(),
    hasConfig: () => {
      const config = readConfig();
      return validUrl(config.url) && !!config.anonKey;
    },
    clearUserScopedStorage: () => clearUserScopedStorage({ includeAuth: true }),
    autoSync: () => autoSyncQuiet({ pull: true }),
    setAuto: (on) => {
      if (on === false || on === "false") {
        localStorage.setItem(AUTO_KEY, "false");
      } else {
        localStorage.setItem(AUTO_KEY, "true");
      }
      applyHostVisibility();
    },
    isAutoMode
  };

  function boot() {
    document.body.appendChild(host);
    applyHostVisibility();
    initClient();
    render();
    try {
      new MutationObserver(syncAccent).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"]
      });
    } catch {}

    setupAutoTriggers();
    setupAuthPageBridge();
    setTimeout(() => autoSyncQuiet({ pull: true }), 1500);

    window.addEventListener("hashchange", applyHostVisibility);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
