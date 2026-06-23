"use client";

import { useId, useRef } from "react";
import { Paperclip } from "lucide-react";
import type { FileUIPart } from "@/components/chat/use-chat";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
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
        title="Attach image or PDF"
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
        <span className="sr-only">Attach image or PDF</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          multiple
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          aria-label="Attach image or PDF"
        />
      </label>
    </>
  );
}
