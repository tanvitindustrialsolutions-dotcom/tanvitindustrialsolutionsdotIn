/**
 * Replace `const PRODUCTS = [ ... ];` in js/store.js with `let PRODUCTS = [];`
 * Run after extract-products.cjs. From repo root: node tools/strip-products-array.cjs
 */
const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "..", "js", "store.js");
const src = fs.readFileSync(srcPath, "utf8");
const marker = src.includes("const PRODUCTS = ")
  ? "const PRODUCTS = "
  : src.includes("let PRODUCTS = ")
    ? "let PRODUCTS = "
    : null;
if (!marker) throw new Error("PRODUCTS declaration not found in js/store.js");
const i = src.indexOf(marker);
if (i === -1) throw new Error("PRODUCTS marker not found");
const arrStart = src.indexOf("[", i);
let depth = 0;
let inStr = null;
let escape = false;
let j = arrStart;
for (; j < src.length; j++) {
  const c = src[j];
  if (inStr) {
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === inStr) {
      inStr = null;
      continue;
    }
    continue;
  }
  if (c === '"' || c === "'") {
    inStr = c;
    continue;
  }
  if (c === "[") depth++;
  if (c === "]") {
    depth--;
    if (depth === 0) {
      j++;
      break;
    }
  }
}
let end = j;
if (src[end] === ";") end++;
const before = src.slice(0, i);
const after = src.slice(end);
const replacement =
  "/** Loaded at runtime from /data/catalog.json via js/catalog-loader.js (see server/ for admin API). */\nlet PRODUCTS = [];\n";
const out = before + replacement + after;
fs.writeFileSync(srcPath, out, "utf8");
console.log("Replaced PRODUCTS array with empty mutable array in js/store.js");
