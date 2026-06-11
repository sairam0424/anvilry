/**
 * Static profile data — single source of truth for identity, headline, skills,
 * achievements, and links. Mirrors the locked résumé / LinkedIn / GitHub / Naukri pack.
 * Every value is real and defensible; honest "Co-built" register preserved.
 */

export const profile = {
  name: "Sairam Ugge",
  role: "GenAI & Backend Engineer",
  company: "Ascendion",
  tenure: "Jun 2024 – Present",
  location: "Hyderabad, India",
  headline:
    "GenAI & Backend Engineer building production multi-agent LLM systems and the event-driven backends behind them.",
  subhead:
    "I co-built Pensieve and architected the AAVA Code backend at Ascendion, and build open-source AI infrastructure in the open.",
  email: "uggesairam0000@gmail.com",
  links: {
    github: "https://github.com/sairam0424",
    linkedin: "https://linkedin.com/in/sairam0424",
    resume: "/resume",
  },
  githubUser: "sairam0424",
} as const;

/** Headline metrics for the above-the-fold impact strip (all real, work-context). */
export const impactMetrics = [
  { value: "2K+", label: "daily users", sub: "Pensieve" },
  { value: "3K+", label: "daily users", sub: "AAVA Code · 5+ clients" },
  { value: "10x", label: "throughput", sub: "at sub-150ms latency" },
  { value: "8", label: "open-source repos", sub: "AI infrastructure" },
] as const;

export const skills: { group: string; items: string[] }[] = [
  { group: "Languages", items: ["Python", "Go", "TypeScript"] },
  {
    group: "GenAI",
    items: [
      "LLM Agent Orchestration",
      "Multi-Agent Systems",
      "RAG",
      "Prompt Engineering",
      "crewAI",
      "Vector DBs & Embeddings",
    ],
  },
  {
    group: "Backend & Distributed",
    items: ["FastAPI", "gRPC", "REST", "GraphQL", "Microservices", "Event-Driven"],
  },
  {
    group: "Data & Messaging",
    items: ["PostgreSQL", "MongoDB", "Redis", "ChromaDB", "Apache Kafka", "Redis Streams", "SSE", "WebSockets"],
  },
  { group: "Cloud & Ops", items: ["AWS", "Docker", "Kubernetes", "CI/CD", "OpenTelemetry", "Prometheus", "Grafana"] },
  { group: "Frontend", items: ["React", "Angular", "Next.js", "Tailwind CSS"] },
];

export const achievements = [
  { title: "Google Code Jam 2023", detail: "AIR 420 · 3,687 / 85,000+" },
  { title: "Meta Hacker Cup 2022", detail: "4,048 / 70,000+" },
  { title: "Flipkart GRiD 2022", detail: "Top tier · 1,325 / 40,000+" },
  { title: "Institute Rank 1", detail: "GeeksforGeeks & InterviewBit" },
  { title: "Mentored 250–300 students", detail: "Data Structures & Algorithms" },
];

/** The 5 role-targeted résumé variants (PDFs live in /public/resume). */
export const resumeVariants = [
  { label: "Master (All-purpose)", file: "/resume/Sairam_Resume_MX_E.pdf", tag: "Backend & GenAI" },
  { label: "Backend", file: "/resume/Sairam_Resume_MX_BE.pdf", tag: "Distributed Systems" },
  { label: "Full-Stack", file: "/resume/Sairam_Resume_MX_FS.pdf", tag: "GenAI Platforms" },
  { label: "Frontend", file: "/resume/Sairam_Resume_MX_FE.pdf", tag: "GenAI Platforms" },
  { label: "Gen-AI", file: "/resume/Sairam_Resume_MX_GAI.pdf", tag: "LLM Systems" },
];
