"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";

type NavLink = { href: string; label: string };

/**
 * Mobile nav drawer (< sm). The desktop nav hides every link below the `sm`
 * breakpoint; without this, switching back to Classic on a phone would land on a
 * page with no reachable nav. WCAG: focus trap while open, Escape to close, focus
 * restored to the trigger on close, aria-expanded/aria-controls wired, backdrop
 * click + link click both dismiss.
 */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape and trap focus within the panel while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the panel when it opens.
    panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Restore focus to the trigger when the drawer closes (WCAG 2.4.3).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-bg-base/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-x-0 top-14 z-50 border-b border-border-strong bg-bg-surface px-6 py-4 shadow-2xl"
          >
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
              <a
                href={profile.links.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                onClick={() => setOpen(false)}
                className="text-fg-muted transition-colors hover:text-accent"
              >
                <Github size={20} />
              </a>
              <a
                href={profile.links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                onClick={() => setOpen(false)}
                className="text-fg-muted transition-colors hover:text-accent"
              >
                <Linkedin size={20} />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
