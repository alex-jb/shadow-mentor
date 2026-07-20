package com.shadowlens.ocr

import android.graphics.Bitmap
import android.graphics.Point
import android.graphics.Rect
import android.media.Image
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject

/**
 * Shadow Lens OCR bridge — ML Kit Text Recognition v2. Emits a STRICT JSON source_map
 * (source_id → normalized bbox + corner points + confidence + language) matching the
 * Shadow Lens contract. This is the ONLY place document geometry is authored; the
 * analysis model may only CITE these source_id values, never invent coordinates.
 *
 * The Eye frame is YUV_420_888 — ML Kit's InputImage.fromMediaImage accepts it directly.
 * Coordinates are normalized against the (rectified) input image, so they land on the
 * clean document the reviewer sees. SOFTWARE IMPLEMENTED · NOT-COMPILED on this host.
 */
object OcrBridge {

    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    /** OCR a Bitmap (e.g. a rectified capture). rotationDegrees ∈ {0,90,180,270}. */
    fun recognizeFromBitmap(bitmap: Bitmap, rotationDegrees: Int, callback: (String) -> Unit) {
        process(InputImage.fromBitmap(bitmap, rotationDegrees), bitmap.width, bitmap.height, callback)
    }

    /** OCR a Camera2 / XREAL-Eye media.Image (YUV_420_888). */
    fun recognizeFromMediaImage(image: Image, rotationDegrees: Int, callback: (String) -> Unit) {
        process(InputImage.fromMediaImage(image, rotationDegrees), image.width, image.height, callback)
    }

    fun getCapabilities(): String =
        JSONObject().put("engine", "mlkit-text-recognition").put("version", "bundled")
            .put("scripts", JSONArray().put("latin")).put("on_device", true).toString()

    private fun process(input: InputImage, w: Int, h: Int, callback: (String) -> Unit) {
        val t0 = System.currentTimeMillis()
        recognizer.process(input)
            .addOnSuccessListener { text -> callback(toSourceMapJson(text, w, h, System.currentTimeMillis() - t0)) }
            .addOnFailureListener { e -> callback(JSONObject().put("error", e.message ?: "ocr failed").toString()) }
    }

    // Public + pure so a JVM unit test can exercise the JSON shape without a device.
    fun toSourceMapJson(text: Text, w: Int, h: Int, ms: Long): String {
        val entries = JSONArray()
        text.textBlocks.forEachIndexed { bi, block ->
            block.lines.forEachIndexed { li, line ->
                entries.put(entry("B${bi}L${li}", "line", line.text, line.boundingBox, line.cornerPoints, line.confidence, line.recognizedLanguage, line.angle, w, h))
            }
        }
        return JSONObject()
            .put("ocr_engine", "mlkit-text-recognition")
            .put("ocr_version", "bundled")
            .put("image_width", w).put("image_height", h)
            .put("processing_ms", ms)
            .put("source_map", entries)
            .toString()
    }

    private fun entry(id: String, level: String, text: String, box: Rect?, corners: Array<Point>?, conf: Float, lang: String?, angle: Float, w: Int, h: Int): JSONObject {
        val o = JSONObject().put("source_id", id).put("level", level).put("text", text)
            .put("confidence", if (conf.isNaN()) 0.0 else conf.toDouble()).put("angle_deg", angle.toDouble())
        if (!lang.isNullOrEmpty()) o.put("language", lang)
        if (box != null && w > 0 && h > 0) {
            o.put("bounding_box_normalized", JSONObject()
                .put("x", box.left.toDouble() / w).put("y", box.top.toDouble() / h)
                .put("w", box.width().toDouble() / w).put("h", box.height().toDouble() / h))
        }
        if (corners != null && w > 0 && h > 0) {
            val cp = JSONArray()
            corners.forEach { p -> cp.put(JSONArray().put(p.x.toDouble() / w).put(p.y.toDouble() / h)) }
            o.put("corner_points_normalized", cp)
        }
        return o
    }
}
