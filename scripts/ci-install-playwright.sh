#!/usr/bin/env bash
# Install the Playwright browsers and their system packages on a GitHub-hosted runner, bounded and retried.
#
# Why this is a script and not one `playwright install` line (E2E is a REQUIRED check):
#  - On 2026-10-22 the runner's apt mirror (azure.archive.ubuntu.com) stalled for about 30 s per package
#    ("Ign:" lines in the step log), so `playwright install --with-deps` crawled into the 20 min job
#    timeout on three runs in a row, while healthy runs finish this step in about 2.5 min.
#  - A bare `timeout` does not fix that. Playwright runs apt-get as root through sudo; `timeout` can only
#    signal the unprivileged wrapper, so the orphaned apt-get keeps the dpkg lock and every retry fails at
#    once with "Could not get lock /var/lib/dpkg/lock-frontend" (seen on PR #339). Each failed attempt
#    therefore stops apt as root and repairs dpkg before the next one. Downloaded .debs stay in
#    /var/cache/apt/archives, so a retry resumes instead of starting over.
#  - apt pipelines requests on one connection, so one stalled response blocks the whole queue behind it.
#    Turning pipelining off, shortening the idle timeout and retrying per file keeps a stall local.
#
# Worst case: ATTEMPTS x ATTEMPT_SECONDS plus short pauses (about 13 min), then a red step.
set -euo pipefail

readonly ATTEMPTS=3
readonly ATTEMPT_SECONDS=240
readonly KILL_GRACE_SECONDS=15
readonly PAUSE_SECONDS=5

printf '%s\n' 'Acquire::http::Pipeline-Depth "0";' 'Acquire::http::Timeout "15";' 'Acquire::Retries "3";' |
  sudo tee /etc/apt/apt.conf.d/99ci-apt >/dev/null

for attempt in $(seq 1 "$ATTEMPTS"); do
  if timeout -k "$KILL_GRACE_SECONDS" "$ATTEMPT_SECONDS" pnpm exec playwright install --with-deps chromium webkit; then
    exit 0
  fi
  echo "::warning::Playwright browser install attempt ${attempt}/${ATTEMPTS} failed or timed out"
  # Stop what `timeout` could not reach (root-owned), then repair a half-finished dpkg run.
  sudo pkill -KILL -x apt-get || true
  sudo pkill -KILL -x dpkg || true
  sudo dpkg --configure -a || true
  sleep "$PAUSE_SECONDS"
done

echo "::error::Playwright browser install failed after ${ATTEMPTS} attempts"
exit 1
