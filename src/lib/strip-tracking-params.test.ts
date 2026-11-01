import { describe, expect, it } from "vitest";
import { stripTrackingParams } from "./strip-tracking-params";

describe("stripTrackingParams", () => {
  it("cleans the Substack share link the homepage article list used to carry", () => {
    expect(
      stripTrackingParams(
        "https://open.substack.com/pub/sairam0000/p/i-built-trelix-because-i-was-tired?r=2xzeyx&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true",
      ),
    ).toBe("https://open.substack.com/pub/sairam0000/p/i-built-trelix-because-i-was-tired");
  });

  it.each([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_anything_new",
    "UTM_Source",
    "r",
    "ref",
    "referrer",
    "source",
    "triedRedirect",
    "sd",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "showWelcomeOnShare",
    "msclkid",
    "igshid",
  ])("removes the tracking parameter %s", (name) => {
    expect(stripTrackingParams(`https://example.com/post?${name}=abc`)).toBe("https://example.com/post");
  });

  it("removes a tracking parameter that has no value, and every repeat of one", () => {
    expect(stripTrackingParams("https://example.com/post?ref&r=1&r=2")).toBe("https://example.com/post");
  });

  it("matches a name when it is percent-encoded", () => {
    expect(stripTrackingParams("https://example.com/post?utm%5Fsource=x")).toBe("https://example.com/post");
  });

  it("keeps every other parameter, in its order and exactly as written", () => {
    expect(stripTrackingParams("https://example.com/read?id=7&utm_source=x&q=a%20b+c&page=2&fbclid=z")).toBe(
      "https://example.com/read?id=7&q=a%20b+c&page=2",
    );
  });

  it("keeps the fragment", () => {
    expect(stripTrackingParams("https://example.com/post?r=1#section-2")).toBe("https://example.com/post#section-2");
    expect(stripTrackingParams("https://example.com/post?v=3&r=1#section-2")).toBe("https://example.com/post?v=3#section-2");
  });

  it("does not mistake a longer name for a tracking one", () => {
    for (const name of ["referral", "source_id", "sdk", "rx", "utm", "my_utm_source", "reference"]) {
      const url = `https://example.com/post?${name}=1`;
      expect(stripTrackingParams(url), name).toBe(url);
    }
  });

  it("returns the input exactly as given when there is nothing to strip", () => {
    for (const url of [
      "https://dev.to/sai_ram_0000/how-i-built-inkforge-2132717",
      "https://example.com/post?id=7&q=a%20b+c",
      "https://example.com",
      "https://example.com/post#frag",
    ]) {
      expect(stripTrackingParams(url), url).toBe(url);
    }
  });

  it("returns something that is not an absolute URL untouched instead of throwing", () => {
    for (const input of ["/notes/how-dns-works?r=1", "not a url", ""]) {
      expect(stripTrackingParams(input), input).toBe(input);
    }
  });

  it("is idempotent", () => {
    const once = stripTrackingParams("https://example.com/post?id=1&utm_source=x&r=2#a");
    expect(stripTrackingParams(once)).toBe(once);
  });
});
