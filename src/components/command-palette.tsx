"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { Command } from "cmdk";
// Radix Dialog Title/Description — same instance cmdk bundles (deduped to one
// version), so these register with cmdk's internal <Dialog.Content> context and
// satisfy the a11y requirement (resolves the "DialogContent requires DialogTitle"
// console error). Hidden via the existing sr-only class (no extra dep).
import { Title as DialogTitle, Description as DialogDescription } from "@radix-ui/react-dialog";
import {
  Home,
  FolderGit2,
  User,
  FileText,
  Mail,
  Briefcase,
  ArrowUpRight,
  TerminalSquare,
  LayoutGrid,
  Gamepad2,
  MessagesSquare,
  Copy,
  Download,
  Plug,
  Volume2,
  VolumeX,
  AudioLines,
  Mic,
  Ear,
  Sparkles,
} from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, resumeVariants } from "@/lib/profile";
import { unlockAll } from "@/lib/discovery-store";
import { allProjects, allWork } from "@/lib/content";
import { useView } from "@/components/view-context";
import { useVoiceSettings } from "@/lib/voice-settings-context";
import { openTalkMode } from "@/components/chat/talk-overlay-store";
import {
  CURATED_VOICES,
  getDefaultVoiceId,
  getVoiceById,
} from "@/lib/voice-catalog";
import { VoicePicker } from "@/components/chat/voice-picker";
import { VoiceSettingsDialog } from "@/components/chat/voice-settings-dialog";
import { Settings } from "lucide-react";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
  // Stable cmdk search value. Defaults to label+hint+keywords, but actions whose LABEL
  // mutates (e.g. copy-email flipping to "Copied!") set this so the value cmdk scores
  // against never changes mid-interaction.
  value?: string;
};

