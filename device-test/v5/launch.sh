#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
"$ADB" shell monkey -p com.shadowlens.guidedstory -c android.intent.category.LAUNCHER 1
