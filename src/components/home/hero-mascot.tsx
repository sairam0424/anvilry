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
 * eyebrow at 9rem, left-aligned like the page-mascot demo. From `lg` it leaves the flow for the
 * right gutter beside the headline: the copy is max-w-3xl inside a max-w-5xl container, which
 * leaves exactly 13rem there, so 13rem at `lg` (the viewport IS the container, nothing may
 * spill). From `xl` the container is centred with ≥ 8rem of page margin either side, so the head
 * grows to 15rem by extending 1.5rem INTO that margin (`-right-6`) — its left edge stays on the
 * same gutter line and never crosses the headline box (sized against the 4-line, 264 px h1 at
 * 1440; 12rem read small, 16rem started to dominate). One instance, sized through
 * `--mascot-size`, so the accessibility tree never carries a hidden duplicate. The wrapper owns
 * the positioning: the button's own `position` is an inline style. Rides the same `hero-rise`
 * entrance as the copy.
 */
export function HeroMascot() {
  return (
    <div className="hero-rise mb-6 [--mascot-size:9rem] lg:absolute lg:right-6 lg:top-24 lg:mb-0 lg:[--mascot-size:13rem] xl:-right-6 xl:top-20 xl:[--mascot-size:15rem]">
      <SiteMascot character="gearbot" size="var(--mascot-size)" priority />
    </div>
  );
}
