#!/usr/bin/env node
/**
 * Renders the Log block in README.md from dmedia.ai/log/latest.json.
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
const FEED_URL = process.env.LOG_FEED_URL || "https://dmedia.ai/log/latest.json";
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

function block(feed) {
  const lines = [START, `### The Log · ${feed.weekLabel}`, ""];
  for (const [label, text] of [
    ["Shipped", feed.shipped],
    ["Built", feed.built],
    ["Served", feed.served],
  ]) {
    if (text) lines.push(`**${label}** · ${text}`, "");
  }
  if (feed.said) lines.push(`> ${feed.said}`, "");
  if (feed.count) {
    const { contributions, activeDays, daysCounted } = feed.count;
    const soFar = daysCounted < 7 ? " so far" : "";
    lines.push(
      `**${contributions.toLocaleString("en-US")} contributions** on GitHub this week, on ${activeDays} of ${daysCounted} days${soFar}. Public and private together; private work is counted, not named.`,
      "",
    );
  }
  const links = [`[This week](${feed.url})`, `[Every week](${feed.logUrl})`];
  if (feed.lastShipped) links.push(`Last shipped: [${feed.lastShipped.name}](${feed.lastShipped.url})`);
  const asOf = feed.calendarUpdated ? `, counts as of ${day(feed.calendarUpdated)}` : "";
  lines.push(links.join(" · "), "", `<sub>From [dmedia.ai/log](${feed.logUrl})${asOf}.</sub>`, END);
  return lines.join("\n");
}

const feed = await load();
if (!feed || !feed.week) process.exit(0);

const readme = readFileSync(README, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error("README.md has no log:start and log:end markers.");
  process.exit(1);
}
const next = readme.slice(0, start) + block(feed) + readme.slice(end + END.length);
if (next === readme) {
  console.log("README.md is current.");
} else {
  writeFileSync(README, next);
  console.log(`README.md updated for the week of ${day(feed.week)}.`);
}
