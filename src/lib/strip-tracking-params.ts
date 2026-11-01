/**
 * Tracking and referral parameters: they say where a visitor came from or which share button they
 * used, never which page they get. Names are compared lower-case and whole, so `referral`,
 * `source_id` and `sdk` are other parameters and stay.
 */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  "r",
  "ref",
  "referrer",
  "ref_src",
  "source",
  "triedredirect",
  "sd",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "twclid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "_hsenc",
  "_hsmi",
  // Substack's share dialog: the page behind it is the same with or without it.
  "showwelcomeonshare",
]);

const TRACKING_PREFIX = "utm_";

function decodedName(segment: string): string {
  const name = segment.split("=", 1)[0];
  try {
    return decodeURIComponent(name).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
}

const isTracking = (segment: string): boolean => {
  const name = decodedName(segment);
  return name.startsWith(TRACKING_PREFIX) || TRACKING_PARAMS.has(name);
};

/**
 * The same address without its tracking parameters, for use as the identity of a page in structured
 * data: one article must have one URL, not one per share button. Parameters that are not tracking
 * are kept in their order and exactly as written, and so is the fragment. An input that is not an
 * absolute URL, or that has nothing to strip, is returned exactly as given. A visible link is not
 * to be passed through this: what a visitor clicks stays as the author wrote it.
 */
export function stripTrackingParams(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  const segments = url.search.slice(1).split("&").filter((segment) => segment !== "");
  const kept = segments.filter((segment) => !isTracking(segment));
  if (kept.length === segments.length) return input;

  url.search = kept.join("&");
  return url.toString();
}
