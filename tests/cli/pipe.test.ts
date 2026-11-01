import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { exitWhenReaderLeaves } from "../../cli/lib/pipe.mjs";

const errnoError = (code: string) =>
  Object.assign(new Error(`write ${code}`), { code });

describe("exitWhenReaderLeaves", () => {
  it("exits quietly when the reader has closed the pipe (EPIPE)", () => {
    const stream = new EventEmitter();
    const exit = vi.fn();
    exitWhenReaderLeaves(stream, exit);

    expect(() => stream.emit("error", errnoError("EPIPE"))).not.toThrow();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("does not hide any other stream error", () => {
    const stream = new EventEmitter();
    const exit = vi.fn();
    exitWhenReaderLeaves(stream, exit);

    expect(() => stream.emit("error", errnoError("ENOSPC"))).toThrow("ENOSPC");
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
