import { Hero } from "@/components/home/hero";
import { FeaturedWork } from "@/components/home/featured-work";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { Achievements } from "@/components/home/achievements";
import { Contact } from "@/components/home/contact";
import { ViewRouter } from "@/components/view-router";

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
        <Contact />
      </main>
    </ViewRouter>
  );
}
