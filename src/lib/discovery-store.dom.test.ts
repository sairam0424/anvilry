import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The discovery store keeps module state (the unlocked set, read from localStorage once
 * at import), so each test seeds localStorage and then loads a fresh copy of the module.
 *
 * There are four discovery moments. A fifth, "konami", existed until the Konami code was
 * removed; returning visitors may still have it stored, and it must be ignored without a
 * migration (readStorage filters unknown keys).
 */
const STORAGE_KEY = "anvilry:discoveries";

async function loadStore() {
  vi.resetModules();
  return import("./discovery-store");
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("discovery-store", () => {
  it("has four discovery moments and none of them is konami", async () => {
    const store = await loadStore();
    expect(store.DISCOVERY_TOTAL).toBe(4);
    store.unlockAll();
    expect(store.getDiscoveryCount()).toBe(4);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    ).not.toContain("konami");
  });

  it("ignores a legacy konami unlock from a returning visitor and needs no migration", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["view-switch", "konami"]),
    );
    const store = await loadStore();
    expect(store.getDiscoveryCount()).toBe(1);
    store.unlock("chat-question");
    expect(store.getDiscoveryCount()).toBe(2);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    ).toEqual(["view-switch", "chat-question"]);
  });
});
