import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { profile } from "@/lib/profile";
import {
  authorPerson,
  BreadcrumbJsonLd,
  CreativeWorkJsonLd,
  FaqJsonLd,
  JsonLdScript,
  OrganizationJsonLd,
  PersonJsonLd,
  ProfilePageJsonLd,
  SoftwareSourceCodeJsonLd,
  softwareSourceCodeEntity,
  WebSiteJsonLd,
} from "./json-ld";

afterEach(cleanup);

const read = (container: HTMLElement) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");

describe("SoftwareSourceCodeJsonLd", () => {
  const props = { name: "Alpha", description: "d", url: "https://anvilry.vercel.app/projects/alpha", tech: ["Go", "Redis"] };

  it("declares the code repository when there is a public one", () => {
    const { container } = render(<SoftwareSourceCodeJsonLd {...props} codeRepository="https://github.com/o/alpha" />);
    expect(read(container).codeRepository).toBe("https://github.com/o/alpha");
  });

  it("leaves codeRepository out for a private repository instead of advertising a 404", () => {
    const { container } = render(<SoftwareSourceCodeJsonLd {...props} />);
    const data = read(container);
    expect(data["@type"]).toBe("SoftwareSourceCode");
    expect("codeRepository" in data).toBe(false);
  });
});

describe("PersonJsonLd", () => {
  it("describes the person, not just names them", () => {
    const { container } = render(<PersonJsonLd />);
    const data = read(container);
    expect(data["@type"]).toBe("Person");
    expect(typeof data.description).toBe("string");
    expect(data.description).toContain(profile.headline);
    expect(data.description.length).toBeGreaterThan(80);
  });
});

describe("OrganizationJsonLd", () => {
  it("declares a contact point and a postal address from the public profile only", () => {
    const { container } = render(<OrganizationJsonLd />);
    const data = read(container);
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBe("Anvilry");
    expect(data.url).toBe("https://anvilry.vercel.app");
    expect(data.contactPoint).toMatchObject({
      "@type": "ContactPoint",
      contactType: expect.any(String),
      email: profile.email,
      url: "https://anvilry.vercel.app/contact",
    });
    expect(data.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: profile.locationCity,
      addressCountry: profile.locationCountry,
    });
  });

  it("carries a stable @id that the WebSite publisher can point at", () => {
    const org = read(render(<OrganizationJsonLd />).container);
    const site = read(render(<WebSiteJsonLd />).container);
    expect(org["@id"]).toBe("https://anvilry.vercel.app/#organization");
    expect(site.publisher).toEqual({ "@id": org["@id"] });
  });

  it("does not publish the phone number that only the résumé PDF carries", () => {
    const raw = render(<OrganizationJsonLd />).container.innerHTML;
    expect(raw).not.toMatch(/\+91|telephone/i);
  });
});

