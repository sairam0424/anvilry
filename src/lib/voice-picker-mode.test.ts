import { describe, expect, it } from "vitest";
import { getVoicePickerMode, VOICE_PICKER_MODE } from "./voice-picker-mode";

/**
 * The picker-mode flag is read once at module load (NEXT_PUBLIC_ inlining), so
 * this is a one-shot smoke test: in vitest the env var is unset by default →
 * descriptor mode is the resolved default. The "gender" branch is exercised by
 * the picker UI's dom tests where the flag value is mocked at the import site.
 */

describe("voice-picker-mode default", () => {
  it("defaults to descriptor when NEXT_PUBLIC_VOICE_PICKER_MODE is unset", () => {
    expect(getVoicePickerMode()).toBe("descriptor");
    expect(VOICE_PICKER_MODE).toBe("descriptor");
  });

  it("getVoicePickerMode and VOICE_PICKER_MODE always agree", () => {
    expect(getVoicePickerMode()).toBe(VOICE_PICKER_MODE);
  });
});
