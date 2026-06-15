# Changelog

All notable changes to Anvilry are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Branch model: `develop` (working) → `main` (release; auto-deploys to
[anvilry.vercel.app](https://anvilry.vercel.app)).

## [1.4.0] — 2026-06-15

The voice release — speak to the portfolio, hear it answer back — plus a
production-readiness hardening pass. Everything is **opt-in, free-first, and
backward-compatible**: the text chat and all four views are unchanged, voice is
strictly additive, and any unsupported browser or runtime error degrades to text.

### Added — Voice layer (opt-in, browser-native, free-first)
- **Mic input (push-to-talk)** — a mic button in the chat composer (full view + the
  floating widget); speak a question, the transcript fills the input for review. First
  use shows a one-line cloud-audio disclosure; the mic opens only on an explicit
  gesture and is released on stop.
- **Read-aloud** — a per-answer "Listen" button speaks the reply via the browser
  `speechSynthesis` engine (per-sentence, starts before the full answer arrives), with
  an `aria-live` reconciliation so screen-reader users never hear the answer twice.
- **Two-way talk mode** — a hands-free, turn-based conversation (listen → think →
  speak) as a focus-trapped modal overlay (default) or an optional full-page 5th
  "voice" view, selectable from the command palette.
- **Wake word ("Hey portfolio")** — opt-in, **off by default**, behind a cloud-audio
  disclosure gate, with a persistent "Listening" banner + one-tap kill, scoped to the
  voice views.
- **Optional AWS engines (feature-flagged, no new vendor)** — AWS Polly Neural TTS
  (`/api/tts`) and AWS Transcribe streaming STT (`/api/transcribe`), reusing the
  existing Bedrock credentials. Both fail closed to the free browser path.
- **`VOICE.md`** — full feature reference (architecture, settings/flags table,
  env/IAM/cost, privacy & a11y, developer notes), linked from the README; plus voice
  notes in `README.md`, `DEPLOY.md`, and `.env.example`.

### Added — Production hardening
- **HTTP security headers** via `next.config.ts` `headers()`: `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, a mic-scoped `Permissions-Policy`, and a
  `Content-Security-Policy-Report-Only` scoped to the site's real surfaces (to be
  promoted to enforced after a live zero-violation check). HSTS continues to come from
  Vercel's platform default.
- **Notes SEO parity** — `BreadcrumbList` JSON-LD + a per-note Open Graph image
  (empty-safe; renders once a note exists).

### Changed
- The floating "Ask my portfolio" widget now streams through the shared `useChat`
  transport (deduplicated logic; it also inherits 429 + abort handling it lacked).

### Security
- **Loud rate-limit-misconfiguration guard** — failing open on a *transient* Upstash
  error is intentional, but a fully unconfigured limiter in production now emits a
  clear warning at startup (the cost-bearing `/api/chat`, `/api/tts`, `/api/transcribe`
  routes would otherwise be silently unprotected against per-IP AWS cost abuse).
- **Payload prechecks** — reject oversized request bodies by declared `Content-Length`
  before buffering, on `/api/chat` (64 KB), `/api/tts` (8 KB), and `/api/transcribe`
  (5 MiB).
- **Polly timeout** — the Polly audio read races a 10 s cap so a stalled stream fails
  fast to the browser-TTS fallback instead of holding the function open.

### Verification
- Backed by a 20-agent voice deep-research pass, a 17-agent WCAG 2.2 AA + privacy
  audit, and a 24-agent production-readiness audit — each with adversarial verification
  of findings against the source.
- Build green: 35 test files, 199 tests (chained into `pnpm build`).

## [1.3.1] — 2026-06-14
- Responsive console fixes (developer/chat footer + composer overlap) and a full
  editorial spelling/grammar audit across user-facing copy.

## [1.3.0] — 2026-06-14
- The engineering-visible release: command palette upgrades, notes scaffolding,
  view-transition polish, first-party GitHub project feed, MCP endpoint fixes.

## [1.2.0] — 2026-06-14
- Developer Mode layout upgrade + the subtle-delight easter-egg system.

## [1.1.0] — 2026-06-14
- Developer Mode view (full-page keyboard-native terminal) + autoscroll engine fix.

## [1.0.0] — 2026-06-13
- Initial public portfolio: four switchable views (Classic · Play · Chat · Developer)
  over one canonical content source, with the AWS Bedrock "Ask my portfolio" chat.

[1.4.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.4.0
[1.3.1]: https://github.com/sairam0424/anvilry/releases/tag/v1.3.1
[1.3.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.3.0
[1.2.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.2.0
[1.1.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.1.0
[1.0.0]: https://github.com/sairam0424/anvilry/releases/tag/v1.0.0
