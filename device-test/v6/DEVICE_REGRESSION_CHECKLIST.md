# Device regression checklist (v6) — operator-run, no destructive automation

first install · upgrade install · clean reinstall · app-data reset · offline launch · pause/resume ·
background/foreground · glasses connect after launch · glasses disconnect · Eye attach/detach · controller
disconnect · rotation change · permission denial · permission grant after denial · tracking loss · tracking
recovery · low battery · camera start/stop repeatedly · OCR repeatedly · story Reset repeatedly · app exit ·
app relaunch.

Each: expected vs actual + log path. File failures into reports/xreal-v6/DEVICE_BUGS.csv. Fix P0 (crash /
cannot launch/select/Reset / corrupted evidence / wrong semantic state / false capability claim / camera
privacy) before any new capability work.
