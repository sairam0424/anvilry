import { MAX_PRETTY_CHARS, MAX_PRETTY_NESTING } from "./constants.mjs";
import { escapeJsonOutput } from "./escape.mjs";

const BYTES_PER_MIB = 1024 * 1024;
/** Characters one value adds besides its indentation and text: quotes, colon, comma, newline, a short scalar. */
const PER_VALUE_OVERHEAD = 8;

/**
 * Walks a parsed JSON value without recursion (so no depth can overflow the stack) and returns how
 * deep its containers nest and roughly how many characters pretty-printing it would take. The
 * walk stops as soon as either limit is passed, so a hostile body costs little to refuse.
 *
 * @param {unknown} root
 * @returns {{ nesting: number, chars: number }}
 */
function measure(root) {
  const pending = [root];
  const depths = [0];
  let nesting = 0;
  let chars = 0;
  while (pending.length > 0 && nesting <= MAX_PRETTY_NESTING && chars <= MAX_PRETTY_CHARS) {
    const node = pending.pop();
    const depth = /** @type {number} */ (depths.pop());
    chars += 2 * depth + PER_VALUE_OVERHEAD;
    if (typeof node === "string") {
      chars += node.length;
    } else if (typeof node === "object" && node !== null) {
      nesting = Math.max(nesting, depth + 1);
      const entries = Array.isArray(node) ? node.entries() : Object.entries(node);
      for (const [key, child] of entries) {
        if (typeof key === "string") chars += key.length;
        pending.push(child);
        depths.push(depth + 1);
      }
    }
  }
  return { nesting, chars };
}

/**
 * The default output of the CLI: the value as JSON with two-space indentation, with control and
 * format characters escaped. Anything that cannot be printed safely is reported as a reason, never
 * thrown: too deep, too big once indented, or a stack or string overflow.
 *
 * @param {unknown} value  A value produced by JSON.parse.
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function prettyJson(value) {
  const { nesting, chars } = measure(value);
  if (nesting > MAX_PRETTY_NESTING) {
    return { ok: false, reason: `nested more than ${MAX_PRETTY_NESTING} levels deep` };
  }
  if (chars > MAX_PRETTY_CHARS) {
    return {
      ok: false,
      reason: `its indented form would be larger than ${MAX_PRETTY_CHARS / BYTES_PER_MIB} MiB`,
    };
  }
  try {
    return { ok: true, text: escapeJsonOutput(JSON.stringify(value, null, 2)) };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, reason: "it is too large or too deeply nested to format" };
    }
    throw error;
  }
}
