import { vi } from "vitest";
import { run } from "../../../cli/lib/run.mjs";

/** One request the CLI handed to fetch. */
export interface Call {
  url: string;
  init: RequestInit;
}

export type Respond = (call: Call) => Response | Promise<Response>;

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Runs the CLI in-process with a scripted fetch, so every output and exit-code branch is covered
 * without a network or a child process.
 */
export async function runInProcess(
  argv: string[],
  respond: Respond = () => json({ ok: true }),
  env: Record<string, string | undefined> = {},
) {
  const calls: Call[] = [];
  const stdoutChunks: Buffer[] = [];
  let stderr = "";
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), init: init ?? {} };
      calls.push(call);
      return respond(call);
    },
  ) as unknown as typeof fetch;
  const code = await run(argv, {
    env,
    stdout: (data) => stdoutChunks.push(Buffer.from(data)),
    stderr: (text) => (stderr += text),
    fetch: fetchImpl,
  });
  const stdoutBytes = Buffer.concat(stdoutChunks);
  return {
    code,
    stdout: stdoutBytes.toString("utf8"),
    stdoutBytes,
    stderr,
    calls,
  };
}
