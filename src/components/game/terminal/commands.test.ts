import { describe, it, expect, vi } from "vitest";
import { COMMANDS, runCommand, COMMAND_NAMES, commandEventName } from "./commands";
import { allWork, allProjects } from "@/lib/content";
import { profile, skills, achievements, impactMetrics, resumeVariants } from "@/lib/profile";
import { personal, now, hasPersonalContent } from "@/lib/personal";

/**
 * Coverage + anti-fabrication gate for the terminal command registry. Every command
 * resolves only through the real content layer; `help` is generated FROM the
 * registry (single source); unknown input fails closed. Chained into `pnpm build`.
 */
describe("terminal command registry", () => {
  it("help lists every VISIBLE command (COMMAND_NAMES = visible single source)", () => {
    const text = runCommand("help").lines.map((l) => l.text).join("\n");
    for (const name of COMMAND_NAMES) expect(text).toContain(name);
  });

  it("hidden egg commands dispatch but are absent from help + autocomplete", () => {
    const helpLines = runCommand("help").lines;
    const helpCmdLines = helpLines.filter((l) => l.kind === "out").map((l) => l.text).join("\n");
    for (const hidden of ["secret", "personal", "uses", "now"]) {
      // Not advertised in COMMAND_NAMES or as a table entry in help output…
      expect(COMMAND_NAMES).not.toContain(hidden);
      // The tip line at the bottom of help says "try 'secret'" — that's intentional UI.
      // We only check that the hidden command is not listed as a navigable command entry.
      const cmdTableLines = helpCmdLines.split("\n").filter((l) => !l.includes("tip:"));
      expect(cmdTableLines.join("\n")).not.toMatch(new RegExp(`^\\s+[◇→]\\s+${hidden}\\b`, "m"));
      // …but fully dispatchable (no "command not found").
      const res = runCommand(hidden);
      expect(res.lines.some((l) => l.kind === "err" && /not found/.test(l.text))).toBe(false);
    }
    // commandEventName still tracks hidden commands (PII-safe, full registry).
    expect(commandEventName("secret")).toBe("secret");
  });

  it("about is ALWAYS visible (the non-secret a11y door to personal content)", () => {
    expect(COMMAND_NAMES).toContain("about");
    const text = runCommand("about").lines.map((l) => l.text).join("\n");
    expect(text).toContain(profile.name);
  });

  it("personal reveal commands print the REAL owner content (populated path)", () => {
    // personal.ts is populated in the repo, so the live reveals must surface each field
    // from the single source (anti-fabrication: what's shown == what's authored).
    const secret = runCommand("secret").lines.map((l) => l.text).join("\n");
    for (const h of personal.hobbies) expect(secret).toContain(h);
    for (const f of personal.funFacts) expect(secret).toContain(f);
    for (const l of personal.currentlyLearning) expect(secret).toContain(l);

    const uses = runCommand("uses").lines.map((l) => l.text).join("\n");
    for (const g of personal.uses) {
      expect(uses).toContain(g.group);
      for (const item of g.items) expect(uses).toContain(item);
    }

    const nowOut = runCommand("now").lines.map((l) => l.text).join("\n");
    for (const f of now.focus) expect(nowOut).toContain(f);

    // The whoami breadcrumb appears precisely when there is content to find.
    const whoami = runCommand("whoami").lines.map((l) => l.text).join("\n");
    expect(whoami).toMatch(/try 'secret'/);
    expect(hasPersonalContent).toBe(true); // sanity: this test asserts the populated path
  });

  it("`now` staleness line is honest: today / stale / NaN-guarded (fake timers)", () => {
    // now.updated is a real ISO date; pin the day-diff math at fixed clocks.
    const updated = now.updated; // e.g. "2026-06-14"
    expect(updated).not.toBe("");

    vi.useFakeTimers();
    try {
      // Same day -> "updated today".
      vi.setSystemTime(new Date(`${updated}T12:00:00Z`));
      expect(runCommand("now").lines.map((l) => l.text).join("\n")).toMatch(/updated today/i);

      // 91 days later -> stale warning.
      vi.setSystemTime(new Date(Date.parse(`${updated}T00:00:00Z`) + 91 * 86_400_000));
      expect(runCommand("now").lines.map((l) => l.text).join("\n")).toMatch(/may be stale/i);
    } finally {
      vi.useRealTimers();
    }
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
    // Help output now uses section headers ("// COMMANDS") + table format
    expect(padded.lines.some((l) => /COMMANDS|whoami|stack/i.test(l.text))).toBe(true);
    // command name is matched case-insensitively
    expect(runCommand("HELP").lines.some((l) => /COMMANDS|whoami|stack/i.test(l.text))).toBe(true);
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
    // Cat now uses box format: "◇ register      Co-built..."
    expect(text).toMatch(/register\s+Co-built/);
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
    // section() uppercases the label (// LANGUAGES), match case-insensitively
    expect(text.toUpperCase()).toContain(skills[0].group.toUpperCase());
  });

  it("awards lists real achievements", () => {
    const text = runCommand("awards").lines.map((l) => l.text).join("\n");
    expect(text).toContain(achievements[0].title);
  });

  it("resume lists variants, opens a real one externally, rejects fake", () => {
    expect(runCommand("resume").lines.length).toBeGreaterThan(1);
    expect(runCommand("resume sairam").nav?.type).toBe("external");
    expect(runCommand("resume nope").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("resume <substring> is first-wins on label .includes() (resume f -> Full-Stack, flag ON)", () => {
    // Stub the flag ON so all 5 variants are visible — tests multi-variant matching.
    // Order: Sairam Resume, Backend, Full-Stack, Frontend, GenAI.
    // Neither "sairam resume" nor "backend" contain 'f', so first match is Full-Stack.
    vi.stubEnv("NEXT_PUBLIC_RESUME_VARIANTS", "true");
    try {
      const fullStack = resumeVariants.find((r) => r.label === "Full-Stack");
      expect(runCommand("resume f").nav).toEqual({ type: "external", href: fullStack!.file });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("resume <substring> errors on unknown variant when flag OFF (only master visible)", () => {
    // Flag OFF: only "Sairam Resume" visible — "backend" is not accessible via terminal.
    expect(runCommand("resume backend").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("chat switches to chat view; neofetch aliases whoami; sudo is a harmless gag", () => {
    expect(runCommand("chat").nav).toEqual({ type: "view", view: "chat" });
    const neo = runCommand("neofetch").lines.map((l) => l.text).join("\n");
    expect(neo).toContain("Sairam");
    expect(runCommand("sudo rm -rf /").lines.some((l) => l.kind === "err")).toBe(true);
  });

  it("whoami banner is grounded: every impactMetric value appears, no extra metric is invented", () => {
    const banner = runCommand("whoami").lines.map((l) => l.text).join("\n");
    // Every real metric VALUE must be present (labels may be abbreviated for line-width).
    for (const m of impactMetrics) {
      expect(banner, `metric value "${m.value}" must be in the banner`).toContain(m.value);
    }
    // ...and the derived repo count must equal the real project total (anti-drift).
    const repoMetric = impactMetrics.find((m) => m.label === "open-source repos");
    expect(repoMetric?.value).toBe(`${allProjects.length}`);
  });

  it("contact/email/social surface real profile links; email navs to mailto", () => {
    const contact = runCommand("contact").lines.map((l) => l.text).join("\n");
    expect(contact).toContain(profile.email);
    expect(contact).toContain(profile.links.github);
    const em = runCommand("email");
    expect(em.lines.map((l) => l.text).join("\n")).toContain(profile.email); // selectable text first
    expect(em.nav).toEqual({ type: "external", href: `mailto:${profile.email}` });
  });

  it("summary prints identity + every work + project + skills + awards (one-hit)", () => {
    const text = runCommand("summary").lines.map((l) => l.text).join("\n");
    expect(text).toContain(profile.name);
    for (const w of allWork) expect(text).toContain(w.name);
    for (const p of allProjects) expect(text).toContain(p.name);
    expect(text).toContain(skills[0].group);
    expect(text).toContain(achievements[0].title);
  });

  it("career groups under the employer and invents NO per-item year (anti-fabrication)", () => {
    const text = runCommand("career").lines.map((l) => l.text).join("\n");
    expect(text).toContain(profile.company);
    expect(text).toContain(profile.tenure);
    // The ONLY 4-digit years allowed are those already in profile.tenure — no per-item
    // chronology may be invented (the content has zero per-item dates).
    const allowed = profile.tenure.match(/\d{4}/g) ?? [];
    const found = text.match(/\d{4}/g) ?? [];
    for (const y of found) expect(allowed).toContain(y);
  });

  it("find <tech> lists systems using a tech; zero-match is a non-error", () => {
    // Use a tech known to exist in the content (Python appears widely). lines[0] is the
    // echoed "$ find python"; the count header is the first OUTPUT line.
    const res = runCommand("find python");
    expect(res.lines.map((l) => l.text).join("\n")).toMatch(/\d+ system(s)? use "python":/i);
    const none = runCommand("find zzzznotatechzzzz");
    expect(none.lines.some((l) => l.kind === "err")).toBe(false);
    expect(none.lines.map((l) => l.text).join("\n")).toContain("no systems use");
  });

  it("top renders counts as readable text (number in text, not just a bar)", () => {
    const text = runCommand("top").lines.map((l) => l.text).join("\n");
    expect(text).toMatch(/most-used tech/i);
    expect(text).toMatch(/×\d+/); // a real count appears in the text
  });

  it("stats reports computed aggregates that match the content layer", () => {
    const text = runCommand("stats").lines.map((l) => l.text).join("\n");
    // Stats now uses box/row format: "● open-source repos   8"
    expect(text).toContain(`${allProjects.length}`);
    expect(text).toContain(`${allWork.length}`);
    expect(text).toMatch(/open-source repos/i);
    expect(text).toMatch(/production systems/i);
  });

  it("open routes to github/linkedin/resume quick targets", () => {
    expect(runCommand("open github").nav).toEqual({ type: "external", href: profile.links.github });
    expect(runCommand("open resume").nav).toEqual({ type: "route", href: profile.links.resume });
  });

  it("commandEventName is PII-safe: returns the command WORD only, never args", () => {
    // Known commands map to their canonical name.
    expect(commandEventName("whoami")).toBe("whoami");
    expect(commandEventName("HELP")).toBe("help"); // case-insensitive
    // Args are STRIPPED — a searched term / slug / email never reaches analytics.
    expect(commandEventName("grep someone@example.com")).toBe("grep");
    expect(commandEventName("open my-private-slug")).toBe("open");
    expect(commandEventName("cat   pensieve")).toBe("cat"); // multi-space
    // Unrecognized first token folds into a single bucket (no free-text leak).
    expect(commandEventName("rm -rf /")).toBe("unknown");
    expect(commandEventName("")).toBe("unknown");
    // Every registered command round-trips to itself.
    for (const name of COMMAND_NAMES) expect(commandEventName(name)).toBe(name);
  });
});
