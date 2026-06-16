"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/components/chat/use-chat";
import { useStt } from "@/components/chat/use-stt";
import { useSpeechSynthesis } from "@/components/chat/use-speech-synthesis";
import { useVoiceSettings } from "@/lib/voice-settings-context";
import { parseCards } from "@/components/chat/parse-cards";

/**
 * The two-way "talk mode" state machine: a free, TURN-BASED (half-duplex) voice
 * conversation built entirely on the existing seams — browser STT -> useChat().send
 * -> grounded Bedrock text stream -> browser TTS. No realtime API, no new vendor, and
 * critically it routes through /api/chat, so answers stay grounded in the corpus (a
 * speech-to-speech model would bypass that and could fabricate).
 *
 * Lifecycle:  idle --start()--> listening --(final transcript)--> thinking
 *             --(stream settles)--> speaking --(speech ends)--> listening (loop)
 *
 * STATE IS DERIVED, not stored: `state` is computed each render from the three child
 * hooks (recognition.isListening / isStreaming / tts.isSpeaking) plus `active` and
 * `paused`. The effects only fire SIDE EFFECTS (send / speak / re-listen) — they never
 * setState, so there's no setState-in-effect render cascade. The only stored state is
 * whether the session is open and whether the mic is parked.
 *
 * SELF-HEARING is avoided by design: recognition uses continuous=false, so the mic
 * stops the instant it returns a final result — it is already OFF during thinking +
 * speaking, so the synthetic voice can never feed back in. We re-open the mic only
 * AFTER speech fully ends. Barge-in is therefore a UI interrupt (tap / Space), not
 * voice — true voice barge-in needs a hot mic during playback (the feedback loop).
 * This is the honest free approximation, not ChatGPT full-duplex.
 */

export type VoiceSessionState = "idle" | "listening" | "thinking" | "speaking" | "paused";

/**
 * Plain prose for BOTH the spoken answer and the visible caption — the single source
 * so the two can never drift (the caption used to render raw content while only the
 * spoken path was stripped, leaking `**markdown**` and `[[card:...]]` to screen).
 *
 * Steps: (1) parseCards() drops card tokens and keeps text segments; (2) strip the
 * display-only markdown markers the eye sees but the synthesizer already ignores —
 * block structure (leading `#` headings, `-`/`*`/`1.` list markers, ``` fences) and
 * inline emphasis/code (`**`, `__`, `*`, `_`, backticks). A dangling unclosed `[[card`
 * fragment mid-stream (before the closing `]]` arrives) is also dropped so a half-
 * written token is never spoken or shown.
 */
