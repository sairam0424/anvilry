"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { profile } from "@/lib/profile";

/**
 * Live GitHub stats via github-readme-stats (hostnames whitelisted in next.config).
 * Each card hides itself on error so a rate-limited third-party service never shows
 * an ugly "Something went wrong" card to a recruiter. Plain <img> (not next/image)
 * because these are externally-rendered, frequently-updated SVGs.
 */
const theme =
  "&theme=transparent&hide_border=true&title_color=38e1ff&icon_color=a78bfa&text_color=9aa3b8&bg_color=00000000";

function StatCard({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setOk(false)}
      className="w-full rounded-xl border border-border bg-bg-surface p-2"
    />
  );
}

export function GithubStats() {
  const u = profile.githubUser;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        src={`https://github-readme-stats.vercel.app/api?username=${u}&show_icons=true&count_private=true&include_all_commits=true${theme}`}
        alt={`${profile.name} GitHub stats`}
      />
      <StatCard
        src={`https://github-readme-stats.vercel.app/api/top-langs/?username=${u}&layout=compact&count_private=true${theme}`}
        alt="Top languages"
      />
    </div>
  );
}
