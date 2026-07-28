# Talk track — EN (3–5 minutes)

Every line maps to one click-map step (see `DEMO_CLICK_MAP.md`). Keep to plain language during the demo;
technical detail lives in `DEMO_QA.md`. Do **not** claim Beam Pro / XREAL device validation anywhere.

---

**[0:00–0:25 · Problem]** — *(before opening anything, or on the guided-demo intro slide)*

> Financial institutions can generate AI answers very quickly. It is much harder to reconstruct where an
> answer came from, and whether the decision record was changed afterward.

**[0:25–1:00 · Banking record]** — *(open `verify.html`, load `pristine-banking-bundle.json`)*

> This is a simplified financial risk review — a loan decision. Shadow records not only the final AI output,
> but also the sources, the model and tool activity, the specialist review, and the human decision status
> behind it. Here the record is a sealed evidence bundle: the prompt, the tool call, the model output, and a
> human-approval step.

**[1:00–1:40 · Inspect a conclusion's source + human status]** — *(point at the trust matrix + events)*

> We can inspect where a conclusion came from — the source, the analytical step, whether the source resolves,
> and whether human approval is present. The point I want you to take away: an AI conclusion is not
> automatically correct.

**[1:40–2:10 · First verification — the core line]** — *(the VERIFIED result is on screen)*

> The record currently verifies successfully. This does not prove that the financial conclusion is correct.
> It proves that the recorded evidence is internally consistent, signed, and unchanged.

*(This sentence is the center of the whole demo. Say it slowly.)*

**[2:10–2:40 · Tamper one early record]** — *(load `tampered-banking-bundle.json`)*

> Now I will change one earlier piece of the record — an early analytical step — and leave the final
> conclusion untouched. The question is what happens when an earlier event no longer matches the sealed
> evidence.

**[2:40–3:20 · First failure + downstream]** — *(the FAILED result + failed sequence + downstream)*

> Shadow does not only report that something is wrong. It identifies the first point where verification
> fails, and separates that first failure from the later steps that depend on it. Here is the first failing
> record, and here are the downstream records affected by it.

**[3:20–4:00 · Independent verification]** — *(gesture at the browser — it's one offline file)*

> And this matters: the reviewer does not need to trust the main Shadow application. This is a single offline
> file — no network, nothing uploaded. The evidence can be checked independently. The original record passes;
> the modified record fails.

**[4:00–4:40 · Unity / XREAL status]** — *(optional: show `fallback/08-unity-xreal-readiness.png` or the Audit Room tab)*

> The same guided workflow has also been implemented in Unity and prepared for XREAL — the typed adapters,
> the Android loader, the voice system, and a candidate APK are built. Real-device validation is still
> pending, because the Beam Pro has not arrived. I am not claiming any device result today.

**[4:40–5:00 · Close]**

> Shadow does not ask institutions to trust another AI answer. It gives them evidence they can inspect and
> verify independently.

---

### Recovery one-liners (if something doesn't appear)
- Verifier doesn't load a file → "Let me show the recorded result" → open `fallback/02-verify-success.png` /
  `fallback/04-first-failure.png`.
- Server hiccup → double-click `verify.html` from Finder (file:// works).
- Keep talking; never debug live. The message survives on the fallback screenshots.
