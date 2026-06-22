# Contributing to Anvilry

Thanks for taking the time. Anvilry is my personal engineering portfolio — not a library or a template — so the bar for what makes sense to contribute is narrow but real.

---

## What I welcome

**Bug reports** are the most useful thing you can file. If something is broken on the live site — a layout issue, a broken link, the chat 503ing unexpectedly, a voice feature misbehaving, an a11y problem — please open an Issue using the bug report template.

**Pull requests** for genuine bugs are welcome too, especially if the fix is small and contained. If you spot a typo in a UI label, a broken import, or an accessibility regression, feel free to open a PR directly.

**Accessibility issues** get priority. If a screen reader, keyboard navigation, or reduced-motion path is broken, flag it — that one matters most to me.

---

## What I won't merge

- **Content changes** — my work history, project descriptions, profile data, and personal metrics are mine. PRs touching `content/`, `src/lib/profile.ts`, or `public/resume/` will be closed.
- **Feature requests** — I have a backlog and a direction. I'm happy to hear ideas as Issues tagged `discussion`, but I'm unlikely to implement suggestions from outside.
- **Design overhauls** — the visual identity is intentional. Unsolicited redesigns won't be merged.
- **Dependency bumps** — I manage these myself via Dependabot and manual review.

---

## Before you open a PR

1. Run `pnpm lint` and `pnpm test` locally — both run in CI and a failing check blocks merge.
2. Test the affected view(s): Classic, Play (WebGL), Chat, Developer. The PR template asks which ones you checked.
3. Keep the diff small and focused. One fix per PR.

---

## Security issues

Please **do not** open a public Issue for security vulnerabilities. See [SECURITY.md](../SECURITY.md) for the private disclosure process.

---

## Questions

Open a GitHub Discussion or email me at **sairamugge4@gmail.com**.
