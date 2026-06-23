"use client";

import type { FileUIPart } from "@/components/chat/use-chat";

/**
 * A horizontal strip of pending attachment thumbnails rendered above the
 * composer. Images show a 48×48 thumbnail; PDFs show a text badge. Each
 * item has an × dismiss button that removes it from the pending list.
 *
 * Returns null (no layout shift) when `files` is empty.
 */
export function AttachmentPreviewStrip({
  files,
  onRemove,
}: {
  files: FileUIPart[];
  onRemove: (index: number) => void;
}): React.ReactElement | null {
  if (files.length === 0) return null;

  return (
    <div
      className="mt-3 flex flex-wrap gap-2"
      role="list"
      aria-label="Pending attachments"
    >
      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          role="listitem"
          className="relative inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface/60 p-1 pr-2"
        >
          {/* TODO: when PDF support is restored via pdf.js, add mediaType === "application/pdf" branch here */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.previewUrl}
            alt={f.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-md object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${f.name}`}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-border hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
