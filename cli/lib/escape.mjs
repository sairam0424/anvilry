/**
 * Terminal safety for text that came from a server. --base-url can point anywhere, and a terminal
 * obeys escape sequences (including the single-character C1 controls such as U+009B) and lets
 * bidirectional and zero-width format characters (U+202E, U+200B, U+2066...) reorder or hide what
 * it shows. Every such character is written out as a \uXXXX escape instead, so the output stays
 * readable and nothing in it can act on the terminal.
 *
 * --raw is the one deliberate exception: it hands over the received bytes untouched.
 */

/** Control characters (C0, DEL, C1) and format characters (bidi, zero width, tag characters). */
const UNSAFE_IN_TEXT = /[\p{Cc}\p{Cf}]/gu;

/**
 * What JSON.stringify leaves unescaped inside a string: DEL, the C1 controls and the format
 * characters. It already escapes C0 (U+0000 to U+001F), and the newlines left in pretty-printed
 * output are its own indentation, so C0 is not touched here and the result is still valid JSON.
 */
const UNSAFE_IN_JSON = /[\u007f-\u009f\p{Cf}]/gu;

/** @param {string} character one code point */
function escapeCharacter(character) {
  const codePoint = /** @type {number} */ (character.codePointAt(0));
  if (codePoint <= 0xffff) return unicodeEscape(codePoint);
  // Outside the BMP a JSON escape is a surrogate pair.
  const offset = codePoint - 0x10000;
  return (
    unicodeEscape(0xd800 + (offset >> 10)) +
    unicodeEscape(0xdc00 + (offset & 0x3ff))
  );
}

/** @param {number} unit */
const unicodeEscape = (unit) => `\\u${unit.toString(16).padStart(4, "0")}`;

/**
 * For anything printed to stderr: an error message, a hint, a header value, a Location.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeForTerminal(text) {
  return text.replace(UNSAFE_IN_TEXT, escapeCharacter);
}

/**
 * For the default (pretty-printed) JSON on stdout.
 *
 * @param {string} json  The output of JSON.stringify.
 * @returns {string} The same JSON text, which parses to the same value.
 */
export function escapeJsonOutput(json) {
  return json.replace(UNSAFE_IN_JSON, escapeCharacter);
}
