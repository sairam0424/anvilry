"use client";

import { useEffect } from "react";
import { Section } from "@/components/ui/section";

// Pagefind UI is a static bundle generated post-build by `make search-index`.
// It lives at /public/pagefind/ and is loaded via script tag at runtime.
// In dev the bundle doesn't exist — the effect is a graceful no-op.
declare global {
  interface Window {
    PagefindUI?: new (opts: { element: string; showImages?: boolean; resetStyles?: boolean }) => void;
  }
}

export default function SearchPage() {
  useEffect(() => {
    // Load Pagefind CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/pagefind/pagefind-ui.css";
    document.head.appendChild(link);

    // Load Pagefind JS and initialize
    const script = document.createElement("script");
    script.src = "/pagefind/pagefind-ui.js";
    script.onload = () => {
      if (window.PagefindUI) {
        new window.PagefindUI({ element: "#pagefind-search", showImages: false, resetStyles: true });
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
