# Shadow Lens OCR AAR — consumer ProGuard rules.
# Keep the JNI-called bridge entrypoints so R8 in the host app can't strip them.
-keep class com.shadowlens.ocr.** { *; }
