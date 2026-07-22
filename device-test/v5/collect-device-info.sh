#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
echo "== device =="; "$ADB" shell getprop ro.product.model; "$ADB" shell getprop ro.build.version.release
echo "== abi =="; "$ADB" shell getprop ro.product.cpu.abi
echo "== xreal / myglasses packages =="; "$ADB" shell pm list packages | grep -iE "xreal|nreal|myglass" || echo "(none)"
