// The download button, the version line and the release notes, from latest.json beside this page: the
// same file the app reads to tell a newer MultiCut is out (desktop/scripts/write-feed.js writes it).
// No latest.json yet: the button stays "Coming soon".
"use strict";

/** A .dmg's size as the Finder says it: "556 MB", "1.2 GB" (decimal units). */
function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(n / 1e6))} MB`;
}

/** ["Version 0.1.0", "Apple silicon", "macOS 13 or later", "556 MB"]; without a feed, the Mac it needs. */
function metaParts(feed) {
  const parts = ["Apple silicon", "macOS 13 or later"];
  if (feed && typeof feed.version === "string") parts.unshift(`Version ${feed.version}`);
  const size = formatSize(feed && feed.size);
  if (size) parts.push(size);
  return parts;
}
const metaLine = (feed) => metaParts(feed).join(" · ");

/** The line under the button, each part kept whole when it wraps on a phone. */
function showMeta(feed) {
  const meta = document.getElementById("meta");
  meta.replaceChildren();
  metaParts(feed).forEach((part, i) => {
    if (i) meta.append(" · ");
    const span = document.createElement("span");
    span.className = "nowrap";
    span.textContent = part;
    meta.append(span);
  });
}

/** The feed, when it names a version and an https download. */
function usable(feed) {
  return !!feed && typeof feed.version === "string" && typeof feed.url === "string" && /^https:\/\//.test(feed.url);
}

async function show() {
  let feed = null;
  try {
    const res = await fetch("latest.json", { cache: "no-cache" });
    if (res.ok) feed = await res.json();
  } catch {
    /* no feed: Coming soon */
  }
  if (!usable(feed)) return;
  const button = document.getElementById("download");
  button.href = feed.url;
  const second = document.getElementById("download-2");
  if (second) second.href = feed.url;
  button.classList.remove("is-off");
  button.removeAttribute("aria-disabled");
  document.getElementById("download-label").textContent = "Download for Mac";
  showMeta(feed);
  const items = noteItems(feed);
  if (items.length) {
    document.getElementById("notes-title").textContent = `What's new in ${feed.version}`;
    const list = document.getElementById("notes-list");
    list.replaceChildren(...items.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    for (const el of document.querySelectorAll("[data-notes]")) el.hidden = false;
  }
}

/** The release's notes, one line per change: the feed's `items` (the same list as its release and the
 * app's What's New), else its one-line `notes`. */
function noteItems(feed) {
  if (Array.isArray(feed.items)) return feed.items.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  return typeof feed.notes === "string" && feed.notes.trim() ? [feed.notes.trim()] : [];
}

/** m:ss, for the set strip's scale and song names. */
function clock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * The set strip: a real set's songs as alternating bands and its drops as amber lines, from shots/set.json
 * (the same capture as the images, so it changes with them). Positions are fractions of the set's length.
 */
function setStrip(set) {
  if (!set || !(set.duration > 0)) return null;
  const x = (t) => Math.max(0, Math.min(1000, (t / set.duration) * 1000));
  const songs = (set.songs || []).map((s, i) => ({ x0: x(s.start), x1: x(s.end), cls: i % 2 ? "song-b" : "song-a", title: `${clock(s.start)} ${s.name}` }));
  const drops = (set.drops || []).map((t) => ({ x: x(t), title: `Drop at ${clock(t)}` }));
  const ticks = [];
  for (let m = 0; m * 60 <= set.duration; m += 10) ticks.push({ pct: (m * 60 / set.duration) * 100, label: `${m}:00` });
  return { songs, drops, ticks };
}

function drawSet(set) {
  const strip = setStrip(set);
  if (!strip) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, title) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (title) n.append(Object.assign(document.createElementNS(NS, "title"), { textContent: title }));
    return n;
  };
  const svg = el("svg", { viewBox: "0 0 1000 96", preserveAspectRatio: "none", "aria-hidden": "true" });
  for (const s of strip.songs) svg.append(el("rect", { x: s.x0, y: 0, width: Math.max(0, s.x1 - s.x0), height: 96, class: s.cls }, s.title));
  for (const d of strip.drops) {
    svg.append(el("rect", { x: d.x - 3, y: 0, width: 6, height: 96, class: "drop-glow" }));
    svg.append(el("rect", { x: d.x - 0.6, y: 0, width: 1.2, height: 96, class: "drop" }, d.title));
  }
  document.getElementById("strip").replaceChildren(svg);
  const scale = document.getElementById("strip-scale");
  scale.replaceChildren(...strip.ticks.map((t) => {
    const span = Object.assign(document.createElement("span"), { textContent: t.label });
    span.dataset.at = String(t.pct);
    return span;
  }));
  // positions without inline styles (the page's security policy allows none): the nearest 1 % class
  for (const span of scale.children) span.className = `at-${Math.round(Number(span.dataset.at))}`;
  const caption = document.getElementById("set-caption");
  const words = setCaption(set);
  if (caption && words) caption.textContent = words;
  const facts = document.getElementById("set-facts");
  if (facts) {
    const parts = [set.name || "", clock(set.duration), `${(set.songs || []).length} songs`, `${(set.drops || []).length} drops`, set.bpm ? `${set.bpm} BPM` : ""].filter(Boolean);
    facts.replaceChildren(...parts.map((p) => Object.assign(document.createElement("span"), { textContent: p })));
  }
}

/** The strip's caption from the set's own numbers: how long the analysis took and how many cuts it made. */
function setCaption(set) {
  if (!set || !(set.analysis_s > 0) || !(set.cuts > 0)) return "";
  const minutes = Math.max(1, Math.ceil(set.analysis_s / 60));
  return `Every song and drop above came from the audio alone, in under ${minutes} minutes on an Apple silicon Mac. Then ${set.cuts} cuts, each on a beat, in under a second.`;
}

async function showSet() {
  try {
    const res = await fetch("shots/set.json", { cache: "no-cache" });
    if (res.ok) drawSet(await res.json());
  } catch {
    /* the strip stays empty: the facts above it still read right */
  }
}

if (typeof module !== "undefined") module.exports = { clock, formatSize, metaLine, noteItems, setCaption, setStrip, usable };
else {
  show();
  showSet();
}
