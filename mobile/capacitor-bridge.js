import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

const isNativeApp =
  typeof Capacitor?.isNativePlatform === "function"
    ? Capacitor.isNativePlatform()
    : false;
const platform =
  typeof Capacitor?.getPlatform === "function"
    ? Capacitor.getPlatform()
    : "web";
const LernaSpeech = registerPlugin("LernaSpeech");
const backHandlers = new Set();

async function shareText(payload) {
  if (!isNativeApp) return false;
  try {
    await Share.share(payload);
    return true;
  } catch {
    return false;
  }
}

async function exportBackup({ filename, contents, title }) {
  if (!isNativeApp) {
    return { ok: false, native: false };
  }

  try {
    const path = `backups/${filename}`;
    await Filesystem.writeFile({
      path,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true
    });
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({
      title: title || "Lerna backup",
      text: filename,
      url: uri.uri,
      dialogTitle: title || "Lerna backup"
    });
    return { ok: true, native: true, uri: uri.uri };
  } catch (error) {
    return {
      ok: false,
      native: true,
      error: error?.message || String(error)
    };
  }
}

async function speakText({ text, lang = "en-US", rate = 0.95 } = {}) {
  if (!isNativeApp) return { ok: false, native: false };
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return { ok: false, native: true, error: "empty_text" };

  try {
    await LernaSpeech.speak({
      text: normalized,
      lang,
      rate
    });
    return { ok: true, native: true };
  } catch (error) {
    return {
      ok: false,
      native: true,
      error: error?.message || String(error)
    };
  }
}

async function stopSpeaking() {
  if (!isNativeApp) return { ok: false, native: false };
  try {
    await LernaSpeech.stop();
    return { ok: true, native: true };
  } catch (error) {
    return {
      ok: false,
      native: true,
      error: error?.message || String(error)
    };
  }
}

function registerBackHandler(handler) {
  backHandlers.add(handler);
  return () => backHandlers.delete(handler);
}

async function markReady() {
  if (!isNativeApp) return;
  try {
    await SplashScreen.hide();
  } catch {}
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#f5f3ef" });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {}
}

if (isNativeApp && typeof App?.addListener === "function") {
  App.addListener("backButton", async ({ canGoBack }) => {
    const handlers = Array.from(backHandlers);
    for (let index = handlers.length - 1; index >= 0; index -= 1) {
      try {
        const result = await handlers[index]({ canGoBack, platform });
        if (result === "exit") {
          await App.exitApp();
          return;
        }
        if (result === "go_back") {
          window.history.back();
          return;
        }
        if (result && result !== "unhandled") {
          return;
        }
      } catch {}
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    await App.exitApp();
  });
}

window.__LernaMobileBridge = {
  isNativeApp,
  platform,
  shareText,
  exportBackup,
  speakText,
  stopSpeaking,
  registerBackHandler,
  markReady
};
