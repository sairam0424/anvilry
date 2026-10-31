import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { ProseH2, ProseList, ProseP } from "@/components/ui/prose";
import { profile } from "@/lib/profile";

const description = `How to reach ${profile.name}: email, a 30-minute intro call, LinkedIn and GitHub. Open to backend, GenAI and full-stack engineering roles.`;

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    title: `Contact — ${profile.name}`,
    description,
  },
};

const link = "text-accent underline-offset-2 hover:underline";

export default function ContactPage() {
  return (
    <main className="flex-1">
      <Section label="// contact" title={`Contact ${profile.name}`} titleAs="h1">
        <div className="max-w-2xl">
          <ProseP>
            {profile.availability} I am based in {profile.location} (India Standard Time, UTC+5:30).
            Email is the best way to reach me about a role, a collaboration, a question about
            something on this site, or a correction.
          </ProseP>

          <ProseH2>Ways to reach me</ProseH2>
          <ProseList
            items={[
              <>
                Email:{" "}
                <a className={link} href={`mailto:${profile.email}`}>
                  {profile.email}
                </a>
              </>,
              <>
                A 30-minute intro call:{" "}
                <a className={link} href={profile.calendlyUrl} target="_blank" rel="noopener noreferrer">
                  book a slot on Calendly
                </a>
              </>,
              <>
                LinkedIn:{" "}
                <a className={link} href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">
                  {profile.links.linkedin.replace("https://", "")}
                </a>
              </>,
              <>
                GitHub:{" "}
                <a className={link} href={profile.links.github} target="_blank" rel="noopener noreferrer">
                  {profile.links.github.replace("https://", "")}
                </a>
                , where issues and pull requests on the open-source projects are welcome
              </>,
            ]}
          />

          <ProseH2>Helpful to include</ProseH2>
          <ProseP>
            For a role, the team, the stack and whether it is remote or on site save a round of
            questions. For a bug or a correction on this site, the page address and what you expected
            to see are enough.
          </ProseP>

          <ProseH2>Security reports</ProseH2>
          <ProseP>
            If you found a vulnerability in this site or its code, please do not post it publicly. The
            repository&apos;s{" "}
            <a
              className={link}
              href={`https://github.com/${profile.githubUser}/anvilry/security/policy`}
              target="_blank"
              rel="noopener noreferrer"
            >
              security policy
            </a>{" "}
            explains how to report it privately.
          </ProseP>

          <ProseH2>For software and AI agents</ProseH2>
          <ProseP>
            The same details are available as data: the{" "}
            <Link className={link} href="/api/resume.json">
              JSON résumé
            </Link>{" "}
            carries the email address, and the{" "}
            <Link className={link} href="/developers">
              developer guide
            </Link>{" "}
            lists every machine-readable endpoint. What happens to data you send is on the{" "}
            <Link className={link} href="/privacy">
              privacy page
            </Link>
            .
          </ProseP>
        </div>
      </Section>
    </main>
  );
}
