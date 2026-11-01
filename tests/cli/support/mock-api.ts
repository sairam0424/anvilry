import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo, Socket } from "node:net";

/**
 * A stand-in for the Anvilry API on an ephemeral 127.0.0.1 port, so the CLI tests never touch
 * the real network. It records every request it receives, which is how the tests prove that a
 * command made exactly the calls it should (and none when it should make none).
 */

export interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

export type Responder = (
  request: RecordedRequest,
  response: ServerResponse,
) => void;

export interface MockApi {
  baseUrl: string;
  /** A copy of the requests received so far, oldest first. */
  received: () => RecordedRequest[];
  close: () => Promise<void>;
}

const ERROR_DOCS_URL = "https://anvilry.vercel.app/developers#errors";

/** The headers the real proxy stamps on a counted response. */
export const RATE_LIMIT_HEADERS = {
  "API-Version": "1",
  "RateLimit-Policy": '"default";q=300;w=60',
  RateLimit: '"default";r=299;t=60',
  "RateLimit-Limit": "300",
  "RateLimit-Remaining": "299",
  "RateLimit-Reset": "60",
} as const;

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...RATE_LIMIT_HEADERS,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

/** The shared error body of the real API: { error, code, status, hint, docs }. */
export function errorBody(
  status: number,
  code: string,
  error: string,
  hint: string,
) {
  return { error, code, status, hint, docs: ERROR_DOCS_URL };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

export async function startMockApi(respond: Responder): Promise<MockApi> {
  const received: RecordedRequest[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    void readBody(request).then((body) => {
      const recorded: RecordedRequest = {
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body,
      };
      received.push(recorded);
      respond(recorded, response);
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    received: () => [...received],
    close: () =>
      new Promise<void>((resolve) => {
        // A deliberately slow response keeps its socket open; drop it so close() can finish.
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
  };
}

/**
 * A responder that never finishes a response on its own, so a test can prove the CLI gives up by
 * its own deadline instead of waiting for the server. Nothing here measures time: the test
 * awaits the CLI's exit and then checks that the server is still holding (`isReleased()` is
 * false), which can only be true if the CLI left first. `release()` lets the held responses go.
 *
 * With `partialBody` the headers and the start of the body are sent first, and the response then
 * stalls, which is the case where the deadline has to cover reading the body too.
 */
export function holdingResponder(partialBody?: string) {
  const held: ServerResponse[] = [];
  let released = false;
  const respond: Responder = (_request, response) => {
    if (partialBody !== undefined) {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(partialBody) + 1_000),
      });
      response.write(partialBody);
    }
    held.push(response);
  };
  return {
    respond,
    isReleased: () => released,
    release: () => {
      released = true;
      held.forEach((response) => response.destroy());
    },
  };
}

/**
 * A responder that parks every request and answers it, with `answer`, only when the test calls
 * `open()`. `arrived` settles once the first request is in, so a test can do something to the
 * running CLI (close one of its pipes) at a point that is ordered by events, not by time: the
 * CLI cannot have received its answer yet.
 */
export function gatedResponder(answer: Responder) {
  const parked: { request: RecordedRequest; response: ServerResponse }[] = [];
  let signalArrival: () => void = () => undefined;
  const arrived = new Promise<void>((resolve) => {
    signalArrival = resolve;
  });
  const respond: Responder = (request, response) => {
    parked.push({ request, response });
    signalArrival();
  };
  return {
    respond,
    arrived,
    open: () => parked.forEach((item) => answer(item.request, item.response)),
  };
}

/** Answers every request with exactly these bytes. */
export function bytesResponder(
  body: Uint8Array,
  contentType = "application/json",
  status = 200,
): Responder {
  return (_request, response) => {
    response.writeHead(status, {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      ...RATE_LIMIT_HEADERS,
    });
    response.end(body);
  };
}

/** Answers every request with a redirect to `location`, with no body. */
export function redirectResponder(location: string, status = 307): Responder {
  return (_request, response) => {
    response.writeHead(status, { Location: location });
    response.end();
  };
}

const PROJECTS = [
  { slug: "trelix", name: "trelix" },
  { slug: "tombstone", name: "Tombstone" },
];

/**
 * A responder that behaves like the real read-only API for the routes the tests use. A GET to a
 * route it does not know answers the shared 404 body; POST /api/v1/batch runs each operation
 * through the same logic and answers { responses: [{ id, status, body }] }.
 */
export function portfolioResponder(): Responder {
  function lookup(path: string): { status: number; body: unknown } {
    const url = new URL(path, "http://mock.invalid");
    if (url.pathname === "/api/v1") {
      return { status: 200, body: { version: "1", status: "stable" } };
    }
    if (url.pathname === "/api/v1/profile") {
      return { status: 200, body: { name: "Sairam Ugge" } };
    }
    if (url.pathname === "/api/v1/projects") {
      return { status: 200, body: { count: PROJECTS.length, items: PROJECTS } };
    }
    const project = PROJECTS.find(
      (candidate) => url.pathname === `/api/v1/projects/${candidate.slug}`,
    );
    if (project) return { status: 200, body: project };
    if (url.pathname === "/api/v1/search") {
      return { status: 200, body: { query: url.searchParams.get("q") } };
    }
    if (url.pathname === "/api/v1/decisions") {
      return {
        status: 200,
        body: { count: 0, items: [], tag: url.searchParams.get("tag") },
      };
    }
    if (url.pathname === "/openapi.json") {
      return { status: 200, body: { openapi: "3.1.0", paths: {} } };
    }
    return {
      status: 404,
      body: errorBody(
        404,
        "not_found",
        "No item exists at this path.",
        "Valid slugs: trelix, tombstone.",
      ),
    };
  }

  return (request, response) => {
    if (request.method === "POST" && request.url === "/api/v1/batch") {
      const { requests } = JSON.parse(request.body) as {
        requests: { id: string; path: string }[];
      };
      const responses = requests.map(({ id, path }) => ({
        id,
        ...lookup(path),
      }));
      sendJson(response, 200, { responses });
      return;
    }
    const { status, body } = lookup(request.url);
    sendJson(response, status, body);
  };
}
