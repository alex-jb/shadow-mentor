package com.shadowlens.voice

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Shadow Lens voice/TTS bridge. Prefers the ON-DEVICE recognizer (privacy) and falls back
 * to the system recognizer (which may hit the network — the caller must label that). The
 * recognizer is created on the MAIN thread, given a RecognitionListener before use, and
 * destroy()ed on stop. PUSH-TO-TALK only; raw audio is never retained. SOFTWARE
 * IMPLEMENTED · NOT-COMPILED on this host (no Android SDK).
 *
 * `normalizeCommand` is pure + JVM-testable (mirrors the Unity closed-enum router) so
 * document text can never route UI actions — the LLM is never in this path.
 */
class VoiceBridge(private val context: Context) {

    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    var lastRecognitionMode: String = "unknown"; private set  // "on_device" | "network"

    fun onDeviceAvailable(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

    /** Push-to-talk: call on key/controller DOWN. onFinal(recognizedText, confidence). */
    fun startPushToTalk(onFinal: (String, Float) -> Unit, onError: (String) -> Unit) {
        // MUST be created on the main thread by the caller.
        val onDevice = onDeviceAvailable()
        lastRecognitionMode = if (onDevice) "on_device" else "network"
        recognizer = if (onDevice) SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        else SpeechRecognizer.createSpeechRecognizer(context)
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                val conf = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)?.firstOrNull() ?: 0f
                onFinal(text, conf) // NOTE: caller does NOT retain audio
            }
            override fun onError(error: Int) = onError("speech error $error")
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        recognizer?.startListening(intent)
    }

    /** Call on key/controller UP. */
    fun stop() { recognizer?.stopListening() }

    fun dispose() { recognizer?.destroy(); recognizer = null; tts?.stop(); tts?.shutdown(); tts = null }

    fun initTts(onReady: () -> Unit) {
        tts = TextToSpeech(context) { status -> if (status == TextToSpeech.SUCCESS) { tts?.language = Locale.US; onReady() } }
    }
    fun speak(text: String) { tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "shadow-lens") }

    companion object {
        // Pure closed-enum command normalization (JVM-testable). "" = grounded question → analysis path.
        @JvmStatic fun normalizeCommand(raw: String?): String {
            val t = (raw ?: "").lowercase()
            return when {
                t.contains("scan") -> "SCAN_DOCUMENT"
                t.contains("capture") -> "CAPTURE"
                t.contains("cancel") -> "CANCEL_CAPTURE"
                t.contains("analy") -> "ANALYZE"
                t.contains("risk") -> "SHOW_RISKS"
                t.contains("scenario") -> "SHOW_SCENARIOS"
                t.contains("review") || t.contains("council") -> "SHOW_REVIEW"
                t.contains("audit") -> "SHOW_AUDIT"
                t.contains("source") -> "SHOW_SOURCE"
                t.contains("verify") -> "VERIFY"
                t.contains("document") || t.contains("back") -> "RETURN_TO_DOCUMENT"
                t.contains("reset") -> "RESET"
                else -> ""
            }
        }
    }
}
