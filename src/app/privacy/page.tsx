import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { ProseH2, ProseList, ProseP } from "@/components/ui/prose";
import { PRIVACY_FACTS as F } from "@/lib/privacy-facts";
import { profile } from "@/lib/profile";

const description = `What the Anvilry portfolio site stores, sends and keeps when you visit it, use the AI assistant or turn on voice. Written by ${profile.name} from what the code actually does.`;

export const metadata: Metadata = {
  title: "Privacy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: `Privacy — ${profile.name}`,
    description,
  },
};

export default function PrivacyPage() {
  return (
    <main className="flex-1">
      <Section label="// privacy" title="Privacy at Anvilry" titleAs="h1">
        <div className="max-w-2xl">
          <ProseP>
            Anvilry is the personal portfolio of {profile.name}, a software engineer based in{" "}
            {profile.location}. It has no accounts, no sign-up, no advertising and no newsletter
            form. This page lists what happens to your data when you use it, in plain terms and
            only as far as the code shows. Last updated {F.lastUpdated}.
          </ProseP>

          <ProseH2>The short version</ProseH2>
          <ProseList
            items={[
              "Reading the site needs no personal data from you, and the site's own code sets no cookies.",
              "Vercel hosts the site and runs its page-view and performance analytics.",
              "If you use the AI assistant, what you type is sent to a language model on AWS. Do not enter anything private.",
              "Voice features are off until you switch them on, and some options send audio or text to other companies.",
              "Your IP address is used to rate-limit requests and, as a one-way hash, in some logs. I do not sell your data or use it for advertising.",
            ]}
          />

          <ProseH2>Who is responsible</ProseH2>
          <ProseP>
            {profile.name}, an individual in {profile.location}, runs this site. Questions, requests
            to see or remove something, and corrections go to{" "}
            <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>{" "}
            or through the <Link className="text-accent underline-offset-2 hover:underline" href="/contact">contact page</Link>.
          </ProseP>

          <ProseH2>What stays in your browser</ProseH2>
          <ProseP>
            The site saves a few settings in your browser&apos;s local storage so they survive a
            reload. They stay on your device, with two exceptions: the visitor total below is a
            site-wide number the server hands back, and the voice you pick is sent along with each
            spoken-reply request if you use the AWS Polly or Google voices (see Voice).
          </ProseP>
          <ProseList
            items={[
              "Your theme choice (dark or light).",
              "Your voice settings: whether the microphone and spoken replies are on, which engines and voice you picked, and whether the one-time voice introduction has been shown.",
              `The last ${F.recentCommandsKept} items you ran from the command palette (only their ids, never what you typed).`,
              "Whether you dismissed the hint about the other views, and which of four small discoveries you have triggered.",
              "The name of the last mascot shown on a 404 page (kept in session storage until the tab closes).",
              "Optionally, the last visitor total, only if the visitor counter is switched on (it is off by default).",
            ]}
          />
          <ProseP>
            Your chat conversation is held in memory only, so reloading the page discards it. You
            can clear everything above at any time by clearing this site&apos;s data in your browser.
          </ProseP>

          <ProseH2>Analytics</ProseH2>
          <ProseP>
            Vercel Web Analytics and Vercel Speed Insights run on every page. They count page views
            and measure how fast pages load. Exactly what their scripts collect, and for how long
            Vercel keeps it, is described in Vercel&apos;s documentation and privacy policy, not in
            this site&apos;s code. There is no Google Analytics, advertising pixel or session-replay
            tool. The site also records four usage events with Vercel Analytics: choosing
            Developer mode in the command palette, maximising the terminal, using a terminal suggestion chip, and running a
            terminal command by name (only the command name, never anything typed after it).
          </ProseP>

          <ProseH2>The AI assistant</ProseH2>
          <ProseP>
            When you ask the assistant a question, your messages go to this site&apos;s server and
            from there to a Claude language model run through Amazon Web Services (AWS Bedrock),
            together with the content of this portfolio. The server sends on only the last{" "}
            {F.chatMessagesKept} messages of a conversation and cuts each typed message to{" "}
            {F.chatCharsPerMessage} characters, but it does not look for personal details in what you
            type. Please do not enter passwords, secrets or other people&apos;s data. File
            attachments are an optional feature that the default build leaves off; where they are
            switched on, an image or the text of a PDF you attach is sent to the model too, and the{" "}
            {F.chatCharsPerMessage}-character cut does not apply to the image.
          </ProseP>
          <ProseList
            items={[
              "The site's logs record counts and sizes (how many messages, how long), the model used, tokens, cost and timing. They do not record the text of your messages.",
              `A first question is answered from a cache when an identical one was answered in the last ${F.faqCacheHours} hours. The cache entry is keyed by a one-way hash of the question and holds the answer; for a short question it can also hold a reasoning summary that may quote or paraphrase it.`,
              "An optional matching mode, off by default, also stores a numeric fingerprint of the question (an embedding made by an AWS model) in the cache entry.",
              "AWS processes the request in the United States by default; one optional model setting may process it outside the US. How long AWS keeps requests is set by AWS and the account's settings, which this site cannot show you.",
            ]}
          />

          <ProseH2>Voice (optional, off by default)</ProseH2>
          <ProseList
            items={[
              "Browser speech recognition: your browser may send the audio to its maker (Google, Apple or Microsoft) to turn it into text. Nothing is recorded or stored by this site.",
              `Private transcription (an option in the command palette): your audio goes from the browser to this site's server and on to AWS Transcribe, is held in memory only for that request (at most ${F.transcribeMaxMegabytes} MB) and is not stored by this site.`,
              `Spoken replies: by default your browser reads them aloud on your device. If you pick the AWS Polly or Google voices, one sentence of the reply at a time (up to ${F.ttsCharsPerRequest} characters) and the voice you chose are sent to AWS or Google to be turned into audio. The server keeps the audio of the most recent sentences in memory, and your browser may reuse an audio reply for up to an hour. The settings screen does not show a separate consent prompt for this; this page is the disclosure.`,
              "Wake word (optional, off by default): when you switch it on, your browser listens continuously on the Chat and Voice views and, in Chrome and Edge, streams that audio to the browser maker for recognition.",
            ]}
          />

          <ProseH2>IP addresses, rate limits and logs</ProseH2>
          <ProseP>
            To stop abuse and runaway cost, the assistant, voice and error-report routes allow{" "}
            {F.rateLimitRequests} requests per {F.rateLimitWindowSeconds} seconds per IP address.
            The counter is stored in Upstash Redis under your IP address (not hashed) and expires
            after about two minutes; the optional visitor counter uses a similar counter that expires
            after about an hour. Vercel keeps its own request logs for the platform (IP address,
            browser, URL), which this site does not control.
          </ProseP>
          <ProseP>
            The free read-only API routes (the JSON API, the Markdown files, llms.txt and the other
            discovery files, and the MCP endpoint) allow {F.publicApiRequests} requests per{" "}
            {F.publicApiWindowSeconds} seconds per IP address. That counter is kept only in the
            memory of the server instance that answers, under your IP address (not hashed); it is
            not written to Upstash or to any log. Expired counters are swept out of memory about
            once a minute, whenever the instance handles a request, and every counter disappears
            when the instance restarts.
          </ProseP>

          <ProseH2>Server logs</ProseH2>
          <ProseP>
            For the assistant, voice and error-report routes the server writes one log event per
            request: the route, status and timing, counts or sizes (never the text of a message), a
            shortened one-way hash of your IP address and browser string and a daily session hash.
            The hashes are only made when a hashing salt is configured; otherwise those fields hold
            the word &quot;anonymous&quot;. Events go to Vercel&apos;s runtime logs, which this site
            does not expire, and to Upstash, where they are trimmed after about{" "}
            {F.errorRetentionDays} days on a best-effort schedule (a cleanup that runs occasionally,
            so some last longer). I read them on a private dashboard.
          </ProseP>

          <ProseH2>Error reports</ProseH2>
          <ProseP>
            If a script on a page crashes, your browser sends a short report to the site: the error
            message and stack, the page address and your browser string. Email addresses and long
            token-like strings in the message and stack are replaced before storing; the address and
            browser string are kept as sent. A report is a server log event like the ones above, with
            the same retention, and a separate list of the last {F.recentErrorsKept} reports has no
            expiry.
          </ProseP>

          <ProseH2>Other companies involved</ProseH2>
          <ProseList
            items={[
              "Vercel: hosting, content delivery, analytics and logs.",
              "Amazon Web Services: the language model (Bedrock) and, if you choose them, speech-to-text (Transcribe) and text-to-speech (Polly).",
              "Google Cloud: text-to-speech, only if you choose a Google voice.",
              "Upstash: the Redis database holding rate-limit counters, the answer cache and error reports.",
              "GitHub: the server reads public repository statistics from it; no visitor data is included in those requests.",
              "Your browser's speech service, if you use browser speech recognition.",
            ]}
          />
          <ProseP>
            Fonts are served from this site, and the page loads no advertising or social-media
            widgets. Links to GitHub, LinkedIn, npm, PyPI, Dev.to, Substack and Calendly leave this
            site; those services have their own policies.
          </ProseP>

          <ProseH2>Your choices</ProseH2>
          <ProseP>
            You can use the whole site without the assistant or voice. You can clear the settings
            above in your browser. Because there are no accounts, most of what the server holds
            cannot be tied to a person, but if you want a cached answer or a report removed, or want
            to know what is held, write to{" "}
            <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>{" "}
            and I will do what I can.
          </ProseP>

          <ProseH2>Changes</ProseH2>
          <ProseP>
            This page changes when the site does. The date at the top is the last edit, and the
            history is in the public repository at github.com/{profile.githubUser}/anvilry.
          </ProseP>
        </div>
      </Section>
    </main>
  );
}
