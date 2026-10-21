/**
 * Static image imports (`import sheet from "@/assets/mascots/x.webp"`) are typed by Next's
 * `next/image-types/global` declarations, which `next-env.d.ts` normally references — but that
 * file is generated and git-ignored, and CI's Type-check step runs before any build exists.
 * Referencing the same declaration file here makes the import types available to a bare `tsc`;
 * when `next-env.d.ts` is present too, TypeScript de-duplicates the shared reference.
 */
/// <reference types="next/image-types/global" />