describe("JsonLdScript", () => {
  it("puts the schema.org context first and keeps the caller's own keys after it", () => {
    const { container } = render(<JsonLdScript data={{ "@type": "Thing", name: "x" }} />);
    expect(Object.keys(read(container))).toEqual(["@context", "@type", "name"]);
    expect(read(container)["@context"]).toBe("https://schema.org");
  });

  it("keeps the closing script tag of its own block the only one, whatever the data says", () => {
    const html = renderToStaticMarkup(<JsonLdScript data={{ "@type": "Thing", name: "</script><b>x</b>" }} />);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});

/**
 * Why these tests read the serialised string and not a parsed document: the HTML parser inside
 * happy-dom does not model the script-data "double escaped" state, so a block containing
 * `<!--<script>` parses fine there while a real browser swallows the closing tag, the rest of the
 * page and every JSON-LD block after it. Only the raw text can show that no such sequence is left.
 */
const SCRIPT_BODY = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

const bodiesOf = (html: string): string[] => [...html.matchAll(SCRIPT_BODY)].map((m) => m[1]);

/** What must never appear raw inside a block: each can end it, open a comment, start a script or split a line. */
const RAW_SEQUENCES = ["</script", "<!--", "<script", "\u2028", "\u2029"];

const HOSTILE_TEXT = [
  "</script>",
  "A <!--<script> B",
  "<!--",
  "<script",
  "-->",
  "]]>",
  "<img src=x onerror=alert(1)>",
  "Fish & chips &amp; <b>bold</b>",
  "line\u2028separator and paragraph\u2029separator",
  "plain text stays plain",
];

describe("JSON-LD serialisation", () => {
  it.each(HOSTILE_TEXT)("leaves no HTML-significant character in the block for %j and parses back to the same data", (text) => {
    const data = { "@type": "Thing", name: text, description: [text, { nested: text }] };
    const html = renderToStaticMarkup(<JsonLdScript data={data} />);
    const [body, ...rest] = bodiesOf(html);

    expect(rest).toHaveLength(0);
    expect(body).not.toMatch(/[<>&\u2028\u2029]/);
    // The sequences that matter, by name: none may survive in the text between the script tags.
    for (const raw of RAW_SEQUENCES) expect(body, JSON.stringify(raw)).not.toContain(raw);
    expect(JSON.parse(body)).toEqual({ "@context": "https://schema.org", ...data });
  });

  it("keeps every block after a hostile one intact: nothing can open a comment or a script that outlives its tag", () => {
    const html = renderToStaticMarkup(
      <>
        <JsonLdScript data={{ "@type": "Thing", name: "A <!--<script> B" }} />
        <JsonLdScript data={{ "@type": "Thing", name: "second" }} />
        <p id="after">after</p>
      </>,
    );
    expect(html).not.toContain("<!--");
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(bodiesOf(html).map((b) => JSON.parse(b).name)).toEqual(["A <!--<script> B", "second"]);
  });

  it("applies to every component of the file, not only to JsonLdScript", () => {
    const hostile = "x </script><!--<script> y\u2028z";
    const html = renderToStaticMarkup(
      <>
        <SoftwareSourceCodeJsonLd name={hostile} description={hostile} url="https://anvilry.vercel.app/p" tech={["Go"]} />
        <BreadcrumbJsonLd items={[{ name: hostile, url: "https://anvilry.vercel.app/" }]} />
        <CreativeWorkJsonLd name={hostile} description={hostile} url="https://anvilry.vercel.app/w" keywords={[hostile]} />
        <PersonJsonLd />
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <FaqJsonLd />
        <ProfilePageJsonLd />
      </>,
    );
    const bodies = bodiesOf(html);
    expect(bodies).toHaveLength(8);
    for (const body of bodies) {
      expect(body).not.toMatch(/[<>&\u2028\u2029]/);
      expect(() => JSON.parse(body)).not.toThrow();
    }
    expect(JSON.parse(bodies[0]).name).toBe(hostile);
    expect(JSON.parse(bodies[1]).itemListElement[0].name).toBe(hostile);
    expect(JSON.parse(bodies[2]).keywords).toBe(hostile);
  });
});

describe("authorPerson", () => {
  it("names the owner and points at the site, as a fresh object each call", () => {
    expect(authorPerson()).toEqual({ "@type": "Person", name: profile.name, url: "https://anvilry.vercel.app" });
    expect(authorPerson()).not.toBe(authorPerson());
  });
});

describe("softwareSourceCodeEntity", () => {
  it("is the entity SoftwareSourceCodeJsonLd renders, without the @context", () => {
    const props = { name: "Alpha", description: "d", url: "https://anvilry.vercel.app/projects/alpha", tech: ["Go", "Redis"] };
    const { container } = render(<SoftwareSourceCodeJsonLd {...props} codeRepository="https://github.com/o/alpha" />);
    const { "@context": context, ...rendered } = read(container);
    expect(context).toBe("https://schema.org");
    expect(rendered).toEqual(softwareSourceCodeEntity({ ...props, codeRepository: "https://github.com/o/alpha" }));
    expect(rendered.programmingLanguage).toEqual(["Go"]);
    expect(rendered.keywords).toBe("Go, Redis");
  });
});
