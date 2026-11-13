#!/usr/bin/env node
/**
 * Renders the Log block in README.md from the Log's feed, dmedia.ai/feed.json?category=Log&limit=1
 * (JSON Feed 1.1; the newest Log post is its first item).
 *
 *   node scripts/render-readme.mjs                   # read the live feed
 *   node scripts/render-readme.mjs --from feed.json  # read a local copy
 *
 * The block sits between <!-- log:start --> and <!-- log:end -->; the rest of the README is written by hand.
 * When the feed cannot be read, README.md is left as it is and the exit code is 0: a quiet day is not a failure.
 */
import { readFileSync, writeFileSync } from "node:fs";

const README = new URL("../README.md", import.meta.url);
const START = "<!-- log:start -->";
const END = "<!-- log:end -->";
const FEED_URL = process.env.LOG_FEED_URL || "https://dmedia.ai/feed.json?category=Log&limit=1";
const LOG_URL = "https://dmedia.ai/category/Log";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const day = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

async function load() {
  const from = process.argv.indexOf("--from");
  try {
    if (from !== -1) return JSON.parse(readFileSync(process.argv[from + 1], "utf8"));
    const response = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(15000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.log(`The Log feed could not be read (${error.message}); README.md left as it is.`);
    return null;
  }
}

function block(item) {
  const month = item.title.replace(/^The Log:\s*/, "");
  const lines = [START, `### The Log · ${month}`, ""];
  if (item.image) lines.push(`[![${item.title}](${item.image})](${item.url})`, "");
  if (item.summary) lines.push(item.summary, "");
  lines.push(`[This month](${item.url}) · [Every month](${LOG_URL})`, "");
  const asOf = item.date_published ? `, as of ${day(item.date_published)}` : "";
  lines.push(`<sub>From [dmedia.ai/log](${LOG_URL})${asOf}. Public and private together.</sub>`, END);
  return lines.join("\n");
}

const feed = await load();
const item = feed?.items?.[0];
if (!item || typeof item.url !== "string" || typeof item.title !== "string") process.exit(0);

const readme = readFileSync(README, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error("README.md has no log:start and log:end markers.");
  process.exit(1);
}
const next = readme.slice(0, start) + block(item) + readme.slice(end + END.length);
if (next === readme) {
  console.log("README.md is current.");
} else {
  writeFileSync(README, next);
  console.log(`README.md updated for ${item.title.replace(/^The Log:\s*/, "")}.`);
}
