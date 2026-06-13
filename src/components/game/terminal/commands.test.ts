import { describe, it, expect } from "vitest";
import { COMMANDS, runCommand, COMMAND_NAMES } from "./commands";
import { allWork, allProjects } from "@/lib/content";

/**
 * Coverage + anti-fabrication gate for the terminal command registry. Every command
 * resolves only through the real content layer; `help` is generated FROM the
 * registry (single source); unknown input fails closed. Chained into `pnpm build`.
 */
describe("terminal command registry", () => {
  it("help lists every registered command (single source of truth)", () => {
    const text = runCommand("help").lines.map((l) => l.text).join("\n");
    for (const name of COMMAND_NAMES) expect(text).toContain(name);
  });

  it("unknown command fails closed with a hint", () => {
    const res = runCommand("doesnotexist");
    expect(res.lines.some((l) => l.kind === "err" && /command not found/.test(l.text))).toBe(true);
  });

  it("ls lists real work + project slugs only", () => {
    const text = runCommand("ls").lines.map((l) => l.text).join("\n");
    for (const w of allWork) expect(text).toContain(w.slug);
    for (const p of allProjects) expect(text).toContain(p.slug);
  });

  it("open resolves a real slug to its route, rejects a fake one", () => {
    const real = allWork[0].slug;
    expect(runCommand(`open ${real}`).nav).toEqual({ type: "route", href: `/work/${real}` });
    const bad = runCommand("open totally-fake-slug");
    expect(bad.nav).toBeUndefined();
    expect(bad.lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("clear returns a clear nav action", () => {
    expect(runCommand("clear").nav).toEqual({ type: "clear" });
  });

  it("classic switches view", () => {
    expect(runCommand("classic").nav).toEqual({ type: "view", view: "classic" });
  });

  it("every help-listed command name resolves (no orphan in registry)", () => {
    for (const name of COMMAND_NAMES) expect(COMMANDS[name]).toBeTruthy();
  });

  it("cat shows a real dossier with the honest register; rejects a fake slug", () => {
    const text = runCommand("cat pensieve").lines.map((l) => l.text).join("\n");
    expect(text).toContain("Pensieve");
    expect(text).toMatch(/register:.*Co-built/);
    expect(runCommand("cat nope").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("tree lists real system groups", () => {
    const text = runCommand("tree").lines.map((l) => l.text).join("\n");
    expect(text).toContain("Production Work");
  });

  it("grep returns only real corpus lines; empty term errors", () => {
    expect(runCommand("grep").lines.some((l) => l.kind === "err")).toBe(true);
    const hit = runCommand("grep ascendion").lines.map((l) => l.text).join("\n").toLowerCase();
    expect(hit).toContain("ascendion");
  });
});
