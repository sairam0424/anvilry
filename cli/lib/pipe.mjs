/**
 * `anvilry openapi | head -1` closes the pipe while the CLI is still writing. The reader chose to
 * stop, so that is not a failure: the write error (EPIPE) ends the process quietly instead of
 * crashing with a stack trace. Any other stream error is a real problem and is rethrown.
 *
 * @param {{ on: (event: "error", listener: (error: NodeJS.ErrnoException) => void) => unknown }} stream
 *   process.stdout or process.stderr.
 * @param {() => void} exit  Ends the process with code 0.
 */
export function exitWhenReaderLeaves(stream, exit) {
  stream.on("error", (error) => {
    if (error.code === "EPIPE") {
      exit();
      return;
    }
    throw error;
  });
}
