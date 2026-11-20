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

if (typeof module !== "undefined") module.exports = { formatSize, metaLine, noteItems, usable };
else show();