export function toCaptionText(content: string): string {
  const prose = parseCards(content)
    .filter((s): s is { type: "text"; text: string } => s.type === "text")
    .map((s) => s.text)
    .join(" ");
  return prose
    .replace(/\[\[card:[^\]]*$/i, "") // dangling, not-yet-closed card token mid-stream
    .replace(/```[^\n]*\n?/g, "") // code fences
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // leading heading hashes
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "") // leading list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** @deprecated use toCaptionText — kept as the spoken-path name for clarity. */
const stripForSpeech = toCaptionText;

export function useVoiceSession() {
  const { settings } = useVoiceSettings();
  const { messages, send, stop: stopStream, isStreaming } = useChat();
  const recognition = useStt(settings.sttEngine);
  const tts = useSpeechSynthesis(settings.ttsEngine);

  // `active` (session open?) is the ONLY stored state — everything else (listening /
  // thinking / speaking / paused) is DERIVED from the child-hook signals below, so the
  // transition effects fire pure side effects and never setState.
  const [active, setActive] = useState(false);

  // STT gates entry (TTS is near-universal; without recognition there's no talk loop).
  const supported = recognition.supported;

  // Edge detectors for the transition effects (written ONLY inside effects, never
  // during render — so the react-hooks/refs rule is satisfied).
  const prevStreaming = useRef(false);
  const prevSpeaking = useRef(false);
  // True once the current assistant turn has had its dedup counter reset. Set on the
  // turn's first streaming render, cleared when the stream settles — so resetTurn()
  // fires EXACTLY ONCE per turn (never mid-stream, which would re-speak earlier sentences).
  const turnStartedRef = useRef(false);

  // `force` lets start() begin listening in the same tick it calls setActive(true),
  // before the `active` state has committed — avoiding a stale-closure read.
  const beginListening = useCallback(
    (force = false) => {
      if (!active && !force) return;
      recognition.start((finalText) => {
        const q = finalText.trim();
        if (q) send(q); // empty result -> recognition stops, derived state -> paused
      });
    },
    [active, recognition, send],
  );

  /** Open the session and start the first listen (an explicit user gesture). */
  const start = useCallback(() => {
    if (!supported) return;
    setActive(true);
    beginListening(true);
  }, [supported, beginListening]);

  /**
   * Ask a typed/preset question by VOICE without using the mic — opens the session and
   * sends the text straight through the SAME grounded transport, so the answer streams
   * and is spoken exactly like a spoken turn, then the loop re-listens. Used by the
   * Anvil view's example-prompt chips (a user gesture: a chip click). Routes through the
   * session's own send(), never a sibling useChat, so there is one transcript + one mic.
   */
  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setActive(true);
      recognition.stop(); // mic off while we send + speak (no self-hearing)
      send(q);
    },
    [recognition, send],
  );

  /** Close the session entirely: stop mic, speech, and any in-flight stream. */
  const stop = useCallback(() => {
    setActive(false);
    recognition.stop();
    tts.cancel();
    stopStream();
  }, [recognition, tts, stopStream]);

  /** Barge-in / "stop speaking": cancel the spoken answer AND abort any in-flight
   *  /api/chat stream (with speak-as-it-streams a tap can land mid-stream, not just
   *  mid-speech), then listen again. stopStream() is the AbortController in useChat. */
  const interrupt = useCallback(() => {
    tts.cancel();
    stopStream();
    beginListening();
  }, [tts, stopStream, beginListening]);

  /** Mute: park the mic without closing the session (derived state -> "paused"). */
  const pause = useCallback(() => {
    recognition.stop();
    tts.cancel();
  }, [recognition, tts]);

  /** Resume listening from a parked state. */
  const resume = useCallback(() => beginListening(), [beginListening]);

  // SPEAK-AS-IT-STREAMS: while the answer is still streaming, feed each growing chunk
  // to tts.speakChunk() — it splits complete sentences, holds back the trailing
  // partial, and enqueues only NEW sentences (deduped via its own spokenCountRef). So
  // the first sentence starts speaking ~one sentence after the first token instead of
  // after the whole answer settles. Per-sentence utterances also stay under Chromium's
  // ~15s cutoff. The mic is already OFF here (continuous=false stopped it on the final
  // transcript), so no self-hearing. Side-effect only — never setState.
  useEffect(() => {
    if (!active || !isStreaming) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return;
    // A NEW assistant turn just began streaming — restart the dedup counter at 0 BEFORE
    // the first speakChunk so this answer isn't dropped by the (stale, monotonically
    // climbing) counter from the previous turn. Guarded by turnStartedRef so it fires
    // once per turn and never mid-stream (a mid-stream reset would re-speak sentence 1).
    // The reset and the first enqueue are sequential statements in ONE effect, so the
    // order is guaranteed (no two-effect race).
    if (!turnStartedRef.current) {
      tts.resetTurn();
      turnStartedRef.current = true;
    }
    const text = stripForSpeech(last.content);
    if (text) tts.speakChunk(text);
  }, [active, isStreaming, messages, tts]);

  // SETTLE FINALIZER: when the stream ends, flush the final (trailing) partial sentence
  // that speakChunk held back. MUST be speakChunk(), NOT speak() — speak() calls
  // cancel() and resets the spoken counter, which would RE-SPEAK the whole answer
  // (double-speak). If nothing was streamed (e.g. aborted -> empty), re-listen.
  useEffect(() => {
    if (!active) return;
    const wasStreaming = prevStreaming.current;
    prevStreaming.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      const last = messages[messages.length - 1];
      const text = last?.role === "assistant" ? stripForSpeech(last.content) : "";
      if (text) tts.speakChunk(text); // finalizer: flush the trailing sentence
      else beginListening(); // nothing to say — listen again
      // Re-arm: the NEXT turn's streaming effect must reset the dedup counter again.
      turnStartedRef.current = false;
    }
  }, [active, isStreaming, messages, tts, beginListening]);

  // SPEAKING -> LISTENING: once speech fully ends, re-open the mic (hands-free loop).
  // Side-effect only (recognition.start is a child-hook callback, not local setState).
  useEffect(() => {
    if (!active) return;
    const wasSpeaking = prevSpeaking.current;
    prevSpeaking.current = tts.isSpeaking;
    if (wasSpeaking && !tts.isSpeaking && !isStreaming) beginListening();
  }, [active, tts.isSpeaking, isStreaming, beginListening]);

  // Safety net: tear down if the session is somehow left active on unmount.
  // CRITICAL: recognition/tts are FRESH objects every render, so listing them as deps
  // would re-run this effect's CLEANUP on every render — and the cleanup calls
  // tts.cancel(), which clears the speech queue + zeroes the dedup counter. That is
  // exactly the "no audio" bug: speech is enqueued, then cancelled, every render. Run
  // the teardown ONLY on true unmount (empty deps) and reach the LATEST hooks via a ref.
  const teardownRef = useRef({ recognition, tts });
  // Keep the ref pointing at the latest hooks (set in an effect, never during render —
  // react-hooks/refs), mirroring the enqueueBrowserRef idiom in use-speech-synthesis.ts.
  useEffect(() => {
    teardownRef.current = { recognition, tts };
  }, [recognition, tts]);
  useEffect(
    () => () => {
      teardownRef.current.recognition.stop();
      teardownRef.current.tts.cancel();
    },
    [],
  );

  // Derive the externally-visible state from the live child-hook signals — single
  // source of truth, no stored/duplicated state to drift.
  let state: VoiceSessionState;
  if (!active) state = "idle";
  else if (isStreaming) state = "thinking";
  else if (tts.isSpeaking) state = "speaking";
  else if (recognition.isListening) state = "listening";
  else state = "paused"; // active but mic idle (between turns / after a no-speech timeout)

  return {
    supported,
    active,
    state,
    interim: recognition.interim,
    messages,
    isStreaming,
    error: recognition.error,
    start,
    ask,
    stop,
    interrupt,
    pause,
    resume,
  };
}
