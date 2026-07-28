# Obsolete / already-superseded findings

Nothing in the report was fully OBSOLETE_BY_ARCHITECTURE — the current tree, though newer, still contains the
files the report audited, so its concrete findings largely reproduced. The nuances:
- **npm publish state** — the report's "2.1.0 published / 2.2.0 pending" is superseded: the package now
  declares **2.3.0** (post-security-work). The *drift* it flagged (P0-1) was real and is now fixed.
- **XREAL_OST_BRIGHT** — the report predates the V11 profile work; the "dark-only theme" implication is
  partially superseded (profile exists) but the guided-story surface still doesn't consume it (open).
No finding was classified REPORT_INCORRECT — the report was accurate where checked.
