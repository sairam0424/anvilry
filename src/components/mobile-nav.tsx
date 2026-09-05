"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile } from "@/lib/profile";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewSwitcher } from "@/components/view-switcher";

type NavLink = { href: string; label: string };

/**
 * Mobile nav drawer (< lg). The desktop nav hides every link below the `lg`
 * breakpoint; without this, switching back to Classic on a phone would land on a
 * page with no reachable nav. WCAG: focus trap while open, Escape to close, focus
 * restored to the trigger on close, aria-expanded/aria-controls wired, backdrop
 * click + link click both dismiss.
 *
 * The backdrop + panel are rendered via a portal into `document.body` rather than
 * in place. site-nav.tsx's <header> has `backdrop-blur-md`, and per the CSS Filter
 * Effects spec a `backdrop-filter` other than `none` establishes a new containing
 * block for `position: fixed` descendants — so without the portal, this backdrop's
 * `fixed inset-0 top-14` resolves against the ~56px-tall <header> instead of the
 * viewport, collapsing `top: 3.5rem` + `bottom: 0` into a zero-height box (no dim,
 * no tap-to-dismiss). Escaping to `document.body` sidesteps the header's
 * containing block entirely.
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
    <div className="lg:hidden">
      <Tooltip content={open ? "Close menu" : "Open menu"}>
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
      </Tooltip>

      {open &&
        createPortal(
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
              {/* View switcher — only below `sm`. At `sm` and up the top nav row already
                shows the compact pill (see site-nav.tsx); duplicating it here would be
                redundant, so it's scoped to the narrow phones that hid it up there.
                scope="drawer" gives this instance its own layoutId — the top-row
                compact pill is unconditionally mounted (CSS-only visibility) and this
                drawer only mounts when open, so both can be in the DOM together
                whenever the drawer is opened in the sm-lg range; without a distinct
                scope they'd collide on the same layoutId (see view-switcher.tsx). */}
              <div className="mb-3 border-b border-border pb-3 sm:hidden">
                <ViewSwitcher compact scope="drawer" />
              </div>
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
              <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                <Tooltip content="GitHub">
                  <a
                    href={profile.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-3 text-fg-muted transition-colors hover:bg-bg-elevated hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Github size={20} />
                  </a>
                </Tooltip>
                <Tooltip content="LinkedIn">
                  <a
                    href={profile.links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-3 text-fg-muted transition-colors hover:bg-bg-elevated hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Linkedin size={20} />
                  </a>
                </Tooltip>
                {/* ThemeToggle's own button (theme-toggle.tsx) isn't padded — it's shared
                    with the 18px desktop nav row where a bigger hit target isn't needed.
                    Padding is added here, scoped to just this drawer instance, via an
                    arbitrary child-selector variant so the real <button> box (not just a
                    visual wrapper) grows to match the GitHub/LinkedIn targets above. */}
                <div className="[&>button]:rounded-lg [&>button]:p-3 [&>button:hover]:bg-bg-elevated">
                  <ThemeToggle size={20} />
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
