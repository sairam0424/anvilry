/**
 * Write errors that mean the reader of a pipe went away: EPIPE (it closed the pipe), and on some
 * systems ENOTCONN or ECONNRESET for the socket behind it (macOS reports ENOTCONN where Linux
 * reports EPIPE). None of them is a failure of the CLI.
 */
const READER_GONE = new Set(["EPIPE", "ENOTCONN", "ECONNRESET"]);

/**
 * `anvilry openapi | head -1` closes the pipe while the CLI is still writing. The reader chose to
 * stop, so that is not a failure: the write error ends the process quietly instead of crashing
 * with a stack trace. Any other stream error is a real problem and is rethrown.
 *
 * @param {{ on: (event: "error", listener: (error: NodeJS.ErrnoException) => void) => unknown }} stream
 *   process.stdout or process.stderr.
 * @param {() => void} exit  Ends the process with code 0.
 */
export function exitWhenReaderLeaves(stream, exit) {
  stream.on("error", (error) => {
    if (error.code !== undefined && READER_GONE.has(error.code)) {
      exit();
      return;
    }
    throw error;
  });
}
