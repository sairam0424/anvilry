/**
 * Numbers the privacy page states. They live here, not in the page, so privacy-facts.test.ts can check
 * each one against the source that enforces it. If a limit in the code changes, that test fails
 * until this file (and so the published text) is updated.
 */
export const PRIVACY_FACTS = {
  /** Chat: only the last N messages of a conversation are sent on (src/app/api/chat/route.ts). */
  chatMessagesKept: 12,
  /** Chat: each message is cut to this many characters (src/app/api/chat/route.ts). */
  chatCharsPerMessage: 600,
  /** Chat: a cached first-question answer lives this many hours (src/lib/chat-cache.ts). */
  faqCacheHours: 24,
  /** Spoken replies: one sentence of at most this many characters per request (tts routes). */
  ttsCharsPerRequest: 600,
  /** Limits for the chat, voice and error-report routes: requests per window per IP. */
  rateLimitRequests: 8,
  rateLimitWindowSeconds: 60,
  /** Error reports are kept at most this many days, best effort (src/lib/telemetry/emit.ts). */
  errorRetentionDays: 7,
  /** Error reports: the recent-errors list keeps this many entries (src/app/api/error/route.ts). */
  recentErrorsKept: 50,
  /** Browser history of recently used command-palette items (src/components/command-palette-content.tsx). */
  recentCommandsKept: 5,
  /** The audio cap for private transcription, in bytes (src/app/api/transcribe/route.ts). */
  transcribeMaxMegabytes: 5,
  /** Last edit of the privacy text. */
  lastUpdated: "31 October 2026",
} as const;
