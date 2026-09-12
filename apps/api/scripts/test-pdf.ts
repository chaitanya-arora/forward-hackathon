import { readFile } from "node:fs/promises";
import { chunkPages, extractPages } from "../src/pdf.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run -w @climate/api test-pdf -- <file.pdf>");
  process.exit(1);
}

const pages = await extractPages(await readFile(file));
const chunks = chunkPages(pages);
const nonEmpty = pages.filter((p) => p.text.length > 0);

console.log(`pages: ${pages.length} (${nonEmpty.length} with text)`);
console.log(`chunks: ${chunks.length}`);
console.log(`total chars: ${pages.reduce((n, p) => n + p.text.length, 0)}`);
console.log(`\n--- first page with text (p.${nonEmpty[0]?.page}) ---`);
console.log(nonEmpty[0]?.text.slice(0, 400));
