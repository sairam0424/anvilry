"use client";

import { useEffect, useState } from "react";
import { Star, GitFork, Users, BookOpen } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

type GitHubStats = {
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
};

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card-surface flex items-center gap-3 px-4 py-3">
      <span className="text-accent">{icon}</span>
      <div>
        <p className="font-mono text-sm font-semibold text-fg">{value}</p>
        <p className="font-mono text-[11px] text-fg-subtle">{label}</p>
      </div>
    </div>
  );
}

export function GithubStatsStrip() {
  const [stats, setStats] = useState<GitHubStats | null>(null);

  useEffect(() => {
    fetch("/api/github/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  // Hide entirely when GitHub API returned zeros (no token, rate-limited in dev).
  // A strip showing 0/0/— is worse than no strip.
  if (!stats || (stats.followers === 0 && stats.publicRepos === 0)) return null;

  return (
    <Reveal>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users size={16} />} value={stats.followers.toLocaleString()} label="GitHub followers" />
        <StatCard icon={<BookOpen size={16} />} value={stats.publicRepos.toLocaleString()} label="public repos" />
        <StatCard icon={<Star size={16} />} value={stats.totalStars > 0 ? stats.totalStars.toLocaleString() : "—"} label="stars earned" />
        <StatCard icon={<GitFork size={16} />} value={stats.totalForks > 0 ? stats.totalForks.toLocaleString() : "—"} label="forks" />
      </div>
    </Reveal>
  );
}