// Recently-run actions persist in localStorage so the palette opens to "what you
// just did" instead of a cold list. SSR-safe: read only after mount (the dialog
// content mounts on open, post-hydration, so there's no markup to mismatch).
const RECENT_KEY = "anvilry:cmd:recent";
const RECENT_MAX = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { setView } = useView();
  const { settings, toggle, set } = useVoiceSettings();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Voice picker dialog opens on "Pick voice…" (quick-swap commands set the
  // voiceId directly without opening, since they're a one-action choice).
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  // Voice settings dialog (canonical full-config surface) opens on "Voice settings…".
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const currentVoiceId = settings.voiceId ?? getDefaultVoiceId();
  const currentVoiceName = getVoiceById(currentVoiceId)?.displayName ?? "Default";
  const wasOpen = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Load recents + reset the query each time the palette opens (so it always
  // greets you with your most-used actions, never a stale search string).
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setSearch("");
    }
  }, [open]);

  // Restore focus to the trigger when the palette closes (WCAG 2.4.3).
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Push an action id to the front of the MRU list (deduped, capped, persisted).
  const record = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* private mode / quota — recents are best-effort, never block the action */
      }
      return next;
    });
  }, []);

  const go = useCallback(
    (href: string, external = false) => {
      setOpen(false);
      if (external) window.open(href, "_blank", "noopener,noreferrer");
      else router.push(href);
    },
    [router],
  );

  const switchTo = useCallback(
    (v: Parameters<typeof setView>[0]) => {
      setOpen(false);
      setView(v);
    },
    [setView],
  );

  // Copy email to the clipboard WITHOUT closing — shows a transient "Copied!"
  // so the action confirms itself in place (recruiters often want it on the
  // clipboard, not a mail-client launch).
  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      go(`mailto:${profile.email}`, true); // clipboard blocked → fall back to mail client
    }
  }, [go]);

  const views: Action[] = [
    { id: "v-classic", label: "Classic view", hint: "the standard portfolio", icon: <LayoutGrid size={16} />, run: () => switchTo("classic"), keywords: "default standard reset" },
    { id: "v-play", label: "Play view", hint: "explorable build graph", icon: <Gamepad2 size={16} />, run: () => switchTo("gamified"), keywords: "game gamified graph explore" },
    { id: "v-dev", label: "Developer mode", hint: "full-page terminal — query my work", icon: <TerminalSquare size={16} />, run: () => { track("devmode_palette_open"); switchTo("developer"); }, keywords: "terminal cli console command shell whoami grep developer" },
    { id: "v-chat", label: "Chat view", hint: "ask my portfolio", icon: <MessagesSquare size={16} />, run: () => switchTo("chat"), keywords: "ai concierge conversation assistant" },
    { id: "v-resume", label: "Recruiter view", hint: "scan-friendly CV + PDF downloads", icon: <User size={16} />, run: () => switchTo("resume"), keywords: "resume cv recruiter scan pdf download hiring" },
    ...(process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true" ? [
      { id: "unlock-discoveries", label: "Unlock all discoveries", hint: "★ reveal all 5 exploration badges", icon: <Sparkles size={16} />, run: () => { unlockAll(); setOpen(false); }, keywords: "discovery badge explore unlock all" },
    ] : []),
  ];

  const nav: Action[] = [
    { id: "home", label: "Home", icon: <Home size={16} />, run: () => go("/") },
    { id: "work", label: "Work", hint: "flagship systems", icon: <Briefcase size={16} />, run: () => go("/#work") },
    { id: "projects", label: "Projects", hint: `${allProjects.length} repos`, icon: <FolderGit2 size={16} />, run: () => go("/projects") },
    { id: "about", label: "About", icon: <User size={16} />, run: () => go("/about") },
    { id: "resume", label: "Résumé", icon: <FileText size={16} />, run: () => go("/resume") },
    { id: "contact", label: "Contact", icon: <Mail size={16} />, run: () => go("/#contact") },
  ];

  const links: Action[] = [
    { id: "gh", label: "GitHub", hint: `github.com/${profile.githubUser}`, icon: <Github size={16} />, run: () => go(profile.links.github, true) },
    { id: "li", label: "LinkedIn", icon: <Linkedin size={16} />, run: () => go(profile.links.linkedin, true) },
    { id: "email", label: "Email me", hint: profile.email, icon: <Mail size={16} />, run: () => go(`mailto:${profile.email}`, true) },
  ];

  // In-palette actions — things you DO, not pages you go to. Copy-email confirms
  // in place; each role-targeted résumé downloads directly; /mcp surfaces the
  // agent endpoint. Résumé entries derive from profile.resumeVariants (single
  // source — a new variant appears here automatically).
  const actions: Action[] = [
    {
      id: "copy-email",
      label: copied ? "Copied!" : "Copy email",
      hint: profile.email,
      icon: <Copy size={16} />,
      run: copyEmail,
      keywords: "clipboard contact mail address",
      // Fixed value — the label flips to "Copied!" for ~1.5s, but the search value must
      // not mutate (cmdk re-scores on value change).
      value: `Copy email ${profile.email} clipboard contact mail address`,
    },
    ...resumeVariants.map((v) => ({
      id: `dl-${v.file}`,
      label: `Download résumé — ${v.label}`,
      hint: v.tag,
      icon: <Download size={16} />,
      run: () => go(v.file, true),
      keywords: `resume cv pdf ${v.label} ${v.tag}`,
    })),
    { id: "mcp", label: "Open MCP endpoint", hint: "for AI agents", icon: <Plug size={16} />, run: () => go("/mcp"), keywords: "ai agent model context protocol tools api" },
  ];

  // Voice toggles — opt-in, persisted. "Read answers aloud" only appears where the
  // browser supports speech synthesis (else it would toggle a no-op). The toggle
  // flips the pref and closes the palette; a "Listen" button then appears under each
  // answer. We feature-detect at render (the palette is client-only).
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const sttSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const voice: Action[] = [
    // "Pick voice…" — the primary entry point to the curated 6-card picker.
    // Always offered (browser TTS is near-universal) so a user without read-aloud
    // toggled on can still preview voices and decide.
    ...(ttsSupported
      ? [
          {
            id: "voice-pick",
            label: "Pick voice…",
            hint: currentVoiceName,
            icon: <AudioLines size={16} />,
            run: () => {
              setOpen(false);
              // Open the picker dialog AFTER the palette closes so focus management
              // doesn't fight (the picker's getOpener won't return triggerRef while
              // the palette is still open).
              setVoicePickerOpen(true);
            },
            keywords: "voice pick choose select stephen joanna ruth matthew aoede charon catalog",
            value: "Pick voice choose select stephen joanna ruth matthew aoede charon catalog",
          },
          {
            id: "voice-settings",
            label: "Voice settings…",
            hint: "engine, character, toggles",
            icon: <Settings size={16} />,
            run: () => {
              setOpen(false);
              setVoiceSettingsOpen(true);
            },
            keywords: "voice settings preferences engine character speed tone pause toggles all-in-one",
            value: "Voice settings preferences engine character speed tone pause toggles all-in-one",
          },
        ]
      : []),
    // Quick-swap entries — one per curated voice. Searching "stephen" / "warm" /
    // "generative" all surface Stephen. Setting voiceId directly (no dialog open)
    // so the palette doubles as a power-user voice switcher.
    ...(ttsSupported
      ? CURATED_VOICES.map((v) => ({
          id: `voice-pick-${v.id}`,
          label: `Voice: ${v.displayName}`,
          hint: v.descriptor,
          icon: <Volume2 size={16} />,
          run: () => {
            set({ voiceId: v.id });
            setOpen(false);
          },
          // Searchable: voice + name + descriptor + accent + engine tier.
          keywords: `voice ${v.displayName.toLowerCase()} ${v.descriptor.toLowerCase()} ${v.gender} ${v.accent} ${v.engine}${v.pollyTier ? " " + v.pollyTier : ""}`,
          value: `Voice ${v.displayName} ${v.descriptor} ${v.gender} ${v.accent} ${v.engine}${v.pollyTier ? " " + v.pollyTier : ""}`,
        }))
      : []),
    // Hands-free two-way talk mode — only on the modal surface (the 5th-view surface
    // is entered via the ViewSwitcher) and only where speech recognition exists.
    ...(sttSupported && settings.talkSurface === "modal"
      ? [
          {
            id: "voice-talk",
            label: "Start voice conversation",
            hint: "hands-free talk mode",
            icon: <AudioLines size={16} />,
            run: () => {
              setOpen(false);
              // Pass the palette trigger as the focus-restore target so closing the
              // talk modal returns focus there (WCAG 2.4.3), not to <body>.
              openTalkMode(triggerRef.current);
            },
            keywords: "voice talk conversation speak hands-free microphone mic chat assistant",
          },
        ]
      : []),
    // Read-aloud toggle — only where speech synthesis exists.
    ...(ttsSupported
      ? [
          {
            id: "voice-tts",
            label: settings.ttsEnabled ? "Turn off read-aloud" : "Read answers aloud",
            hint: settings.ttsEnabled ? "on" : "spoken responses",
            icon: settings.ttsEnabled ? <VolumeX size={16} /> : <Volume2 size={16} />,
            run: () => {
              toggle("ttsEnabled");
              setOpen(false);
            },
            keywords: "voice speak audio tts text to speech accessibility listen sound",
            // Label flips with state, so pin a stable search value (cmdk re-scores on change).
            value: "Read answers aloud voice speak audio tts accessibility listen sound",
          },
        ]
      : []),
    // TTS engine — free browser voice (default) vs AWS Polly Neural (higher quality,
    // owner's existing AWS creds). Only offered when read-aloud is on + browser TTS
    // exists; Polly falls back to browser automatically if the route errors.
    ...(ttsSupported && settings.ttsEnabled
      ? [
          {
            id: "voice-engine",
            label:
              settings.ttsEngine === "polly"
                ? "Use free browser voice"
                : "Use higher-quality voice (Polly)",
            hint: settings.ttsEngine === "polly" ? "Polly Neural" : "browser default",
            icon: <AudioLines size={16} />,
            run: () => {
              set({ ttsEngine: settings.ttsEngine === "polly" ? "browser" : "polly" });
              setOpen(false);
            },
            keywords: "voice engine polly neural quality aws browser tts",
            value: "Voice engine polly neural quality aws browser tts",
          },
        ]
      : []),
    // STT engine — free browser Web Speech (default) vs AWS Transcribe (audio
    // processed on the owner's own AWS, a stronger privacy story + works in Firefox).
    // Always offered: even where browser STT is absent, Transcribe (getUserMedia +
    // AudioContext) may still work, so this is how a Firefox visitor enables voice.
    {
      id: "voice-stt-engine",
      label:
        settings.sttEngine === "transcribe"
          ? "Mic: use browser speech"
          : "Mic: use private transcription (AWS)",
      hint: settings.sttEngine === "transcribe" ? "AWS Transcribe" : "browser default",
      icon: <Mic size={16} />,
      run: () => {
        set({ sttEngine: settings.sttEngine === "transcribe" ? "browser" : "transcribe" });
        setOpen(false);
      },
      keywords: "voice mic stt speech recognition transcribe aws privacy firefox input",
      value: "Mic speech recognition engine transcribe aws browser privacy input",
    },
    // Voice modal-shortcut visibility. The dedicated "Voice" view (5th switcher entry)
    // is always available; this only controls whether the quick MODAL doors — the Chat
    // "Talk" pill and the ⌘K "Start voice conversation" entry — are shown ("modal") or
    // hidden in favor of the full view ("view"). Relabeled to match that real behavior
    // (it no longer selects where talk *opens* — the view is always on). STT-gated.
    ...(sttSupported
      ? [
          {
            id: "voice-surface",
            label:
              settings.talkSurface === "view"
                ? "Show voice modal shortcuts"
                : "Hide voice modal shortcuts",
            hint: settings.talkSurface === "view" ? "use the full Voice view" : "Talk pill + ⌘K",
            icon: <AudioLines size={16} />,
            run: () => {
              set({ talkSurface: settings.talkSurface === "view" ? "modal" : "view" });
              setOpen(false);
            },
            keywords: "voice talk modal shortcuts pill command palette quick door visibility",
            value: "Voice modal shortcuts talk pill command palette quick door visibility",
          },
        ]
      : []),
    // Wake word — opt-in, OFF by default, highest trust cost. Switches to the Chat
    // view (where it's scoped) and flips the pref; the WakeWordController then shows a
    // cloud-audio disclosure before arming the mic, plus a persistent banner + kill.
    ...(sttSupported
      ? [
          {
            id: "voice-wake",
            label: settings.wakeWord ? "Turn off wake word" : "Enable wake word (Hey portfolio)",
            hint: settings.wakeWord ? "listening" : "hands-free, opt-in",
            icon: <Ear size={16} />,
            run: () => {
              const turningOn = !settings.wakeWord;
              set({ wakeWord: turningOn });
              setOpen(false);
              if (turningOn) setView("chat"); // scope it to where the banner lives
            },
            keywords: "wake word hey portfolio hands-free always listen hotword voice activate",
            value: "Enable wake word hey portfolio hands-free always listen hotword voice",
          },
        ]
      : []),
  ];

  const workItems: Action[] = allWork.map((w) => ({
    id: `w-${w.slug}`,
    label: w.name,
    hint: w.role,
    icon: <Briefcase size={16} />,
    run: () => go(w.url),
    keywords: w.summary,
  }));

  const projItems: Action[] = allProjects.map((p) => ({
    id: `p-${p.slug}`,
    label: p.name,
    hint: p.tagline,
    icon: <FolderGit2 size={16} />,
    run: () => go(p.url),
    keywords: p.tech.join(" "),
  }));

  // Resolve recent ids → live Action objects (ignoring any that no longer exist,
  // e.g. a removed project slug). Shown ONLY on an empty query, so a recent item
  // is never on-screen alongside its canonical copy during filtering.
  const allActions = [...views, ...nav, ...actions, ...voice, ...workItems, ...projItems, ...links];
  const byId = new Map(allActions.map((a) => [a.id, a]));
  const recentItems: Action[] = recent.map((id) => byId.get(id)).filter((a): a is Action => Boolean(a));
  const showRecent = search.trim() === "" && recentItems.length > 0;

  return (
    <>
      {/* Trigger pill — bottom-right, terminal-styled */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-bg-surface/90 px-3 py-2 font-mono text-xs text-fg-muted shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-fg"
      >
        <TerminalSquare size={14} className="text-accent" />
        <span className="hidden sm:inline">Command</span>
        <kbd className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      >
        {/* Accessible name + description for the underlying Radix DialogContent
            (visually hidden). Resolves the "DialogContent requires DialogTitle" a11y
            console error; these register because they share cmdk's Radix instance. */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and jump to a page, project, link, or switch the view.
        </DialogDescription>
        <div className="fixed inset-0 bg-bg-base/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border-strong bg-bg-surface shadow-2xl">
          {/* The search row carries the focus affordance (accent bottom-border via
              focus-within) — cleaner than the glaring global :focus-visible box that
              would otherwise ring the autofocused input inside the modal. */}
          <div className="flex items-center gap-2 border-b border-border px-4 transition-colors focus-within:border-accent">
            <span className="font-mono text-accent">{">"}</span>
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              aria-label="Search commands"
              placeholder="Jump to a page, run an action, or switch view…"
              spellCheck={false}
              autoComplete="off"
              className="no-focus-ring w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-fg-muted"
            />
          </div>
          {/* Status messages (WCAG 2.2 SC 4.1.3): the copy-email confirmation flips a
              cmdk option's label, which is NOT a live region — screen readers wouldn't
              announce it. This polite region speaks the success without moving focus. */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {copied ? "Email copied to clipboard" : ""}
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">
              No results.
            </Command.Empty>
            {/* Recent — MRU, idle-only (empty query). Prefixed value keeps it from
                colliding with the canonical copy under cmdk's value-based nav. */}
            {showRecent && <Group heading="Recent" actions={recentItems} onRun={record} valuePrefix="recent" />}
            <Group heading="Switch view" actions={views} onRun={record} />
            <Group heading="Navigate" actions={nav} onRun={record} />
            <Group heading="Actions" actions={actions} onRun={record} />
            {voice.length > 0 && <Group heading="Voice" actions={voice} onRun={record} />}
            <Group heading="Work" actions={workItems} onRun={record} />
            <Group heading="Projects" actions={projItems} onRun={record} />
            <Group heading="Links" actions={links} onRun={record} />
          </Command.List>
        </div>
      </Command.Dialog>

      {/* Voice picker dialog. Mounted as a sibling to the palette so the palette's
          own Dialog can close cleanly before this one opens (avoids two stacked
          Radix focus-traps fighting). The trigger that opened it is the palette's
          own kbd shortcut, so focus restores to the palette pill via triggerRef. */}
      <VoicePicker
        mode="dialog"
        open={voicePickerOpen}
        onOpenChange={setVoicePickerOpen}
        currentVoiceId={currentVoiceId}
        onPick={(id) => set({ voiceId: id })}
        getOpener={() => triggerRef.current}
      />

      {/* Canonical voice settings dialog — engine, character, toggles in one place. */}
      <VoiceSettingsDialog
        open={voiceSettingsOpen}
        onOpenChange={setVoiceSettingsOpen}
        getOpener={() => triggerRef.current}
      />
    </>
  );
}

function Group({
  heading,
  actions,
  onRun,
  valuePrefix,
}: {
  heading: string;
  actions: Action[];
  onRun?: (id: string) => void;
  valuePrefix?: string;
}) {
  return (
    <Command.Group
      heading={heading}
      className="px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
    >
      {actions.map((a) => (
        <Command.Item
          key={valuePrefix ? `${valuePrefix}-${a.id}` : a.id}
          value={`${valuePrefix ? `${valuePrefix} ` : ""}${a.value ?? `${a.label} ${a.hint ?? ""} ${a.keywords ?? ""}`}`}
          onSelect={() => {
            onRun?.(a.id);
            a.run();
          }}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-muted data-[selected=true]:bg-bg-elevated data-[selected=true]:text-fg"
        >
          <span className="text-accent">{a.icon}</span>
          <span className="flex-1">{a.label}</span>
          {a.hint && <span className="truncate text-xs text-fg-subtle">{a.hint}</span>}
          <ArrowUpRight size={13} className="text-fg-subtle" />
        </Command.Item>
      ))}
    </Command.Group>
  );
}
