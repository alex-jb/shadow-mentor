// apps/shadow-lens/unity/Assets/ShadowLens/Providers/AndroidBridgeProviders.cs
// Android-only adapters that call the OCR + Voice/TTS AARs over JNI. Compiled ONLY on the
// Android player (not the Editor), so the project builds on desktop without the AARs present.
// The AAR Kotlin bridges are SOURCE AUTHORED · BUILD CONFIGURED · NOT COMPILED here.
#if UNITY_ANDROID && !UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.Core;

namespace ShadowLens.Providers
{
    // OCR bridge → com.shadowlens.ocr.OcrBridge (ML Kit Text Recognition v2). Returns the
    // contract source_map JSON; the model NEVER authors geometry — this bridge does.
    public class AndroidOcrProvider : IOcrProvider
    {
        public string EngineId => "mlkit-text-recognition";
        public void Recognize(CapturedFrame frame, Action<IReadOnlyList<SourceEntry>> onResult, Action<string> onError)
        {
            try
            {
                using var bridge = new AndroidJavaObject("com.shadowlens.ocr.OcrBridge");
                // string json = bridge.Call<string>("recognizeFromBytes", frame.Bytes, frame.Width, frame.Height, frame.RotationDeg);
                // → parse json into SourceEntry[] (source_id, text, x,y,w,h, confidence, language)
                // Honest state: the OCR AAR is COMPILED, but the JNI round-trip is DEVICE-VALIDATION
                // PENDING — this does not claim OCR executed until a real device produces a source_map.
                onError?.Invoke("AndroidOcrProvider: JNI wired to the compiled OCR AAR — DEVICE VALIDATION PENDING");
            }
            catch (Exception e) { onError?.Invoke(e.Message); }
        }
    }

    // Voice bridge → com.shadowlens.voice.VoiceBridge. Must be created on the UI thread; the
    // command NEVER routes through an LLM (VoiceBridge.normalizeCommand is a closed enum).
    public class AndroidVoiceProvider : IVoiceRecognitionProvider
    {
        AndroidJavaObject _bridge;
        public bool OnDeviceAvailable => _bridge?.Call<bool>("onDeviceAvailable") ?? false;
        public void StartPushToTalk(Action<string, float> onFinal)
        {
            // create on the Android UI thread (SpeechRecognizer requirement)
            // _bridge = new AndroidJavaObject("com.shadowlens.voice.VoiceBridge", context);
            // _bridge.Call("startPushToTalk", new OnFinalProxy(onFinal), new OnErrorProxy());
        }
        public void Stop() => _bridge?.Call("stop");
        public void Dispose() => _bridge?.Call("dispose");
    }

    public class AndroidTtsProvider : ITextToSpeechProvider
    {
        AndroidJavaObject _bridge;
        public void Speak(string text) => _bridge?.Call("speak", text);
        public void Stop() { }
    }
}
#endif
