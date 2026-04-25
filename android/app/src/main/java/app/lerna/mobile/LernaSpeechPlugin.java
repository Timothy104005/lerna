package app.lerna.mobile;

import android.speech.tts.TextToSpeech;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayDeque;
import java.util.Locale;
import java.util.Queue;

@CapacitorPlugin(name = "LernaSpeech")
public class LernaSpeechPlugin extends Plugin {
    private TextToSpeech textToSpeech;
    private boolean ready = false;
    private boolean failed = false;
    private final Queue<PluginCall> pendingCalls = new ArrayDeque<>();

    @Override
    public void load() {
        textToSpeech =
            new TextToSpeech(
                getContext(),
                status -> {
                    ready = status == TextToSpeech.SUCCESS;
                    failed = !ready;
                    flushPendingCalls();
                }
            );
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = normalizeText(call.getString("text", ""));
        if (text.isEmpty()) {
            call.reject("empty_text");
            return;
        }

        if (failed) {
            call.reject("tts_unavailable");
            return;
        }

        if (!ready || textToSpeech == null) {
            pendingCalls.add(call);
            return;
        }

        speakNow(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        call.resolve();
    }

    private void flushPendingCalls() {
        while (!pendingCalls.isEmpty()) {
            PluginCall call = pendingCalls.poll();
            if (failed || textToSpeech == null) {
                call.reject("tts_unavailable");
            } else {
                speakNow(call);
            }
        }
    }

    private void speakNow(PluginCall call) {
        String text = normalizeText(call.getString("text", ""));
        String lang = call.getString("lang", "en-US");
        float rate = call.getFloat("rate", 0.95f);
        if (rate < 0.5f) rate = 0.5f;
        if (rate > 1.6f) rate = 1.6f;

        Locale locale = localeFromTag(lang);
        int langResult = textToSpeech.setLanguage(locale);
        if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
            call.reject(
                "lang_unavailable:" + locale.toLanguageTag() + "(result=" + langResult + ")",
                "lang_unavailable"
            );
            return;
        }
        textToSpeech.setSpeechRate(rate);
        textToSpeech.stop();

        int result = textToSpeech.speak(
            text,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "lerna_" + System.currentTimeMillis()
        );

        if (result == TextToSpeech.SUCCESS) {
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("lang", locale.toLanguageTag());
            response.put("langResult", langResult);
            call.resolve(response);
        } else {
            call.reject("speak_failed");
        }
    }

    private String normalizeText(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim();
    }

    private Locale localeFromTag(String lang) {
        String value = lang == null ? "" : lang.replace('_', '-').trim();
        if (value.equalsIgnoreCase("zh") || value.toLowerCase(Locale.ROOT).startsWith("zh-")) {
            return Locale.TAIWAN;
        }
        if (value.equalsIgnoreCase("jp") || value.equalsIgnoreCase("ja") || value.toLowerCase(Locale.ROOT).startsWith("ja-")) {
            return Locale.JAPAN;
        }
        if (value.toLowerCase(Locale.ROOT).startsWith("en")) {
            return Locale.US;
        }
        Locale parsed = Locale.forLanguageTag(value);
        return parsed == null || parsed.getLanguage().isEmpty() ? Locale.US : parsed;
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.handleOnDestroy();
    }
}
