import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Hydration-safe "has the client mounted yet?" flag, without setState-in-effect.
 * Server snapshot = false, client snapshot = true — so SSR/first paint renders the
 * static path and the client upgrades after hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client
    () => false, // server
  );
}
