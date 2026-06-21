# Security Policy

## Scope

Anvilry is a personal engineering portfolio. The attack surface is intentionally small — a Next.js frontend with three API routes (`/api/chat`, `/api/tts`, `/api/transcribe`) sitting behind Upstash rate limiting on Vercel.

In scope for responsible disclosure:

- Prompt injection or jailbreak that causes the chatbot to produce harmful output
- XSS via streamed markdown in the chat view
- API route abuse that bypasses rate limiting at scale
- Any leak of server-side environment variables or AWS credentials
- SSRF via user-supplied input reaching internal AWS endpoints

Out of scope:

- Theoretical vulnerabilities with no practical exploit path
- Issues requiring physical access to a device
- Social engineering
- Denial-of-service via volumetric traffic (contact Vercel/Upstash directly)

## Reporting

**Do not open a public GitHub Issue for security vulnerabilities.**

Email: **sairamugge4@gmail.com**  
Subject line: `[SECURITY] Anvilry — <brief description>`

Include:
- What the vulnerability is and where it exists
- Steps to reproduce (a minimal proof-of-concept if possible)
- Potential impact as you see it

I will acknowledge within **48 hours** and aim to resolve or mitigate critical issues within **7 days**.

I do not run a bug bounty programme — this is a personal project — but I will credit you in the relevant commit/changelog if you wish.
