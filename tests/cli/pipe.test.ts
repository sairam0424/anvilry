import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { exitWhenReaderLeaves } from "../../cli/lib/pipe.mjs";

const errnoError = (code: string) =>
  Object.assign(new Error(`write ${code}`), { code });

describe("exitWhenReaderLeaves", () => {
  // EPIPE is what Linux reports when the reader closes the pipe; macOS can report ENOTCONN for
  // the socket behind it, and a reset connection is the same thing seen from the other end.
  it.each(["EPIPE", "ENOTCONN", "ECONNRESET"])(
    "exits quietly when the reader has gone away (%s)",
    (code) => {
      const stream = new EventEmitter();
      const exit = vi.fn();
      exitWhenReaderLeaves(stream, exit);

      expect(() => stream.emit("error", errnoError(code))).not.toThrow();
      expect(exit).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["ENOSPC", "EIO", "EACCES", "EBADF", "ETIMEDOUT"])(
    "does not hide a stream error that is not the reader leaving (%s)",
    (code) => {
      const stream = new EventEmitter();
      const exit = vi.fn();
      exitWhenReaderLeaves(stream, exit);

      expect(() => stream.emit("error", errnoError(code))).toThrow(code);
      expect(exit).not.toHaveBeenCalled();
    },
  );

  it("does not hide an error that has no code at all", () => {
    const stream = new EventEmitter();
    const exit = vi.fn();
    exitWhenReaderLeaves(stream, exit);

    expect(() => stream.emit("error", new Error("boom"))).toThrow("boom");
    expect(exit).not.toHaveBeenCalled();
  });

  it("does nothing until the stream reports an error", () => {
    const stream = new EventEmitter();
    const exit = vi.fn();
    exitWhenReaderLeaves(stream, exit);

    stream.emit("drain");
    expect(exit).not.toHaveBeenCalled();
  });
});
