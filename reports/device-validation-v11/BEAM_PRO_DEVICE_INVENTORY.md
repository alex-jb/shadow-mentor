# Beam Pro device inventory

**Status: NO DEVICE ATTACHED to this build machine.** `adb devices -l` (Unity SDK platform-tools)
returned an EMPTY device list. The Beam Pro is physically with Alex but is not USB-attached to this
automated environment, so install / logcat / on-device tests cannot run here.

To inventory + validate, run on the machine the Beam Pro is attached to (Alex):
```
ADB=/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
$ADB devices -l
$ADB shell getprop ro.product.model
$ADB shell getprop ro.build.version.release
$ADB shell getprop ro.build.version.security_patch
$ADB shell pm list packages | grep -i xreal
```
Record model / Android version / build / patch / storage / glasses model + firmware / whether XREAL
Eye is attached / USB-debugging status into `beam-pro-device-report.json`. **Redact serial numbers +
personal accounts.** (Template rows are NOT_TESTED until physically run.)
