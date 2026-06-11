import { Hero } from "@/components/home/hero";
import { FeaturedWork } from "@/components/home/featured-work";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { Achievements } from "@/components/home/achievements";
import { Contact } from "@/components/home/contact";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <FeaturedWork />
      <FeaturedProjects />
      <Achievements />
      <Contact />
    </main>
  );
}
