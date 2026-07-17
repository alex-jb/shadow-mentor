# Verifiability as a badge

Compliance verdicts don't go viral — they're private, about your own risk, and
nobody reshares a decline. So the distribution mechanism for an evidence tool
isn't virality; it's **verifiability as a badge**, the same shape as a CI badge:
a consumer proves their own audit chain verifies, and the badge on *their* README
advertises *their* credibility. They market their trustworthiness, using Shadow.

## The recommended way: verify in your own CI (no Shadow-hosted anything)

Shadow ships a GitHub Action (`.github/actions/shadow-verify`) that verifies an
evidence bundle against a public key and fails the run on any chain break. Point
a workflow at your committed bundle(s) and use GitHub's native status badge.

**1. Add a workflow** — `.github/workflows/verify-audit.yml`:

```yaml
name: verify-audit
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: alex-jb/shadow-mentor/.github/actions/shadow-verify@main
        with:
          bundle: audit/session.bundle.json
          public-key: audit/public.pem
```

**2. Put the badge in your README** (3 lines):

```markdown
[![audit chain](https://github.com/OWNER/REPO/actions/workflows/verify-audit.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/verify-audit.yml)
```

Green means the committed evidence bundle still verifies against the published
key — no chain break, no post-hoc edit. If someone silently rewrites a record,
the next push turns the badge red. The proof runs on GitHub's infrastructure, on
your repo, with tooling you can read (`bin/shadow-verify.mjs`, MIT). Shadow hosts
nothing; there is no runtime dependency on us.

## Why not a hosted `img.shields.io/endpoint` badge (yet)

A hosted badge would take your bundle URL as a query parameter and fetch it
server-side to render verified/failed. That endpoint fetches an
attacker-controllable URL on our infrastructure — a server-side request forgery
(SSRF) surface (fetch of `169.254.169.254`, internal hosts, redirect chains into
a private network). A half-safe SSRF guard is worse than none, so we do **not**
ship a casual URL-fetching badge endpoint. The CI-badge pattern above needs no
such endpoint and is strictly safer, so it is the recommended form. A hosted
badge, if built later, must ship with a hardened fetch (allowlist scheme, block
private/loopback/link-local ranges after DNS resolution, cap size + time, no
redirects to internal targets) and its own threat-model review.

## What already exists

- `/api/badge` — shields.io endpoint for Shadow's own benchmark score (not a
  consumer verify badge).
- `/api/verify-attestation` (POST) + `/api/attestation-info` (GET, also at
  `/.well-known/shadow-attestation`) — the verify + key-discovery surfaces the
  CI action and any pipeline build on.
- `bin/shadow-verify.mjs` + the `shadow-verify` Action — the offline verifier the
  badge is really asserting.
