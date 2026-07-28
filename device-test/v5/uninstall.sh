#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
"$ADB" uninstall com.shadowlens.guidedstory || true
