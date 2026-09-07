/**
 * Client-safe access to the committed Claims Integrity Ledger. Importing the
 * JSON file directly (not reading it via fs) means this is safe to use from a
 * client component — Next's bundler inlines it as plain data at build time,
 * the same mechanism every other JSON import in this repo relies on.
 */
import chain from "../../data/integrity-chain.json";
import type { ChainEntry } from "./claims-integrity";

export const integrityChain: ChainEntry[] = chain as ChainEntry[];
