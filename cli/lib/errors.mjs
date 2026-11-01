/** The command line is wrong. Maps to exit code 1 and prints the usage text. */
export class UsageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/** The request got no usable answer: unreachable host, reset connection or timeout. Maps to exit code 3. */
export class NetworkError extends Error {
  /**
   * @param {string} message
   * @param {unknown} cause
   */
  constructor(message, cause) {
    super(message, { cause });
    this.name = "NetworkError";
  }
}
