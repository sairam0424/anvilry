import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { FeaturedWork } from "@/components/home/featured-work";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { Achievements } from "@/components/home/achievements";
import { Testimonials } from "@/components/home/testimonials";
import { Contact } from "@/components/home/contact";
import { ViewRouter } from "@/components/view-router";

// Explicit query-stripped canonical (resolved absolute via layout's metadataBase).
// `/` is the only route that carries ?view=, and a literal self-canonical would
// canonicalize each ?view= variant to itself — so pin it to the bare path to
// collapse /?view=gamified and /?view=chat back to the bare site URL.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // The Classic <main> is the SSG/SSR default — rendered on the server and passed
  // to ViewRouter as the always-present baseline. ViewRouter swaps in the Chat /
  // Gamified client views only when the visitor toggles, without a navigation.
  return (
    <ViewRouter>
      <main className="flex-1">
        <Hero />
        <FeaturedWork />
        <FeaturedProjects />
        <Achievements />
        <Testimonials />
        <Contact />
      </main>
    </ViewRouter>
  );
}
