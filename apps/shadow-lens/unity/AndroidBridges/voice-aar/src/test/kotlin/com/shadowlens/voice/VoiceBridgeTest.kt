package com.shadowlens.voice

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Pure JVM tests (no Android device) for the closed-enum command router. Runs on any JDK
 * via `./gradlew :voice-aar:testDebugUnitTest`. Proves document/free text can only ever map
 * to a fixed action set — an LLM is never in the routing path — and that grounded questions
 * fall through to "" (the analysis path), keeping voice control and analysis separate.
 */
class VoiceBridgeTest {
    @Test fun scan_maps_to_scan() = assertEquals("SCAN_DOCUMENT", VoiceBridge.normalizeCommand("scan this"))
    @Test fun analyze_maps() = assertEquals("ANALYZE", VoiceBridge.normalizeCommand("please analyze it"))
    @Test fun council_maps_to_review() = assertEquals("SHOW_REVIEW", VoiceBridge.normalizeCommand("show the council"))
    @Test fun verify_maps() = assertEquals("VERIFY", VoiceBridge.normalizeCommand("verify the record"))
    @Test fun grounded_question_falls_through_to_analysis() =
        assertEquals("", VoiceBridge.normalizeCommand("what is the debt to income ratio"))
    @Test fun null_is_empty() = assertEquals("", VoiceBridge.normalizeCommand(null))
    @Test fun unknown_is_empty() = assertEquals("", VoiceBridge.normalizeCommand("xyzzy"))
}
