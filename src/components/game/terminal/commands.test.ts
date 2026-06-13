import { describe, it, expect } from "vitest";
import { COMMANDS, runCommand, COMMAND_NAMES } from "./commands";
import { allWork, allProjects } from "@/lib/content";
import { skills, achievements, impactMetrics } from "@/lib/profile";

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

  it("normalizes input: trims, collapses inner whitespace, is case-insensitive on the name", () => {
    // empty / whitespace-only -> no output, no error
    expect(runCommand("   ").lines).toEqual([]);
    expect(runCommand("").lines).toEqual([]);
    // leading/trailing space is trimmed before dispatch (HELP resolves; echo is trimmed)
    const padded = runCommand("   help   ");
    expect(padded.lines[0]).toEqual({ kind: "in", text: "$ help" });
    expect(padded.lines.some((l) => /Available commands/.test(l.text))).toBe(true);
    // command name is matched case-insensitively
    expect(runCommand("HELP").lines.some((l) => /Available commands/.test(l.text))).toBe(true);
    // multi-space between name and args still parses the args (open <slug>)
    const real = allWork[0].slug;
    expect(runCommand(`open    ${real}`).nav).toEqual({ type: "route", href: `/work/${real}` });
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

  it("every slug `ls` lists is also `cat`-able (cat resolves via the graph chain, ls via content — pin the contract)", () => {
    for (const item of [...allWork, ...allProjects]) {
      const res = runCommand(`cat ${item.slug}`);
      const failed = res.lines.some((l) => l.kind === "err");
      expect(failed, `cat ${item.slug} should resolve (ls lists it)`).toBe(false);
    }
  });

  it("tree lists real system groups", () => {
    const text = runCommand("tree").lines.map((l) => l.text).join("\n");
    expect(text).toContain("Production Work");
  });

  it("grep: empty term errors; a real hit leads with a count header; zero-match is a non-error", () => {
    expect(runCommand("grep").lines.some((l) => l.kind === "err")).toBe(true);
    const res = runCommand("grep ascendion");
    const text = res.lines.map((l) => l.text).join("\n").toLowerCase();
    expect(text).toContain("ascendion");
    expect(res.lines[1]?.text).toMatch(/^\d+ match(es)? for "ascendion":/); // [0]=echo, [1]=header
    // A valid term with no matches is informational (out), not an error.
    const none = runCommand("grep zzzznotarealtermzzzz");
    expect(none.lines.some((l) => l.kind === "err")).toBe(false);
    expect(none.lines.map((l) => l.text).join("\n")).toContain("no matches");
  });

  it("stack lists real skill groups", () => {
    const text = runCommand("stack").lines.map((l) => l.text).join("\n");
    expect(text).toContain(skills[0].group);
  });

  it("awards lists real achievements", () => {
    const text = runCommand("awards").lines.map((l) => l.text).join("\n");
    expect(text).toContain(achievements[0].title);
  });

  it("resume lists variants, opens a real one externally, rejects fake", () => {
    expect(runCommand("resume").lines.length).toBeGreaterThan(1);
    expect(runCommand("resume master").nav?.type).toBe("external");
    expect(runCommand("resume nope").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("chat switches to chat view; neofetch aliases whoami; sudo is a harmless gag", () => {
    expect(runCommand("chat").nav).toEqual({ type: "view", view: "chat" });
    const neo = runCommand("neofetch").lines.map((l) => l.text).join("\n");
    expect(neo).toContain("Sairam");
    expect(runCommand("sudo rm -rf /").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("whoami banner is grounded: every impactMetric value/label appears, no extra metric is invented", () => {
    const banner = runCommand("whoami").lines.map((l) => l.text).join("\n");
    // Every real metric must be present...
    for (const m of impactMetrics) {
      expect(banner, `metric "${m.value} ${m.label}" must be in the banner`).toContain(m.value);
      expect(banner).toContain(m.label);
    }
    // ...and the derived repo count must equal the real project total (anti-drift).
    const repoMetric = impactMetrics.find((m) => m.label === "open-source repos");
    expect(repoMetric?.value).toBe(`${allProjects.length}`);
  });
});
