"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { allProjects, allWork } from "@/lib/content";
import { useView } from "@/components/view-context";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setView } = useView();
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  // Restore focus to the trigger when the palette closes (WCAG 2.4.3).
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

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

  const views: Action[] = [
    { id: "v-classic", label: "Classic view", hint: "the standard portfolio", icon: <LayoutGrid size={16} />, run: () => switchTo("classic"), keywords: "default standard reset" },
    { id: "v-play", label: "Play view", hint: "explorable build graph", icon: <Gamepad2 size={16} />, run: () => switchTo("gamified"), keywords: "game gamified graph terminal explore" },
    { id: "v-chat", label: "Chat view", hint: "ask my portfolio", icon: <MessagesSquare size={16} />, run: () => switchTo("chat"), keywords: "ai concierge conversation assistant" },
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
              aria-label="Search commands"
              placeholder="Jump to a page, project, or link…"
              spellCheck={false}
              autoComplete="off"
              className="no-focus-ring w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-fg-muted"
            />
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">
              No results.
            </Command.Empty>
            <Group heading="Switch view" actions={views} />
            <Group heading="Navigate" actions={nav} />
            <Group heading="Work" actions={workItems} />
            <Group heading="Projects" actions={projItems} />
            <Group heading="Links" actions={links} />
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}

function Group({ heading, actions }: { heading: string; actions: Action[] }) {
  return (
    <Command.Group
      heading={heading}
      className="px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
    >
      {actions.map((a) => (
        <Command.Item
          key={a.id}
          value={`${a.label} ${a.hint ?? ""} ${a.keywords ?? ""}`}
          onSelect={a.run}
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
