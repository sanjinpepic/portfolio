#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const INLINE_PATTERN = /<!-- START:inline\s+([^\s]+) -->[\s\S]*?<!-- END:inline\s+\1 -->/g;

async function buildIndex() {
  const indexPath = new URL("../index.html", import.meta.url);
  let indexHtml = await readFile(indexPath, "utf8");

  const matches = [...indexHtml.matchAll(INLINE_PATTERN)];
  if (matches.length === 0) {
    throw new Error("No inline markers found in index.html. Add <!-- START:inline path --> blocks first.");
  }

  for (const match of matches) {
    const [, partialPath] = match;
    const partialUrl = new URL(`../${partialPath}`, import.meta.url);
    const partialHtml = (await readFile(partialUrl, "utf8")).trim();
    const replacement = `<!-- START:inline ${partialPath} -->\n${partialHtml}\n<!-- END:inline ${partialPath} -->`;
    indexHtml = indexHtml.replace(match[0], replacement);
  }

  await writeFile(indexPath, indexHtml);
  console.log(`Inlined ${matches.length} partials into index.html`);
}

buildIndex().catch((error) => {
  console.error(`build-index failed: ${error.message}`);
  process.exitCode = 1;
});
