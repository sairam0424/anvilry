import {
  apiError,
  methodNotAllowed,
  optionsFor,
  withJsonErrors,
} from "@/lib/api-error";
import { BATCH_MAX_BODY_BYTES, BATCH_MAX_REQUESTS } from "@/lib/api-policy";
import {
  answerBatch,
  isJsonContentType,
  parseBatchBody,
  readBodyWithin,
  rejectBatch,
  runBatch,
} from "@/lib/batch";

/**
 * POST /api/v1/batch: a few read-only operations in one request (BATCH_MAX_REQUESTS at most).
 *
 * The body is read under a byte cap and validated as a whole before anything runs; then each
 * operation is answered by calling the real /api/v1 GET handler in process, and the results come
 * back in request order, unless together they would pass BATCH_MAX_RESPONSE_BYTES, in which case
 * the whole answer is refused (413). It reads the body, so it is dynamic and carries the JSON 405
 * stubs. The proxy lets POST through to this path alone and counts the call as one request of the
 * client's budget (src/proxy.ts, allowedMethods in src/lib/public-api-paths.ts).
 */
export const POST = withJsonErrors(async (req: Request) => {
  if (!isJsonContentType(req.headers.get("content-type"))) {
    return rejectBatch("Send the batch with Content-Type: application/json.");
  }

  const body = await readBodyWithin(req, BATCH_MAX_BODY_BYTES);
  if (body.kind === "too_large") {
    return apiError(
      413,
      "payload_too_large",
      `The batch body is larger than ${BATCH_MAX_BODY_BYTES} bytes.`,
      {
        hint: `Send at most ${BATCH_MAX_REQUESTS} operations, in under ${BATCH_MAX_BODY_BYTES} bytes of JSON, and split a longer list across several batches.`,
      },
    );
  }
  if (body.kind === "invalid_encoding")
    return rejectBatch("The body is not valid UTF-8.");

  const parsed = parseBatchBody(body.text);
  if (!parsed.ok) return rejectBatch(parsed.reason);

  return answerBatch(await runBatch(parsed.items));
});

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["POST"]);
export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["POST"]);
