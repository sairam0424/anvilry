# anvilry

<!-- status:unpublished:start -->
> **Not published to npm yet.** Until it is, run it from a clone of the repository: `node cli/bin/anvilry.mjs <command>` (for example `node cli/bin/anvilry.mjs status`). In the examples below, read `anvilry` as `node cli/bin/anvilry.mjs`. The `npx` and `npm install` lines apply once the package is published.
<!-- status:unpublished:end -->

A command line client for the public, read-only JSON API of [Anvilry](https://anvilry.vercel.app): the profile, case studies, projects, articles, notes and architecture decisions of Sairam Ugge, as JSON on stdout. It is a thin wrapper around `https://anvilry.vercel.app/api/v1`, written for scripts and AI agents as much as for people.

- Zero dependencies; it uses the `fetch` that ships with Node.js.
- Read-only. It sends `GET` requests, plus one `POST` that bundles several reads (`batch`).
- No telemetry, no files written, no credentials. The only environment variable it reads is `ANVILRY_BASE_URL`.
- Stable exit codes and a stable error format, so a script can branch on the result.

The full API reference is at <https://anvilry.vercel.app/developers>; the machine-readable description is at <https://anvilry.vercel.app/openapi.json>.

## Install

Once published:

```sh
npx anvilry profile          # run without installing
npm install --global anvilry # or install the `anvilry` command
```

Requires Node.js 18.3 or newer. On older Node versions `fetch` may print an `ExperimentalWarning` on stderr; it does not change stdout or the exit code.

## Quick start

```sh
anvilry status                 # version, rate limit and links to every resource
anvilry projects               # list the projects
anvilry projects trelix        # one project
anvilry search kafka           # keyword search across work, projects and skills
anvilry decisions --tag mcp    # architecture decisions that carry a tag
anvilry batch /api/v1/profile /api/v1/projects/trelix   # several reads, one request
```

Output is pretty-printed JSON on stdout. Errors go to stderr and never mix with the JSON. Closing the pipe early (`anvilry openapi | head -1`) is not an error: the CLI stops quietly with exit code 0.

## Commands

| Command | What it does | Example |
| --- | --- | --- |
| `anvilry profile` | The owner's profile, links, skills and achievements. | `anvilry profile` |
| `anvilry work [slug]` | List the production case studies, or show one. | `anvilry work pensieve` |
| `anvilry projects [slug]` | List the projects, or show one. | `anvilry projects trelix` |
| `anvilry articles [slug]` | List the published articles, or show one. | `anvilry articles` |
| `anvilry notes [slug]` | List the published engineering notes, or show one. Empty while the site keeps notes switched off. | `anvilry notes` |
| `anvilry decisions [--tag <tag>]` | Architecture decisions, optionally only those with one tag. | `anvilry decisions --tag security` |
| `anvilry search <query>` | Case-insensitive search across case studies, projects and skills. Quote a query that has spaces. | `anvilry search "multi agent"` |
| `anvilry resume` | The résumé as JSON Resume. | `anvilry resume` |
| `anvilry stats` | Aggregate GitHub statistics. | `anvilry stats` |
| `anvilry openapi` | The OpenAPI 3.1 description of the API. | `anvilry openapi > openapi.json` |
| `anvilry batch <path> [<path>...]` | Fetch up to 25 API paths in one request. Each path starts with a slash. | `anvilry batch /api/v1/profile /api/v1/work` |
| `anvilry status` | The API index: version, rate limit, deprecations and resource links. | `anvilry status` |
| `anvilry help` | The command list, the flags and the exit codes. | `anvilry help` |
| `anvilry version` | The CLI version. | `anvilry version` |

A slug is 1 to 120 letters, digits, underscores or hyphens. Anything else is rejected before a request is made. Slugs and queries are percent-encoded, so a query can never change the path or add a parameter.

### `batch`

`batch` sends one `POST /api/v1/batch` with `{ "requests": [{ "id": "1", "method": "GET", "path": "/api/v1/profile" }, ...] }` and prints the `{ "responses": [{ "id", "status", "body" }, ...] }` the API returns. Use the number of the path (`id` 1 is the first path) to match a response to its request. When any operation inside the batch failed (a status of 400 or more), the full response is still printed and the exit code is 2, so a script does not mistake a partial failure for success.

## Flags

| Flag | Meaning |
| --- | --- |
| `--base-url <url>` | API origin to talk to. `http` and `https` only; no credentials, query string or fragment. Overrides `ANVILRY_BASE_URL`. Default `https://anvilry.vercel.app`. |
| `--raw` | Print a successful response body byte for byte as received, with nothing re-encoded or escaped (see below). Errors are still reported on stderr. |
| `--headers` | Also print the `API-Version` and `RateLimit` response headers to stderr. |
| `--timeout <ms>` | Give up after this many milliseconds, whole body included. 1 to 600000, default 15000. |
| `--help` | Show the help. |
| `--version` | Print the version. |
| `--tag <tag>` | Only for `decisions`. |

Every request carries `API-Version: 1` and `User-Agent: anvilry-cli/<version>`.

### Pointing at another server

```sh
ANVILRY_BASE_URL=http://localhost:3000 anvilry status
anvilry status --base-url https://my-preview.example.com
```

The flag wins over the variable. Both are checked before anything is requested.

### What it prints, and what it never trusts

A server you point `--base-url` at can send anything, so the default output is made safe for a terminal. Control characters (C0, DEL and the C1 range, including the escape character) and Unicode format characters (right-to-left overrides, zero-width characters and similar) are written as `\uXXXX` escapes: in the JSON on stdout, which stays valid JSON and parses to the same value, and in everything printed to stderr.

`--raw` is the one exception, by design. It prints exactly the bytes the server sent: no re-formatting, no escaping, no re-encoding (a byte-order mark or a body that is not UTF-8 comes through untouched). Use it for pipes and for servers you trust.

The CLI reads at most 10 MiB of a response. A larger body is refused with exit code 2 and nothing is printed.

The default output also has limits, because indentation multiplies the size of a deeply nested body: a response nested more than 1000 levels deep, or whose output would be more than 64 MiB when indented, is not pretty-printed. The CLI reports `Could not print the response` with exit code 2 instead, and `--raw` still prints it.

The CLI does not follow redirects. A `3xx` answer is reported with its `Location` and exit code 2, and a batch body is never sent anywhere but the address you gave. To use a redirected address, pass its origin as `--base-url`. For example, `--base-url http://anvilry.vercel.app` is answered with a redirect to `https`; use the `https` address.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, or the reader of the output closed the pipe early. |
| `1` | Usage error: unknown command or flag, a bad slug, a bad `--base-url` or `--timeout`. The usage text is on stderr and no request was made. |
| `2` | The API answered with an error (including `429`), a redirect, a body that is not JSON or is over 10 MiB, or a batch in which an operation failed. |
| `3` | No answer: the host is unreachable, the connection dropped, or `--timeout` passed. |

On code 2 stderr holds the machine-readable error code, the message and the hint from the API's error body, for example for `anvilry projects nope`:

```text
anvilry: not_found (HTTP 404): No project with this slug exists in the projects collection.
hint: Valid slugs: kelvran, toolwarrant, cost-guard-mcp, prompt-lift, ratecap, trelix, tombstone, mindforge, tracehub-mcp, anvilry, agent-forge, graph-forge, inkforge, contextos, ag-bash, commandvault, daily-dose, nh-deck.
```

## Rate limits

The public API allows 300 requests per 60 seconds per client address (`anvilry status` reports the current figures). Past that it answers `429` with a `Retry-After` header. The CLI then prints the wait and every rate-limit field the server sent, and exits with code 2:

```text
anvilry: rate_limited (HTTP 429): Too many requests from this client. Retry after 42 seconds.
retry-after: 42
api-version: 1
ratelimit-policy: "default";q=300;w=60
ratelimit: "default";r=0;t=42
...
```

`--headers` shows the same fields (`API-Version`, `RateLimit-Policy`, `RateLimit`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) on successful requests. Use `batch` to read several resources for one request.

## Using it from a script

```sh
if out=$(anvilry projects trelix 2>err.txt); then
  echo "$out" | jq -r .name
else
  case $? in
    2) echo "API error: $(cat err.txt)" ;;
    3) echo "network problem" ;;
  esac
fi
```

## What it does not do

It does not write files, read configuration files, send analytics, attach credentials or follow redirects, and it names no host except the one you give it.

## Maintainers: releasing

The package source lives in `cli/` of the Anvilry repository. Nothing here publishes by itself.

1. Run the tests from the repository root: `pnpm test` (the CLI tests are in `tests/cli`).
2. Set the new version in `cli/package.json` (`version`). The CLI reads it at run time, so the `--version` output and the `User-Agent` follow.
3. Check what would be published: `cd cli && npm pack --dry-run`. It must list only `package.json`, `README.md`, `LICENSE`, `bin/anvilry.mjs` and the files in `lib/`. (`npm publish --dry-run` checks the same manifest but does not exercise authentication or provenance.)
4. Publish, either by hand or from CI:
   - By hand: `npm login`, then `cd cli && npm publish`. An account with two-factor authentication is asked for a one-time password (or pass `--otp=<code>`). The manifest does not ask for provenance because npm can only generate it on a supported CI provider; a plain `npm publish --provenance` from a laptop fails with `EUSAGE`.
   - From GitHub Actions: use a GitHub-hosted runner and give the job `permissions: { contents: read, id-token: write }`, then run `cd cli && npm publish --provenance` with an npm token in `NODE_AUTH_TOKEN`. Or use npm trusted publishing instead of a token: it needs npm CLI 11.5.1 or newer and Node.js 22.14 or newer, is configured in the package settings on npmjs.com, must complete its first publish within 2 days of being created, and then adds provenance by itself. The repository has no publishing workflow yet.
5. After the first publish, in one change: (a) delete the status block at the top of this file, that is the two comment lines that contain `status:unpublished` and everything between them; (b) in the Install section, delete the one-line lead-in before the install commands (or replace it with a sentence that suits a published package); (c) set `CLI.published` to `true` in `src/lib/developer-tools.ts`. A test fails until all three are done, and it passes once they are.
6. Verify from a clean directory: `npx anvilry@latest version` and `npx anvilry@latest status`.

## License

MIT. See `LICENSE`.
