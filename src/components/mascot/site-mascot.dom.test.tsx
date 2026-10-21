import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SiteMascot } from "./site-mascot";

afterEach(() => {
  cleanup();
  document.head.querySelectorAll("link[rel='preload']").forEach((l) => l.remove());
});

describe("SiteMascot", () => {
  it("renders a registered character as a labelled mascot button", () => {
    render(<SiteMascot character="crt" size={120} label="CRT monitor" />);
    const button = screen.getByRole("button", { name: "Boop the CRT monitor" });
    const layer = button.querySelector<HTMLSpanElement>("span > span");
    expect(layer?.style.backgroundImage).toMatch(/crt-directions.*\.webp/);
    expect(button.style.width).toBe("120px");
  });

  it("defaults to the label 'mascot'", () => {
    render(<SiteMascot character="gearbot" />);
    expect(screen.getByRole("button", { name: "Boop the mascot" })).toBeTruthy();
  });

  it("preloads the directions sheet only when marked priority", () => {
    render(<SiteMascot character="gearbot" />);
    expect(document.head.querySelector("link[rel='preload'][as='image']")).toBeNull();
    cleanup();
    render(<SiteMascot character="gearbot" priority />);
    const link = document.head.querySelector<HTMLLinkElement>("link[rel='preload'][as='image']");
    expect(link?.getAttribute("href")).toMatch(/gearbot-directions.*\.webp/);
  });
});
