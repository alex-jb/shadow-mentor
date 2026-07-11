# Screencast script — 2 minutes flat

**Status: DRAFT. Do not record without Alex's in-conversation sign-off (per `docs/AUTONOMOUS_SESSION_RULES.md` rule 1).**

Target runtime: 120 seconds. Reading discipline: no manifesto tone. Say what it does. Show the tamper detection. Get off screen.

**Recording tool suggestion:** Screen Studio ($89 one-time buy) or Descript. Native macOS screen recording is fine if editing overhead is a blocker. Native voice preferred over TTS — HN readers spot AI voice and mentally discount.

**Setup shot (screen composition):**
- Terminal on the left half of the screen
- Chrome with `verify.html` open on the right half
- Font: 16pt monospace. Zoom in aggressively; HN readers watch at 480p by default and details need to be legible.

---

## 0:00 – 0:15 · frame

**Screen:** blank terminal, cursor blinking.

**Voice:** *"EU AI Act Article 12 comes into force on August 2. It requires high-risk AI systems to automatically record events. The standards that say what a compliant record looks like are still in draft. Almost no logs today can prove, months later, that nobody rewrote them. This is a two-minute walkthrough of Shadow — one npm library that fixes that."*

## 0:15 – 0:40 · record a session

**Screen:** in terminal, run:

```bash
node -e '
import("./packages/attest-core/session.js").then(({createSession, appendEvent, sealSession}) => {
  const { generateKeyPairSync } = require("node:crypto");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const s = createSession({
    agent: { name: "claude-code", version: "1.2.3" },
    models: [{ model_id: "anthropic:claude-sonnet-4-6", provider: "anthropic" }],
    environmentFingerprint: { os: process.platform, node_version: process.version },
    keyId: "demo-key",
    privateKey,
  });

  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "Refactor auth.ts" } });
  appendEvent(s, { event_type: "tool_call",    actor: "agent", payload: { tool: "grep", args: { pattern: "auth" } } });
  appendEvent(s, { event_type: "tool_result",  actor: "tool",  payload: { hits: 12 } });
  appendEvent(s, { event_type: "file_write",   actor: "agent", payload: { path: "auth.ts", diff_hash: "abc123..." } });

  const bundle = sealSession(s);
  require("fs").writeFileSync("bundle.json", JSON.stringify(bundle, null, 2));
  require("fs").writeFileSync("public.pem", publicKey.export({ type: "spki", format: "pem" }));
  console.log("wrote bundle.json + public.pem");
});
'
```

**Voice:** *"Every event that enters the session gets a SHA-256 payload hash, a signed hash chain link, and an Ed25519 signature on the batch root. This is four events — user message, tool call, tool result, file write. Real usage would be hundreds or thousands. Ten thousand events seal and verify in under seventy milliseconds on my laptop."*

**Cut to:** the terminal shows `wrote bundle.json + public.pem`.

## 0:40 – 1:05 · verify it

**Screen:** switch to Chrome with `verify.html` open. Drag `bundle.json` from a Finder window onto the drop zone. Paste `public.pem` contents into the textarea.

**Voice:** *"Three ways to verify. Static HTML — no build, no network, works from a USB stick. This is what you send an auditor. Paste the public key. Green checkmark. Session ID, agent, event count, batch root, trust level. `SELF_SIGNED` because we haven't added an external anchor yet."*

**Screen:** the verify.html shows the green checkmark and metadata. Zoom in on the `trust: SELF_SIGNED (no external anchor)` line specifically.

## 1:05 – 1:35 · tamper it

**Screen:** open `bundle.json` in a text editor. Find one of the events, edit one character in the `payload_hash` field.

**Voice:** *"Now tamper. Change one character of a payload hash. Save. Re-drop the bundle."*

**Screen:** re-drop the tampered `bundle.json` into verify.html.

**Voice:** *"Red. The verifier reports the exact event where the chain broke — that's the failedSeq index. Reason: `prev_hash mismatch`. If I had reordered events, deleted an event, or forged the signature, I would get the same shape of report with a different reason."*

**Screen:** show the red result with `failedSeq: 2` visible.

**Voice:** *"An auditor months from now can do exactly this — no vendor SaaS, no proprietary tool, no dependency on my infrastructure."*

## 1:35 – 1:55 · positioning

**Screen:** cut to the README on GitHub. Zoom in on the v3 evidence-bundle section.

**Voice:** *"This is not observability. LangSmith and Langfuse tell engineers why the agent broke. This is not policy enforcement. PromptHalo and Salt stop the agent from doing bad things at request time. Shadow proves, months later, that the record of what happened has not been rewritten. All three are honest jobs. Shadow does the third one."*

## 1:55 – 2:00 · close

**Screen:** cut to a URL card: `github.com/alex-jb/shadow-mentor` + `npm install shadow-attest-core`.

**Voice:** *"MIT. `npm install shadow-attest-core`. Repo in the description. Feedback welcome."*

---

## Editing notes

- Cut all silences longer than 300 ms. Descript's "remove silences" default is usually fine.
- Trim any "um," "uh," "let me," "as I was saying." These are voice cues that trigger the AI-voice discount even from a human speaker.
- Do NOT add background music. HN readers strip audio on the first watch; music adds nothing and can trigger auto-skip.
- Do NOT add a splash card at the start with logo + title. Cold-open on the terminal saves 4 seconds of viewer patience.
- End card should show for exactly 3 seconds. Anything longer reads as manipulative.

## Recording checklist

- [ ] Repo public, README on `main` matches shipped state
- [ ] `bundle.json` + `public.pem` example artifacts present in a temp directory
- [ ] `verify.html` open, cleared of any previous state
- [ ] Chrome zoom at 125% for legibility
- [ ] Microphone tested — script rehearsed once out loud, timed to 1:55 – 2:00
- [ ] Cursor movement pre-planned so viewer's eye follows

## What NOT to include

- Live LLM calls. Not because they don't work, but because they add cost + variance + failure mode + screen space that doesn't clarify what Shadow does. Save LLM demos for follow-up content.
- The credit-decision vertical demo. Two-minute HN screencast covers the general primitive. The banking vertical is a follow-up article for the compliance-officer audience.
- Any Anthropic / OpenAI / Google branding beyond a single "provider: anthropic" field in the example bundle. Vendor associations distract from the "works with anyone" story.

## Notes for Alex before recording

1. Read the script out loud twice, time it, adjust for your delivery cadence. Target 1:58 with 2 seconds of end card = 2:00 flat.
2. Record in one take if possible; multi-take editing shows in cursor jumps.
3. Practice the tamper step so the character edit is obvious without a zoom. Do not use `sed`; a human dragging a mouse to edit a single character is more visceral.
4. Post the screencast to a stable URL before publishing the Show HN. Do not host on Twitter; the video should survive the platform being down.
