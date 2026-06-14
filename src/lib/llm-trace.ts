/**
 * Shared constant for the chat stream's trailing "trace frame" — kept in its own
 * client-safe module so the chat client can import it WITHOUT pulling in the server-only
 * Bedrock SDK from llm.ts. U+001E (RECORD SEPARATOR) never appears in model prose, so it
 * cleanly delimits the JSON `{model, fellBack}` the server appends on a clean finish.
 */
export const TRACE_DELIMITER = "\u001e";
