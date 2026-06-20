"use client";

import { useEffect, useState } from "react";
import { Star, GitFork, Users, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonStatCard } from "@/components/ui/skeleton";

type GitHubStats = {
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
};

type FetchState = "loading" | "ready" | "empty";

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
  const [fetchState, setFetchState] = useState<FetchState>("loading");

  useEffect(() => {
    fetch("/api/github/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data: GitHubStats | null) => {
        if (data && (data.followers > 0 || data.publicRepos > 0)) {
          setStats(data);
          setFetchState("ready");
        } else {
          setFetchState("empty");
        }
      })
      .catch(() => setFetchState("empty"));
  }, []);

  // Hide entirely when API returned zeros — a strip showing 0/0/— is worse than nothing.
  if (fetchState === "empty") return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <AnimatePresence mode="wait">
        {fetchState === "loading" ? (
          <motion.div
            key="skeleton"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            role="status"
            aria-label="Loading GitHub statistics"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
            <span className="sr-only">Loading GitHub statistics...</span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <Reveal>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={<Users size={16} />} value={stats!.followers.toLocaleString()} label="GitHub followers" />
                <StatCard icon={<BookOpen size={16} />} value={stats!.publicRepos.toLocaleString()} label="public repos" />
                <StatCard icon={<Star size={16} />} value={stats!.totalStars > 0 ? stats!.totalStars.toLocaleString() : "—"} label="stars earned" />
                <StatCard icon={<GitFork size={16} />} value={stats!.totalForks > 0 ? stats!.totalForks.toLocaleString() : "—"} label="forks" />
              </div>
            </Reveal>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
