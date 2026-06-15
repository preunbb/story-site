#!/usr/bin/env node
/**
 * Re-wrap long string literals in over-easy-products/products.js.
 * Used by format-on-save — safe to run repeatedly.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, writeCatalog } from "./lib/catalog.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { catalog } = loadCatalog(repoRoot);
writeCatalog(repoRoot, catalog);
