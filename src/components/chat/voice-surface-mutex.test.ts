import { describe, it, expect, vi } from "vitest";
import {
  registerVoiceSurface,
  claimVoiceSurface,
} from "./voice-surface-mutex";

/**
 * The one-mic invariant lives in this arbiter: claiming a surface must close every OTHER
 * registered surface (so two <TalkMode>/mic instances can never be open at once), and
 * must NOT close the claimer itself. Tested in isolation with fake surfaces — the real
 * stores (modal, inline) register their setX(false) closers against it.
 */

describe("voice-surface-mutex", () => {
  it("claiming a surface closes every OTHER surface, not itself", () => {
    const closeModal = vi.fn();
    const closeInline = vi.fn();
    const unregM = registerVoiceSurface("modal", closeModal);
    const unregI = registerVoiceSurface("inline", closeInline);

    // Inline claims the session → the modal must be force-closed; inline must NOT.
    claimVoiceSurface("inline");
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(closeInline).not.toHaveBeenCalled();

    // Modal then claims → inline force-closed; modal not (re-)closed by this claim.
    claimVoiceSurface("modal");
    expect(closeInline).toHaveBeenCalledTimes(1);
    expect(closeModal).toHaveBeenCalledTimes(1); // unchanged — modal didn't close itself

    unregM();
    unregI();
  });

  it("unregister removes a surface from arbitration", () => {
    const closeModal = vi.fn();
    const unreg = registerVoiceSurface("modal", closeModal);
    unreg();
    // With modal unregistered, claiming inline must not try to close it.
    claimVoiceSurface("inline");
    expect(closeModal).not.toHaveBeenCalled();
  });
});
