// The download button, the version line and the release notes, from latest.json beside this page: the
// same file the app reads to tell a newer MultiCut is out (desktop/scripts/write-feed.js writes it).
// Without latest.json (or without scripts) both buttons still work: they go to the latest release's page.
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

/** The .dmg's SHA-256 from the feed (64 hex characters, lower case), or "" when it has none. */
function checksumOf(feed) {
  const sha = feed && typeof feed.sha256 === "string" ? feed.sha256.trim().toLowerCase() : "";
  return /^[0-9a-f]{64}$/.test(sha) ? sha : "";
}

/** Under the button: the checksum, selected whole on a click, and Copy. */
function showChecksum(feed) {
  const sha = checksumOf(feed);
  const box = document.getElementById("checksum");
  if (!sha || !box) return;
  document.getElementById("checksum-value").textContent = sha;
  const copy = document.getElementById("checksum-copy");
  copy.addEventListener("click", () => {
    const done = (word) => {
      copy.textContent = word;
      setTimeout(() => (copy.textContent = "Copy"), 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(sha).then(() => done("Copied"), () => done("Select it to copy"));
    else done("Select it to copy");
  });
  box.hidden = false;
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
    /* no feed: the buttons keep their link to the latest release's page */
  }
  if (!usable(feed)) return;
  const button = document.getElementById("download");
  button.href = feed.url;
  const second = document.getElementById("download-2");
  if (second) second.href = feed.url;
  showMeta(feed);
  showChecksum(feed);
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
  // what a screen reader hears for the strip: the same numbers as the facts beside it
  document.getElementById("strip").setAttribute("aria-label", stripLabel(set));
  const caption = document.getElementById("set-caption");
  const words = setCaption(set);
  if (caption && words) caption.textContent = words;
  const facts = document.getElementById("set-facts");
  if (facts) facts.replaceChildren(...setFacts(set).map((p) => Object.assign(document.createElement("span"), { textContent: p })));
}

/** The facts beside the strip: the set's name, length, songs, drops and tempo. */
function setFacts(set) {
  return [set.name || "", clock(set.duration), `${(set.songs || []).length} songs`, `${(set.drops || []).length} drops`, set.bpm ? `${set.bpm} BPM` : ""].filter(Boolean);
}

/** The strip in words, from the same set as the facts (so the two never disagree). */
function stripLabel(set) {
  return `The set's ${(set.songs || []).length} songs as a strip across its ${Math.floor(set.duration / 60)} minutes, with its ${(set.drops || []).length} drops marked.`;
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

/**
 * Should the drop video be playing? Only while it is on screen, never against the visitor's wishes: not
 * after they paused it, and not by itself for people who asked for less motion (until they press Play).
 */
function videoShouldPlay({ visible, paused, reducedMotion, started }) {
  if (!visible || paused) return false;
  return !reducedMotion || !!started;
}

/**
 * The drop video. Nothing of it is fetched until it comes near the screen; it plays muted on a loop while
 * it is on screen and pauses when it leaves. Play/Pause and Sound are always there for everyone. Without
 * scripts the browser's own controls stay (the `controls` attribute in the page).
 */
function watch() {
  const video = document.getElementById("drop-video");
  const controls = document.getElementById("video-controls");
  const toggle = document.getElementById("playpause");
  const sound = document.getElementById("sound");
  if (!video || !controls || !toggle || !sound) return;
  const state = {
    visible: false,
    paused: false, // the visitor pressed Pause
    started: false, // the visitor pressed Play
    reducedMotion: !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  };
  video.controls = false;
  controls.hidden = false;
  const label = () => {
    toggle.textContent = video.paused ? "Play" : "Pause";
  };
  const apply = () => {
    if (videoShouldPlay(state)) video.play().catch(() => {});
    else video.pause();
  };
  video.addEventListener("play", label);
  video.addEventListener("pause", label);
  toggle.addEventListener("click", () => {
    if (video.paused) Object.assign(state, { paused: false, started: true, visible: true });
    else state.paused = true;
    apply();
  });
  sound.addEventListener("click", () => {
    video.muted = !video.muted;
    sound.setAttribute("aria-pressed", String(!video.muted));
    sound.textContent = video.muted ? "Sound on" : "Sound off";
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      state.visible = entries[entries.length - 1].isIntersecting;
      apply();
    }, { threshold: 0.35 }).observe(video);
  } else {
    state.visible = true;
    apply();
  }
  label();
}

if (typeof module !== "undefined") module.exports = { checksumOf, clock, formatSize, metaLine, noteItems, setCaption, setFacts, setStrip, stripLabel, usable, videoShouldPlay };
else {
  show();
  showSet();
  watch();
}
