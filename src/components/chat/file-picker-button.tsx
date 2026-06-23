"use client";

import { useId, useRef } from "react";
import { Paperclip } from "lucide-react";
import type { FileUIPart } from "@/components/chat/use-chat";

// PDF support deferred — deep-research verdict (2026-06-23):
// Sending PDFs as base64 hits our 2MB payload cap immediately (1MB PDF → ~1.37MB base64).
// The correct approach is client-side text extraction via pdf.js, then send as a text block
// (~5-10KB instead of MBs). This is also what ChatGPT/Claude.ai/Gemini do internally.
// AWS Bedrock Converse API does support PDF DocumentBlocks natively (base64 bytes, format='pdf'),
// but requires citations:true for full visual understanding — and still hits the payload limit.
// TODO: uncomment "application/pdf" and implement pdf.js extraction pipeline when ready:
//   1. npm install pdfjs-dist
//   2. Read PDF → extract text pages → send as { type: "text", text: extractedText }
//   3. Increase MAX_FILE_SIZE to 10MB (pdf.js extracts text, no base64 overhead)
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // "application/pdf", // TODO: re-enable after pdf.js text extraction pipeline is implemented
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per file
const MAX_FILES = 3;

/**
 * A visually accessible paperclip button that opens a hidden file input.
 * Reads selected files as base64, validates type and size, then calls
 * `onFiles` with populated `FileUIPart` objects ready for the API payload.
 *
 * Uses `readAsArrayBuffer + btoa` (safer than `readAsDataURL` for large
 * files — avoids the data: prefix stripping step and handles binary data
 * correctly without any substring manipulation).
 */
export function FilePickerButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: FileUIPart[]) => void;
  disabled?: boolean;
}): React.ReactElement | null {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []).slice(0, MAX_FILES);
    // Reset the input so the same file can be re-attached after removal
    if (inputRef.current) inputRef.current.value = "";

    const promises = rawFiles
      .filter((f) => {
        if (!ALLOWED_TYPES.has(f.type)) {
          console.warn(`[FilePickerButton] unsupported type: ${f.type} (${f.name})`);
          return false;
        }
        if (f.size > MAX_FILE_SIZE) {
          console.warn(`[FilePickerButton] file too large: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB > 2MB)`);
          return false;
        }
        return true;
      })
      .map(
        (f) =>
          new Promise<FileUIPart | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const buf = reader.result as ArrayBuffer;
              // Convert ArrayBuffer → Uint8Array → binary string → base64
              const bytes = new Uint8Array(buf);
              let binary = "";
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const data = btoa(binary);
              const previewUrl = URL.createObjectURL(f);
              resolve({
                previewUrl,
                mediaType: f.type as FileUIPart["mediaType"],
                data,
                name: f.name,
                size: f.size,
              });
            };
            reader.onerror = () => {
              console.warn(`[FilePickerButton] failed to read: ${f.name}`);
              resolve(null);
            };
            reader.readAsArrayBuffer(f);
          }),
      );

    Promise.all(promises).then((results) => {
      const valid = results.filter((r): r is FileUIPart => r !== null);
      if (valid.length > 0) onFiles(valid);
    });
  };

  return (
    <>
      <label
        htmlFor={inputId}
        title="Attach image (jpg, png, gif, webp)"
        className={[
          "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border",
          "text-fg-muted transition-colors hover:border-accent hover:text-fg",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-accent",
          disabled ? "pointer-events-none opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Paperclip size={16} aria-hidden="true" />
        <span className="sr-only">Attach image</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          aria-label="Attach image"
        />
      </label>
    </>
  );
}
