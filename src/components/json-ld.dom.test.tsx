import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { profile } from "@/lib/profile";
import {
  OrganizationJsonLd,
  PersonJsonLd,
  SoftwareSourceCodeJsonLd,
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
