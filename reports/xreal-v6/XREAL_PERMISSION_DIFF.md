# XREAL permission diff — PENDING IMPORT
Base candidate (now): no INTERNET/camera/mic/storage/location (only Unity self-permission).
XREAL candidate (fill on build): expect camera/recording perms ONLY if RGB capture is enabled
(official XREAL docs: RECORD_AUDIO + FOREGROUND_SERVICE_MEDIA_PROJECTION for recording). Raw CAMERA
access is officially undocumented for XREAL → fail closed until proven on device. Justify each added
permission with the exact SDK feature that needs it.
