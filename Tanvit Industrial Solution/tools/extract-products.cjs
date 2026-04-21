/**
 * One-time / repeat: read js/store.js, evaluate the PRODUCTS array literal, write data/catalog.json
 * Run from repo root: node tools/extract-products.cjs
 */
const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "..", "js", "store.js");
const outPath = path.join(__dirname, "..", "data", "catalog.json");
const src = fs.readFileSync(srcPath, "utf8");
const marker = src.includes("const PRODUCTS = ")
  ? "const PRODUCTS = "
  : src.includes("let PRODUCTS = ")
    ? "let PRODUCTS = "
    : null;
if (!marker) throw new Error("PRODUCTS array marker not found in js/store.js");
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
const literal = src.slice(arrStart, j);
let products;
try {
  products = new Function('"use strict"; return ' + literal)();
} catch (e) {
  console.error(e);
  throw new Error("Could not evaluate PRODUCTS literal");
}
if (!Array.isArray(products) || !products.length) throw new Error("PRODUCTS is not a non-empty array");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(products, null, 2), "utf8");
console.log("Wrote", products.length, "products to", path.relative(process.cwd(), outPath));
