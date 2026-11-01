#!/usr/bin/env node
import { exitWhenReaderLeaves } from "../lib/pipe.mjs";
import { run } from "../lib/run.mjs";

// A reader that closes the pipe early (`anvilry openapi | head -1`) is not an error.
const exitQuietly = () => process.exit(0);
exitWhenReaderLeaves(process.stdout, exitQuietly);
exitWhenReaderLeaves(process.stderr, exitQuietly);

// The only environment variable the CLI reads is passed in by name; nothing else is exposed to it.
process.exitCode = await run(process.argv.slice(2), {
  env: { ANVILRY_BASE_URL: process.env.ANVILRY_BASE_URL },
  stdout: (data) => process.stdout.write(data),
  stderr: (text) => process.stderr.write(text),
  fetch: globalThis.fetch,
});
