"use client";

import { useEffect } from "react";
import { Section } from "@/components/ui/section";

// Pagefind UI is a static bundle generated post-build by `make search-index`.
// It lives at /public/pagefind/ and is loaded via script tag at runtime.
// In dev the bundle doesn't exist — the effect is a graceful no-op.
declare global {
  interface Window {
    PagefindUI?: new (opts: {
      element: string;
      showImages?: boolean;
      resetStyles?: boolean;
    }) => void;
  }
}

export default function SearchPage() {
  useEffect(() => {
    // Load Pagefind CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(link);

    // Load Pagefind JS and initialize. Guarded against double-init: this effect
    // has been observed to fire its onload handler more than once for a single
    // appended <script> (root cause not fully isolated — reproduces even on a
    // hard reload with exactly one network request for the script, so it is not
    // a duplicate fetch), which previously left two identical widgets mounted
    // side by side inside #pagefind-search. Checking for existing children makes
    // initialization idempotent regardless of how many times onload fires.
    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.onload = () => {
      const container = document.getElementById("pagefind-search");
      if (window.PagefindUI && container && container.children.length === 0) {
        new window.PagefindUI({
          element: "#pagefind-search",
          showImages: false,
          resetStyles: true,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  return (
    <main className="flex-1">
      <Section label="// search" title="Search" titleAs="h1">
        <p className="mb-8 text-fg-muted">
          Search across projects, work, articles, and notes.
        </p>
        <div id="pagefind-search" className="max-w-2xl" />
      </Section>
    </main>
  );
}
