# Wed 2026-07-16 morning · Claude prep prompt

**How to use**: XREAL box arrives Wed morning. Before Lora meeting,
open a new terminal in `~/Desktop/AI-Projects/shadow-mentor` and run
`claude`. Paste the block below verbatim as your first message. Claude
will run everything it can, ask before doing anything destructive, and
hand you back a green/red readiness verdict.

---

## Prompt (copy from `--- BEGIN ---` to `--- END ---`)

```
--- BEGIN ---

I have Lora coming over in a few hours for a Shadow evidence-layer
demo. The XREAL One Pro AR glasses just arrived. I need you to
completely prep the demo end-to-end. No confirmation prompts for
non-destructive steps — just run and report.

Repo: /Users/alexji/Desktop/AI-Projects/shadow-mentor
Full playbook (read this first): docs/wed-demo-checklist-2026-07-16.md
Prep script (run this second): scripts/xreal-smoke-test.sh
XREAL research summary (background context, do NOT re-research): see
the commit message on 91228a4 or scripts/xreal-smoke-test.sh Step 5.

Your job, in order, non-blocking on each step (report status after
each, then continue):

STEP 1 — Verify Shadow is still green.

  cd ~/Desktop/AI-Projects/shadow-mentor
  node --test 'test/**/*.test.js' 2>&1 | tail -3

  Expected: >= 1470 pass, 0 fail, few skipped. If any test fails,
  STOP and tell me before doing anything else.

STEP 2 — Verify the archived dogfood bundle still verifies.

  node bin/shadow-verify.mjs \
    docs/dogfood-evidence/m2.1-first-success-13df92c7-2026-07-13.json \
    --public-key docs/dogfood-evidence/public-key-2026-07-13.pem

  Expected: "✓ Bundle verified" + trust=SELF_SIGNED. If not, STOP.

STEP 3 — Produce a FRESH dogfood bundle from a live session RIGHT NOW.

  Fire a `claude` subprocess is not possible from here. Instead:
  (a) Confirm the ~/.claude/settings.json hooks still point at the
      absolute path (should be 9 shadow-record.mjs entries):

      grep -c "shadow-record.mjs" ~/.claude/settings.json

      Expected: 9.

  (b) List existing sessions so I can pick a recent one:

      ls -latr ~/.shadow/sessions/ | tail -8

      Report the newest session_id + its .jsonl size + whether a
      bundle.json already exists for it.

  (c) If the newest session has no bundle.json yet, run:

      node packages/adapter-claude-code/bin/shadow-record.mjs seal \
        <newest-session-id>

      This is our M2.1-adapter's manual-seal fallback command.
      Expected: "sealed session <id>" + bundle path + event count.

  (d) Then verify the fresh bundle:

      node bin/shadow-verify.mjs \
        ~/.shadow/sessions/<newest-session-id>/bundle.json \
        --public-key ~/.shadow/keys/public.pem

      Expected: "✓ Bundle verified" AND agent version showing something
      like "claude-code@2.1.116" AND model_id showing "claude-opus-4-7"
      or similar (NOT @unknown, thanks to M2.2 Phase 2 which pins
      transcript-discovered model into the header).

      If model_id is still "unknown", tell me clearly — that's a real
      regression I'll want to know about before demo.

STEP 4 — Start the local demo server for M5 replay.

  Kill any existing 8765 server, then:

  (cd demos/replay && python3 -m http.server 8765 > /tmp/xreal-demo.log 2>&1 &)
  sleep 1
  curl -sI http://localhost:8765/index.html | head -1

  Expected: HTTP/1.0 200 OK.

STEP 5 — XREAL open with force-scale + xreal mode (glasses-ready URL).

  Open this URL in Chrome with persistent 125% scale for glasses
  legibility:

  open -na "Google Chrome" --args --force-device-scale-factor=1.25 \
    "http://localhost:8765/index.html?xreal=1"

  Report: what tab was opened.

STEP 6 — Print the 6-beat demo cue card verbatim.

  Extract the "Beat sheet" section from
  docs/wed-demo-checklist-2026-07-16.md and print it exactly as-is so
  I can glance at it during the demo. Do NOT summarize or rewrite it.

STEP 7 — XREAL One Pro connection manual reminder.

  Print the connection checklist from scripts/xreal-smoke-test.sh
  Step 5 (starts with "Plug XREAL One Pro USB-C cable"). Do NOT
  re-invent — just cat it out.

STEP 8 — Final go/no-go verdict.

  In one paragraph, tell me: are we GO or NO-GO for Lora demo?
  Include:
  - Test suite green? (Y/N)
  - Fresh bundle verifies? (Y/N)
  - Bundle header has real model_id? (Y/N)
  - Server serving on 8765? (Y/N)
  - Any errors or drift I need to know about?
  - Recommended next action (either "put on glasses and rehearse" or
    "here's the one thing to fix first").

Once done, STOP and wait for me. Don't attempt to run the demo itself
— I'll do that.

Discipline reminders:
- Do NOT git push, git commit, or edit any file unless STEP 3(c) needs
  the manual-seal command.
- Do NOT open Anthropic Console, buy things, send emails, or touch
  Vercel — those are on my hand-queue.
- Do NOT try to install anything for XREAL; per my research the Mac
  needs zero XREAL software.
- If anything is ambiguous, ASK before acting.

Go.

--- END ---
```

## What this prompt actually does for you

- Fresh Claude session picks up all the context from CLAUDE.md +
  `docs/wed-demo-checklist-2026-07-16.md` + this repo's memory
- Runs the full pre-flight (tests + verify + fresh seal) without
  waiting for you to type each step
- Force-opens Chrome with the exact glasses-legible URL
- Prints the 6-beat cue card so you can glance at it mid-demo
- Prints the XREAL connection checklist
- Gives you a single go/no-go verdict at the end

Total wall-clock: ~90 seconds from paste to verdict, most of which is
the test suite running.

## When to NOT use this prompt

- **If XREAL box is late.** Skip Step 5 (open with xreal=1) and demo
  on laptop screen only.
- **If tests fail in Step 1.** Fix locally first. Do not proceed.
- **If Anthropic + OpenAI are both empty.** The prompt will still
  work — the fresh dogfood in Step 3 doesn't need external LLM. But
  daily-brief will be silent.

## Fallbacks if you can't paste the prompt

Manual path if Claude Code CLI is not available:
```bash
cd ~/Desktop/AI-Projects/shadow-mentor
bash scripts/xreal-smoke-test.sh
```
The script does 80% of the same thing, minus the fresh-seal step
(Step 3 in the prompt above).
