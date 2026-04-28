import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const PRODUCTS_DIR = path.join(ROOT, "assets", "products");

const TARGET_W = 900;
const TARGET_H = 675; // 4:3

const SUPPORTED = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isSupportedImage(file) {
  return SUPPORTED.has(path.extname(file).toLowerCase());
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return String(n);
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

async function optimizeOne(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const before = await fs.stat(absPath);
  const input = await fs.readFile(absPath);

  // `contain` avoids cropping and keeps the full product visible; pad to 4:3 with white.
  let img = sharp(input, { failOn: "none" })
    .rotate()
    .resize(TARGET_W, TARGET_H, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: true
    });

  if (ext === ".jpg" || ext === ".jpeg") {
    img = img.jpeg({ quality: 82, mozjpeg: true });
  } else if (ext === ".png") {
    img = img.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else if (ext === ".webp") {
    img = img.webp({ quality: 82 });
  } else {
    return { skipped: true, reason: "unsupported" };
  }

  const out = await img.toBuffer();
  // Only write if meaningfully different (avoid touching mtimes unnecessarily)
  if (out.length === before.size) {
    return { written: false, before: before.size, after: out.length };
  }
  await fs.writeFile(absPath, out);
  return { written: true, before: before.size, after: out.length };
}

async function main() {
  const entries = await fs.readdir(PRODUCTS_DIR);
  const files = entries.filter(isSupportedImage).sort();

  if (!files.length) {
    console.log("No product images found in assets/products.");
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let written = 0;
  let skipped = 0;

  for (const f of files) {
    const abs = path.join(PRODUCTS_DIR, f);
    try {
      const res = await optimizeOne(abs);
      if (res?.skipped) {
        skipped += 1;
        continue;
      }
      totalBefore += res.before || 0;
      totalAfter += res.after || 0;
      if (res.written) written += 1;
      const delta = (res.after || 0) - (res.before || 0);
      const sign = delta === 0 ? "" : delta > 0 ? "+" : "";
      console.log(
        `${f.padEnd(46)} ${fmtBytes(res.before)} -> ${fmtBytes(res.after)} (${sign}${fmtBytes(
          Math.abs(delta)
        )})${res.written ? "" : " [unchanged]"}`
      );
    } catch (e) {
      console.warn(`WARN: ${f}: ${e && e.message ? e.message : String(e)}`);
    }
  }

  const saved = totalBefore - totalAfter;
  console.log("");
  console.log(`Processed: ${files.length} files`);
  console.log(`Written:   ${written}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Total:     ${fmtBytes(totalBefore)} -> ${fmtBytes(totalAfter)} (saved ${fmtBytes(saved)})`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

