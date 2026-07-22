#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
"$ADB" shell pm clear com.shadowlens.guidedstory
