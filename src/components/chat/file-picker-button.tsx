"use client";

import { useId, useRef } from "react";
import { Paperclip } from "lucide-react";
import type { FileUIPart } from "@/components/chat/use-chat";

const PDF_ENABLED = process.env.NEXT_PUBLIC_PDF_ATTACHMENTS === "true";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// PDF support via client-side text extraction (pdfjs-dist).
// Base64 PDF encoding is NOT used — text extraction avoids the ~33% size overhead
// that would push even a 1MB PDF past the 2MB payload limit.
const ALLOWED_TYPES = PDF_ENABLED
  ? new Set([...ALLOWED_IMAGE_TYPES, "application/pdf"])
  : ALLOWED_IMAGE_TYPES;

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_PDF_SIZE = 10 * 1024 * 1024;  // 10MB — text extraction, no base64 overhead
const MAX_FILES = 3;

/**
 * A visually accessible paperclip button that opens a hidden file input.
 * Reads selected files as base64 (images) or extracts text via pdf.js (PDFs),
 * validates type and size, then calls `onFiles` with populated `FileUIPart`
 * objects ready for the API payload.
 *
 * Uses `readAsArrayBuffer + btoa` for images (safer than `readAsDataURL` —
 * avoids the data: prefix stripping step and handles binary data correctly).
 * PDFs use `readAsArrayBuffer + pdfjs-dist` to extract text pages — no base64,
 * ~5-10KB of text vs MB-scale base64 overhead.
 *
 * PDF support is feature-flagged via NEXT_PUBLIC_PDF_ATTACHMENTS=true.
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
        const limit = f.type === "application/pdf" ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
        if (f.size > limit) {
          console.warn(`[FilePickerButton] file too large: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB > ${f.type === "application/pdf" ? "10MB" : "2MB"})`);
          return false;
        }
        return true;
      })
      .map(
        (f): Promise<FileUIPart | null> => {
          // For PDF files: extract text via pdf.js, no base64
          if (f.type === "application/pdf") {
            return new Promise<FileUIPart | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = async () => {
                try {
                  // Dynamic import so pdf.js worker doesn't bloat the main bundle
                  const pdfjsLib = await import("pdfjs-dist");
                  // Point worker to the pdfjs-dist package worker file
                  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    "pdfjs-dist/build/pdf.worker.min.mjs",
                    import.meta.url,
                  ).toString();
                  const typedArray = new Uint8Array(reader.result as ArrayBuffer);
                  const doc = await pdfjsLib.getDocument({ data: typedArray }).promise;
                  const pages: string[] = [];
                  for (let p = 1; p <= doc.numPages; p++) {
                    const page = await doc.getPage(p);
                    const content = await page.getTextContent();
                    pages.push(
                      content.items
                        .map((item) => ("str" in item ? (item.str as string) : ""))
                        .join(" "),
                    );
                  }
                  const pdfText = pages.join("\n\n").trim();
                  resolve({
                    previewUrl: "",  // no visual preview for PDFs
                    mediaType: "application/pdf",
                    data: "",        // no base64 — text extraction only
                    name: f.name,
                    size: f.size,
                    pdfText,
                  });
                } catch (err) {
                  console.warn("[FilePickerButton] PDF extraction failed:", err);
                  resolve(null);
                }
              };
              reader.onerror = () => resolve(null);
              reader.readAsArrayBuffer(f);
            });
          }

          // For image files: read as base64
          return new Promise<FileUIPart | null>((resolve) => {
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
          });
        },
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
        title={PDF_ENABLED ? "Attach image or PDF" : "Attach image"}
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
        <span className="sr-only">{PDF_ENABLED ? "Attach image or PDF" : "Attach image"}</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={PDF_ENABLED ? "image/jpeg,image/png,image/gif,image/webp,application/pdf" : "image/jpeg,image/png,image/gif,image/webp"}
          multiple
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          aria-label={PDF_ENABLED ? "Attach image or PDF" : "Attach image"}
        />
      </label>
    </>
  );
}
