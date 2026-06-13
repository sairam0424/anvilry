/**
 * Pure flag-resolution logic, extracted from the React store so it can be unit-tested
 * in the fast node environment. Precedence (highest first):
 *
 *   1. URL query param  (?scroll=custom, ?scrollmode=message-top) — shareable override
 *   2. persisted value  (localStorage, set during the bake-off)
 *   3. default          (the shipped winner)
 *
 * An invalid value at any layer is ignored and the next layer is consulted, so a
 * hand-typed bad param can never wedge the UI into an unknown state.
 */
export function resolveFlag<T extends string>(
  allowed: readonly T[],
  sources: { param?: string | null; stored?: string | null; fallback: T },
): T {
  const isValid = (v: string | null | undefined): v is T =>
    v != null && (allowed as readonly string[]).includes(v);
  if (isValid(sources.param)) return sources.param;
  if (isValid(sources.stored)) return sources.stored;
  return sources.fallback;
}
