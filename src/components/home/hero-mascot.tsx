import { SiteMascot } from "@/components/mascot/site-mascot";

/**
 * Glow backdrop for `NEXT_PUBLIC_HERO_MODE=mascot` — the same two blurs the WebGL slots fall
 * back to, so switching hero modes never shifts layout or changes the hero's ambient colour.
 */
export function HeroMascotBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
    </div>
  );
}

/**
 * The hero head (src/lib/mascots.ts `gearbot`). Below `lg` it sits in flow above the name
 * eyebrow at 7rem, left-aligned like the page-mascot demo; from `lg` it leaves the flow for the
 * right gutter beside the headline at 12rem — the copy is max-w-3xl inside a max-w-5xl
 * container, which leaves 13rem free there. One instance, sized through `--mascot-size`, so the
 * accessibility tree never carries a hidden duplicate. The wrapper owns the positioning: the
 * button's own `position` is an inline style. Rides the same `hero-rise` entrance as the copy.
 */
export function HeroMascot() {
  return (
    <div className="hero-rise mb-6 [--mascot-size:7rem] lg:absolute lg:right-6 lg:top-24 lg:mb-0 lg:[--mascot-size:12rem]">
      <SiteMascot character="gearbot" size="var(--mascot-size)" priority />
    </div>
  );
}
