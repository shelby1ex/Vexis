/* Vexis chat app (part A) - state, api, prefs, markdown, sessions, render. */
"use strict";

/* The 3 proven free models are the list. The engine catalog endpoint is never
   called (its /config/providers route hangs the runtime). */
let MODELS = [
  { providerID: "opencode", modelID: "big-pickle", name: "Big Pickle" },
  { providerID: "opencode", modelID: "muse-spark-1.3-contributor-free", name: "Muse Spark" },
  { providerID: "opencode", modelID: "mimo-v2.6-flash-free", name: "Mimo" },
];
const PROVEN_KEYS = [
  "opencode/big-pickle",
  "opencode/muse-spark-1.3-contributor-free",
  "opencode/mimo-v2.6-flash-free",
];
const DEFAULT_MODEL_KEY = "opencode/big-pickle";
/* Built-in theme gallery. Every theme declares a dark and a light palette
   (background, surface, accent, secondary accent). Single source of truth:
   the full CSS token set is generated from this array at boot
   (ensureThemeStyle), so JS and CSS can never drift apart. The palette is
   the same catalog the reference settings app shipped. */
const DEFAULT_THEME_ID = "shelby";
const THEMES = [
  {"id": "shelby", "name": "Shelby",
   "dark": {"bg": "#0a0a0c", "surface": "#16161a", "accent": "#e8e8ea", "accent2": "#c0c0c4"},
   "light": {"bg": "#f7f7f8", "surface": "#ffffff", "accent": "#2b2b30", "accent2": "#55555c"}},
  {"id": "vertex", "name": "Vertex",
   "dark": {"bg": "#0b0a14", "surface": "#16131f", "accent": "#8a6bff", "accent2": "#b18cff"},
   "light": {"bg": "#f8f7ff", "surface": "#ffffff", "accent": "#6a4ae8", "accent2": "#8a6bff"}},
  {"id": "matrix", "name": "Matrix",
   "dark": {"bg": "#000807", "surface": "#001009", "accent": "#00ff66", "accent2": "#39ffb0"},
   "light": {"bg": "#ecfff4", "surface": "#ffffff", "accent": "#00a343", "accent2": "#39ffb0"}},
  {"id": "cyber", "name": "Cyber",
   "dark": {"bg": "#04060f", "surface": "#0b0f1f", "accent": "#00e5ff", "accent2": "#7cffec"},
   "light": {"bg": "#f3fbff", "surface": "#ffffff", "accent": "#0096b3", "accent2": "#57e6ff"}},
  {"id": "ocean", "name": "Ocean",
   "dark": {"bg": "#041018", "surface": "#0a1c2b", "accent": "#4db8ff", "accent2": "#7fd0ff"},
   "light": {"bg": "#f2faff", "surface": "#ffffff", "accent": "#0087e0", "accent2": "#4db8ff"}},
  {"id": "crimson", "name": "Crimson",
   "dark": {"bg": "#120609", "surface": "#1d0d12", "accent": "#ff5c6c", "accent2": "#ff8a95"},
   "light": {"bg": "#fff7f8", "surface": "#ffffff", "accent": "#e03a4e", "accent2": "#ff5c6c"}},
  {"id": "sakura", "name": "Sakura",
   "dark": {"bg": "#140b12", "surface": "#21141d", "accent": "#ff9ecb", "accent2": "#ffc0de"},
   "light": {"bg": "#fff8fb", "surface": "#ffffff", "accent": "#e852ab", "accent2": "#ff9ecb"}},
  {"id": "emerald", "name": "Emerald",
   "dark": {"bg": "#021310", "surface": "#06251e", "accent": "#34d399", "accent2": "#5eead4"},
   "light": {"bg": "#f4fffb", "surface": "#ffffff", "accent": "#06996b", "accent2": "#34d399"}},
  {"id": "obsidian", "name": "Obsidian",
   "dark": {"bg": "#08070d", "surface": "#121020", "accent": "#a78bfa", "accent2": "#c4b5fd"},
   "light": {"bg": "#faf9ff", "surface": "#ffffff", "accent": "#8432e0", "accent2": "#a78bfa"}},
  {"id": "frost", "name": "Frost",
   "dark": {"bg": "#071018", "surface": "#0f1c2a", "accent": "#8fd0ff", "accent2": "#bfe6ff"},
   "light": {"bg": "#f4f9ff", "surface": "#ffffff", "accent": "#0a85dd", "accent2": "#8fd0ff"}},
  {"id": "terminal", "name": "Terminal",
   "dark": {"bg": "#060a05", "surface": "#0d130b", "accent": "#b8ffa0", "accent2": "#e0ffd0"},
   "light": {"bg": "#f7fff3", "surface": "#ffffff", "accent": "#479936", "accent2": "#b8ffa0"}},
  {"id": "neon", "name": "Neon",
   "dark": {"bg": "#0b0510", "surface": "#180c20", "accent": "#ff2eff", "accent2": "#00f0ff"},
   "light": {"bg": "#fef4ff", "surface": "#ffffff", "accent": "#c218d8", "accent2": "#00b8c9"}},
  {"id": "midnight", "name": "Midnight",
   "dark": {"bg": "#070a18", "surface": "#0f1428", "accent": "#94a3ff", "accent2": "#b8c4ff"},
   "light": {"bg": "#f5f7ff", "surface": "#ffffff", "accent": "#4353d6", "accent2": "#5666e8"}},
  {"id": "glass", "name": "Glass",
   "dark": {"bg": "#0b0b10", "surface": "#1a1a20", "accent": "#d6d6e0", "accent2": "#ffffff"},
   "light": {"bg": "#eef0f6", "surface": "#ffffff", "accent": "#3a3a44", "accent2": "#6a6a76"}},
  {"id": "graphite", "name": "Graphite",
   "dark": {"bg": "#0c0d0e", "surface": "#141517", "accent": "#9aa0a6", "accent2": "#c2c7cc"},
   "light": {"bg": "#f3f4f5", "surface": "#ffffff", "accent": "#55585c", "accent2": "#787d83"}},
  {"id": "techno", "name": "Techno",
   "dark": {"bg": "#041209", "surface": "#0a1f12", "accent": "#7ffbb0", "accent2": "#57e6ff"},
   "light": {"bg": "#f2fff8", "surface": "#ffffff", "accent": "#2fd4a5", "accent2": "#57e6ff"}},
  {"id": "sunset", "name": "Sunset",
   "dark": {"bg": "#14090f", "surface": "#201118", "accent": "#ffb25e", "accent2": "#ff7aa2"},
   "light": {"bg": "#fff9f2", "surface": "#ffffff", "accent": "#d84f73", "accent2": "#e8914f"}},
  {"id": "blue", "name": "Blue",
   "dark": {"bg": "#060a14", "surface": "#0b1424", "accent": "#3b82f6", "accent2": "#60a5fa"},
   "light": {"bg": "#f5f9ff", "surface": "#ffffff", "accent": "#1d4ed8", "accent2": "#3b82f6"}},
  {"id": "red", "name": "Red",
   "dark": {"bg": "#140607", "surface": "#210a0d", "accent": "#ef4444", "accent2": "#f87171"},
   "light": {"bg": "#fff7f7", "surface": "#ffffff", "accent": "#b91c1c", "accent2": "#ef4444"}},
  {"id": "green", "name": "Green",
   "dark": {"bg": "#04120a", "surface": "#0a1f12", "accent": "#22c55e", "accent2": "#4ade80"},
   "light": {"bg": "#f4fff8", "surface": "#ffffff", "accent": "#15803d", "accent2": "#22c55e"}},
  {"id": "purple", "name": "Purple",
   "dark": {"bg": "#0d0713", "surface": "#180d24", "accent": "#a855f7", "accent2": "#c084fc"},
   "light": {"bg": "#faf6ff", "surface": "#ffffff", "accent": "#9333ea", "accent2": "#a855f7"}},
  {"id": "pink", "name": "Pink",
   "dark": {"bg": "#13060d", "surface": "#200b17", "accent": "#ec4899", "accent2": "#f472b6"},
   "light": {"bg": "#fff7fb", "surface": "#ffffff", "accent": "#be185d", "accent2": "#ec4899"}},
  {"id": "cyan", "name": "Cyan",
   "dark": {"bg": "#041014", "surface": "#091c24", "accent": "#06b6d4", "accent2": "#22d3ee"},
   "light": {"bg": "#f3fcff", "surface": "#ffffff", "accent": "#0e7490", "accent2": "#06b6d4"}},
  {"id": "white", "name": "White",
   "dark": {"bg": "#ffffff", "surface": "#f4f5f7", "accent": "#111114", "accent2": "#3a3a44"},
   "light": {"bg": "#ffffff", "surface": "#f7f7f9", "accent": "#111114", "accent2": "#55555c"}}
];
function themeById(id) {
  for (const t of THEMES) if (t.id === id) return t;
  return THEMES[0];
}
function hasTheme(id) {
  return THEMES.some(function (t) { return t.id === id; });
}
/* "#rrggbb" -> [r, g, b]; tolerant of a missing '#'. */
function hexRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/* Perceived brightness -> pick readable foreground for any background. */
function isLightCol(hex) {
  const c = hexRgb(hex);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 150;
}
let PROVIDERS = null; // static stub set by loadModels (engine catalog unused)
const modelKey = (m) => (m ? m.providerID + "/" + m.modelID : "");
const provLabel = (id) => (id === "opencode" ? "Vexis runtime" : id);

function currentModel() {
  const k = S.prefs.modelKey || DEFAULT_MODEL_KEY;
  return MODELS.find(function (m) { return modelKey(m) === k; }) ||
    { providerID: k.split("/")[0] || "opencode", modelID: k.split("/")[1] || "big-pickle", name: k.split("/")[1] || k };
}

async function loadModels() {
  /* The engine's /config/providers route HANGS the runtime (same class of bug
     as /doc - verified by probing: process stays alive, listener dies, whole
     app goes dark). NEVER call it. The 3 proven free models are the list. */
  PROVIDERS = [{ id: "opencode", name: "Vexis runtime", models: {} }];
  return;
}

const IDENTITY = "You are Vexis, a friendly AI assistant living inside the Vexis app. " +
  "The Vexis runtime engine runs under the hood, but your name is Vexis and you " +
  "always introduce yourself as Vexis - never as OpenCode or any engine. " +
  "You have full access to this Windows machine: read, write and run commands anywhere " +
  "on disk using absolute paths (C:\\, E:\\ ...), not only inside the workspace folder. " +
  "When the user asks to create a project or files and does not name a location, ask them " +
  "where it should go; if they don't care, use their Desktop (C:\\Users\\<user>\\Desktop) - " +
  "never create projects inside the app workspace folder. " +
  "If a task will take more than 30 seconds (several tool calls, downloads, long runs), " +
  "post a short one-line status update between tool batches instead of going silent. " +
  "Throwaway test scripts and scratch files you create for your own testing go under " +
  "the system temp folder %TEMP%\\opencode (C:\\Users\\<user>\\AppData\\Local\\Temp\\opencode), " +
  "never inside the workspace or user project folders - clean them up when done. " +
  "The app has a right sidebar with three panels: Files (browses the workspace and any " +
  "file you create), Browser (previews websites and local HTML pages), and Todo (your " +
  "task list). That panel is where the user sees what you deliver: call the `vexis_show` " +
  "tool with a `path` (a file you made) or a `url` to put something in it, and it opens " +
  "automatically. Writing a file with an .html, .svg, .md, .pdf or image extension also " +
  "pushes it to the panel by itself, so the user watches your work land. Prefer " +
  "self-contained HTML files (inline CSS/JS) so they render directly in the Browser panel. " +
  "Keep answers concise unless the user asks for detail.";

const S = {
  prefs: { lang: "en", theme: "dark", accent: "teal", fontSize: 14, modelKey: DEFAULT_MODEL_KEY, routerFallback: "", sound: true, agent: "build",
    showThinking: false, showToolDetails: false, variantKey: "default", wideChat: false, reduceMotion: false,
    keys: { send: "enter", new: "ctrl+n", palette: "ctrl+p" } },
  dir: null, sessionID: null, sessions: [], messages: [],
  streaming: false, stopFlag: false, resending: false, attachments: [],
  shownPerms: new Set(), shownQuests: new Set(), secret: "",
  commands: null, revertID: null, sysCards: [], lastTodoStr: "", agents: null,
  artifacts: [], artId: null, artAuto: null, uiES: null,
};

const $ = (id) => document.getElementById(id);
const T = (k) => vexisT(S.prefs.lang, k);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/`/g, "&#96;");
/* image URLs come from the engine - only these schemes may become <img src> */
function safeImg(url) {
  const u = String(url || "");
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(u)) return u;
  return "";
}
/* Arabic-script replies render much larger (user request): the UI language
   flag can't detect message language, so tag bubbles by content instead */
function arCls(s) {
  return /[؀-ۿ]/.test(String(s || "")) ? " ar" : "";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* effective UI zoom from styles.css --ui-zoom (rects come back in visual px,
   JS-positioned overlays must convert back to zoomed world px) */
function uiZoom() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom"));
  return v > 0 ? v : 1;
}

/* ---------- inline icons (emoji-free UI) ---------- */
const IC = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  regen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
  thumbUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z"/><path d="M7 10l4.2-7a2 2 0 0 1 3.5 1.6L14 10h4.8a2 2 0 0 1 2 2.4l-1.4 6.4a2.4 2.4 0 0 1-2.3 1.9H7"/></svg>',
  thumbDown: '<svg class="flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z"/><path d="M7 10l4.2-7a2 2 0 0 1 3.5 1.6L14 10h4.8a2 2 0 0 1 2 2.4l-1.4 6.4a2.4 2.4 0 0 1-2.3 1.9H7"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.8.3-1.4.9-1.4 1.7v.4"/><circle cx="11.5" cy="16.8" r=".7" fill="currentColor"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.3 2.6 17.6A1.8 1.8 0 0 0 4.2 20.4h15.6a1.8 1.8 0 0 0 1.6-2.8L13.7 4.3a1.8 1.8 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.6" r=".7" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
};

async function api(method, path, body, ms) {
  /* hard timeout: the engine has routes that hang forever (/doc,
     /config/providers, ...) and fetch has no timeout by default - a hung
     endpoint must fail fast instead of freezing the UI forever */
  const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 60000) : null;
  try {
    const headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (S.secret && path.indexOf("/vexis/") === 0 && method !== "GET") {
      headers["X-Vexis-Secret"] = S.secret;
    }
    const r = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    });
  const txt = await r.text();
  if (!r.ok) throw new Error("HTTP " + r.status + " " + txt.slice(0, 200));
  return txt.trim() ? JSON.parse(txt) : null;
  } finally { if (timer) clearTimeout(timer); }
}
const GET = (p) => api("GET", p);
const POST = (p, b) => api("POST", p, b || {});
const DEL = (p) => api("DELETE", p);

async function workspaceDir() {
  if (!S.dir) {
    if (S.prefs.projDir) {
      S.dir = S.prefs.projDir;
    } else {
      const loc = await GET("/api/location");
      S.dir = (loc && loc.directory) || "";
    }
  }
  return S.dir;
}
/* sidebar Projects view: every directory with sessions, from the engine */
async function renderProjects() {
  const nav = $("sessions");
  nav.innerHTML = "";
  let all = [];
  try {
    const out = await GET("/session?limit=200");
    all = Array.isArray(out) ? out : ((out && out.data) || []);
  } catch (e) {
    nav.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 10px">' +
      esc(T("errLoad")) + "</div>";
    return;
  }
  const groups = {};
  all.forEach(function (s) {
    const d = s.directory || "";
    if (!d) return;
    if (!groups[d]) groups[d] = { dir: d, n: 0, last: 0, title: "" };
    groups[d].n++;
    const t = ((s.time || {}).updated) || ((s.time || {}).created) || 0;
    if (t >= groups[d].last) { groups[d].last = t; groups[d].title = s.title || ""; }
  });
  const arr = Object.keys(groups).map(function (k) { return groups[k]; })
    .sort(function (a, b) { return b.last - a.last; });
  if (!arr.length) {
    nav.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 10px">' +
      esc(T("noSession")) + "</div>";
    return;
  }
  arr.forEach(function (g) {
    const b = document.createElement("button");
    b.className = "chat-item" + (g.dir === S.dir ? " active" : "");
    const t = document.createElement("span");
    t.className = "chat-item-title";
    const base = g.dir.replace(/\\/g, "/").split("/").filter(Boolean).pop() || g.dir;
    t.textContent = base + " (" + g.n + ")";
    t.title = g.dir + (g.title ? " — " + g.title : "");
    b.appendChild(t);
    b.onclick = function () {
      S.dir = g.dir; S.prefs.projDir = g.dir; savePrefs();
      newChat();
      loadSessions("").catch(function () {});
    };
    nav.appendChild(b);
  });
}
function setSideView(v) {
  S.sideView = v;
  document.querySelectorAll("#sideSeg button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.side === v);
  });
  if (v === "projects") renderProjects().catch(function () {});
  else loadSessions($("search").value.trim()).catch(function () {});
}
const qdir = () => "?directory=" + encodeURIComponent(S.dir || "");

function loadPrefs() {
  try { Object.assign(S.prefs, JSON.parse(localStorage.getItem("vexis-prefs") || "{}")); } catch (e) {}
  if (!VEXIS_I18N[S.prefs.lang]) S.prefs.lang = "en";
  /* v3: English is the default language - one-time migration of old prefs */
  if (S.prefs.langV !== 3) { S.prefs.lang = "en"; S.prefs.langV = 3; }
  if (typeof S.prefs.sbCollapsed !== "boolean") S.prefs.sbCollapsed = false;
  if (S.prefs.theme === "dark") S.prefs.theme = "black";
  if (S.prefs.theme !== "black" && S.prefs.theme !== "light") S.prefs.theme = "black";
  /* corrupted localStorage must never produce "undefinedpx" */
  let fsz = parseInt(S.prefs.fontSize, 10);
  if (!isFinite(fsz)) fsz = 14;
  S.prefs.fontSize = Math.min(18, Math.max(12, fsz));
  // old builds stored a numeric index (the picker was broken, so it was never
  // a real choice) - migrate everyone to the Big Pickle default (fast).
  if (!S.prefs.modelKey || typeof S.prefs.modelKey !== "string") S.prefs.modelKey = DEFAULT_MODEL_KEY;
  // one-time migration: Muse Spark answers noticeably slower - move stored
  // default over to Big Pickle; later manual picks are never overridden.
  if (S.prefs.modelV !== 2) {
    if (S.prefs.modelKey === "opencode/muse-spark-1.3-contributor-free") S.prefs.modelKey = DEFAULT_MODEL_KEY;
    S.prefs.modelV = 2;
  }
  if (!S.prefs.agent || typeof S.prefs.agent !== "string") S.prefs.agent = "build";
  if (!S.prefs.keys || typeof S.prefs.keys !== "object") S.prefs.keys = { send: "enter", new: "ctrl+n", palette: "ctrl+p" };
  const kd = S.prefs.keys;
  if (kd.send !== "ctrlenter") kd.send = "enter";
  if (["ctrl+n", "none"].indexOf(kd.new) < 0) kd.new = "ctrl+n";
  if (["ctrl+p", "ctrl+k", "none"].indexOf(kd.palette) < 0) kd.palette = "ctrl+p";
  if (typeof S.prefs.variantKey !== "string") S.prefs.variantKey = "default";
  if (typeof S.prefs.accent !== "string" || !hasTheme(S.prefs.accent)) S.prefs.accent = DEFAULT_THEME_ID;
  S.prefs.accent = themeById(S.prefs.accent).id;
  /* sidebar was reorganised: drop tabs that no longer exist */
  if (["files", "browser", "todo"].indexOf(S.prefs.rsbTab) < 0) S.prefs.rsbTab = "files";
  if (typeof S.prefs.wideChat !== "boolean") S.prefs.wideChat = false;
  if (typeof S.prefs.reduceMotion !== "boolean") S.prefs.reduceMotion = false;
  if (typeof S.prefs.routerFallback !== "string") S.prefs.routerFallback = "";
}
/* Full theme token set generated from THEMES so JS and CSS can never drift.
   Each theme (and its light variant) overrides the whole canvas: background,
   surfaces, borders, text and accent - all derived from the palette. */
let _thBuilt = "";
function themeTokens(p) {
  const bg = p.bg, surf = p.surface, acc = p.accent, acc2 = p.accent2 || p.accent;
  const on = isLightCol(bg);
  const ink = on ? "17,17,20" : "240,240,245";
  const r = hexRgb(acc);
  return {
    "--bg": bg,
    "--bg-elevated": surf,
    "--surface-solid": surf,
    "--surface": "rgba(" + ink + ",.045)",
    "--surface-hover": "rgba(" + ink + ",.08)",
    "--border": "rgba(" + ink + ",.12)",
    "--text": on ? "#111114" : "#f0f0f5",
    "--text-dim": "rgba(" + ink + ",.66)",
    "--text-faint": "rgba(" + ink + ",.45)",
    "--accent": acc,
    "--accent-2": acc2,
    "--accent-contrast": isLightCol(acc) ? "#0a0a0c" : "#ffffff",
    "--acc": acc,
    "--acc-rgb": r.join(","),
  };
}
function ensureThemeStyle() {
  const css = THEMES.map(function (t) {
    const rule = function (sel, pal) {
      const o = themeTokens(pal);
      return sel + "{" + Object.keys(o).map(function (k) {
        return k + ":" + o[k] + ";";
      }).join("") + "}";
    };
    return rule('html[data-mode="dark"][data-acc="' + t.id + '"]', t.dark) +
      rule('html[data-mode="light"][data-acc="' + t.id + '"]', t.light);
  }).join("\n");
  if (css === _thBuilt) return;
  _thBuilt = css;
  let el = document.getElementById("vexis-theme");
  if (!el) {
    el = document.createElement("style");
    el.id = "vexis-theme";
    document.head.appendChild(el);
  }
  el.textContent = css;
}
function syncThemeGallery() {
  const grid = $("themeGallery");
  if (!grid) return;
  Array.prototype.forEach.call(grid.children, function (c) {
    c.classList.toggle("active", c.dataset.themeVal === S.prefs.accent);
  });
}
/* hex (#rrggbb) -> rgba(): the gallery preview paints the theme accent at three
   opacities without relying on colour-mix() support */
function hexA(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return hex || "transparent";
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
function buildThemeGallery() {
  const grid = $("themeGallery");
  if (!grid || grid.children.length) return;
  THEMES.forEach(function (t) {
    const p = t.dark;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "theme-card";
    card.dataset.themeVal = t.id;
    card.title = t.name;
    /* thumbnail layout ported from the reference theme gallery: the mini window
       sits on the right (accent border + two bars), accent dot bottom-left */
    card.innerHTML =
      '<span class="theme-card-preview" style="background:' + p.bg + '">' +
        '<span class="theme-preview-window" style="background:' + p.surface +
          ';border-color:' + hexA(p.accent, .45) + '">' +
          '<span class="theme-preview-dot" style="background:' + p.accent + '"></span>' +
          '<span class="theme-preview-bar" style="background:' + hexA(p.accent, .7) + '"></span>' +
          '<span class="theme-preview-bar" style="background:' + hexA(p.accent, .35) + '"></span>' +
        "</span>" +
        '<span class="theme-preview-accent" style="background:' + p.accent + '"></span>' +
      "</span>" +
      '<span class="theme-card-name">' + esc(t.name) + "</span>" +
      '<span class="theme-apply-btn" data-i18n="applyTheme">Appliquer</span>';
    card.onclick = function () {
      S.prefs.accent = t.id;
      savePrefs(); applyPrefs();
    };
    grid.appendChild(card);
  });
  syncThemeGallery();
}
/* composer agent switcher: only the engine's PRIMARY agents (Build / Plan) are
   offered - sub agents are invoked by the model itself, not chosen by hand. */
const FALLBACK_AGENTS = [
  { name: "build", mode: "primary" },
  { name: "plan", mode: "primary" },
];
function agentLabel(name) {
  const s = String(name || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
async function loadAgents() {
  try {
    const list = await GET("/agent");
    const arr = Array.isArray(list) ? list : ((list && list.data) || []);
    const prim = arr.filter(function (a) { return a && a.mode === "primary" && !a.hidden; });
    if (prim.length) {
      S.agents = prim.map(function (a) {
        return { name: a.name, mode: a.mode, description: a.description || "" };
      });
    }
  } catch (e) {}
  if (!S.agents || !S.agents.length) S.agents = FALLBACK_AGENTS.slice();
  if (S.agents.every(function (a) { return a.name !== S.prefs.agent; })) {
    S.prefs.agent = S.agents.some(function (a) { return a.name === "build"; })
      ? "build" : S.agents[0].name;
    savePrefs();
  }
  buildAgentSwitch();
}
function syncAgentSwitch() {
  const box = $("agentSwitch");
  if (!box) return;
  const lbl = $("agent-picker-label");
  if (lbl) lbl.textContent = agentLabel(S.prefs.agent);
  const list = $("agent-list");
  if (list) {
    Array.prototype.forEach.call(list.children, function (b) {
      b.classList.toggle("active", b.dataset.agent === S.prefs.agent);
    });
  }
  /* legacy segmented chips (kept in sync if they are ever rendered) */
  Array.prototype.forEach.call(box.querySelectorAll(".agent-chip"), function (b) {
    b.classList.toggle("on", b.dataset.agent === S.prefs.agent);
  });
}
function buildAgentSwitch() {
  const box = $("agentSwitch");
  if (!box) return;
  const list = $("agent-list");
  if (list) {
    list.innerHTML = "";
    (S.agents && S.agents.length ? S.agents : FALLBACK_AGENTS).forEach(function (a) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "model-picker-item";
      b.dataset.agent = a.name;
      b.title = a.description || a.name;
      const wrap = document.createElement("span");
      const nm = document.createElement("b");
      nm.textContent = agentLabel(a.name);
      const sub = document.createElement("small");
      sub.textContent = a.description || a.name;
      wrap.appendChild(nm); wrap.appendChild(sub);
      b.appendChild(wrap);
      b.onclick = function () {
        S.prefs.agent = a.name;
        savePrefs();
        syncAgentSwitch();
        closeMenus();
      };
      list.appendChild(b);
    });
  }
  syncAgentSwitch();
}
function savePrefs() {
  try { localStorage.setItem("vexis-prefs", JSON.stringify(S.prefs)); } catch (e) {}
}
function applyPrefs() {
  // theme gallery: every theme carries a dark + light palette; the mode
  // toggle (light/dark) picks which one. The canvas colors are set inline:
  // bulletproof against the vendor cascade.
  const light = S.prefs.theme === "light";
  const th = themeById(S.prefs.accent);
  const pal = light ? th.light : th.dark;
  document.documentElement.dataset.theme = light ? "white" : "black";
  document.documentElement.dataset.mode = light ? "light" : "dark";
  document.documentElement.dataset.acc = th.id;
  document.documentElement.dataset.wide = S.prefs.wideChat ? "1" : "0";
  document.documentElement.dataset.rm = S.prefs.reduceMotion ? "1" : "0";
  ensureThemeStyle();
  document.body.style.backgroundColor = pal.bg;
  document.body.style.color = isLightCol(pal.bg) ? "#111114" : "#EBEBEB";
  document.documentElement.style.setProperty("--fs", S.prefs.fontSize + "px");
  document.documentElement.lang = S.prefs.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = T(el.dataset.i18nPh); });
  const mlabel = $("model-picker-label");
  if (mlabel) mlabel.textContent = currentModel().name;
  const sl = $("set-lang");
  if (sl) sl.value = S.prefs.lang;
  const st = $("set-theme");
  if (st) st.value = S.prefs.theme;
  const sf = $("set-fontsize");
  if (sf) sf.value = S.prefs.fontSize;
  const ss = $("set-sound");
  if (ss) ss.checked = !!S.prefs.sound;
  const sth = $("set-thinking");
  if (sth) sth.checked = !!S.prefs.showThinking;
  const sdt = $("set-details");
  if (sdt) sdt.checked = !!S.prefs.showToolDetails;
  const sm = $("set-model");
  if (sm) sm.value = String(Math.max(0, MODELS.findIndex(function (m) { return modelKey(m) === S.prefs.modelKey; })));
  const fv = $("fontVal");
  if (fv) fv.textContent = String(S.prefs.fontSize);
  const sw = $("set-wide");
  if (sw) sw.checked = !!S.prefs.wideChat;
  const rm = $("set-motion");
  if (rm) rm.checked = !!S.prefs.reduceMotion;
  syncThemeSeg();
  buildThemeGallery(); syncThemeGallery();
}
function syncThemeSeg() {
  document.querySelectorAll("#themeSeg button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.themeVal === S.prefs.theme);
  });
}
function beep() {
  if (!S.prefs.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 660; g.gain.value = 0.12;
    o.start(); o.stop(ctx.currentTime + 0.14);
  } catch (e) {}
}

function highlight(code) {
  let h = esc(code);
  const bank = [];
  h = h.replace(/(&quot;.*?&quot;)/g, function (m) { bank.push(m); return "\u0001" + (bank.length - 1) + "\u0001"; });
  h = h.replace(/(^|\n)(\s*)(#[^\n]*|\/\/[^\n]*|--[^\n]*)/g, "$1$2\u0002$3\u0002");
  h = h.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|try|catch|async|await|def|elif|except|with|as|pass|None|True|False|in|is|not|and|or|do|end|then|local|echo|fi)\b/g, "\u0003$1\u0003");
  h = h.replace(/\u0001(\d+)\u0001/g, function (_, i) { return '<span class="s">' + bank[+i] + "</span>"; })
       .replace(/\u0002([\s\S]*?)\u0002/g, '<span class="c">$1</span>')
       .replace(/\u0003([\s\S]*?)\u0003/g, '<span class="k">$1</span>');
  return h;
}
function md(src) {
  const trimmed = String(src || "").trim();
  if (/^https?:\/\/\S+$/.test(trimmed)) return linkCardHTML(trimmed);
  const blocks = [];
  let h = esc(src).replace(/```(\w*)\n([\s\S]*?)(```|$)/g, function (_, lang, code) {
    blocks.push({ lang: lang || "code", code: code.replace(/\n$/, "") });
    return "\u0000" + (blocks.length - 1) + "\u0000";
  });
  h = h.replace(/`([^`\n]+)`/g, "<code class=\"inl\">$1</code>")
       .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
       .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m0, pre, url) {
         return pre + '<a class="lnk" href="' + url + '" target="_blank" rel="noopener">' + url + "</a>";
       })
       .replace(/\n/g, "<br>");
  h = h.replace(/\u0000(\d+)\u0000/g, function (_, i) {
    const b = blocks[+i];
    return '<div class="codeblock"><div class="chead"><span>' + esc(b.lang) +
      '</span><button data-copycode="' + i + '">' + esc(T("copy")) +
      "</button></div><pre>" + highlight(b.code) + "</pre></div>";
  });
  return h;
}

function sessTitle(s) {
  const t = (s && (s.title || s.summary)) || "";
  if (t && !/^new session/i.test(t)) return t;
  const ts = (s && s.time && (s.time.updated || s.time.created)) || 0;
  return ts ? new Date(ts).toLocaleString(S.prefs.lang) : T("newChat");
}
async function loadSessions(search) {
  await workspaceDir();
  let p = "/session" + qdir() + "&limit=50";
  if (search) p += "&search=" + encodeURIComponent(search);
  const list = await GET(p);
  S.sessions = Array.isArray(list) ? list : ((list && list.data) || []);
  renderSessions();
}
function renderSessions() {
  const nav = $("sessions");
  nav.innerHTML = "";
  if (!S.sessions.length) {
    nav.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 10px">' +
      esc(T("noSession")) + "</div>";
    return;
  }
  for (const s of S.sessions) {
    const b = document.createElement("button");
    b.className = "chat-item" + (s.id === S.sessionID ? " active" : "");
    const t = document.createElement("span");
    t.className = "chat-item-title"; t.textContent = sessTitle(s); t.title = sessTitle(s);
    const del = document.createElement("button");
    del.className = "chat-item-del"; del.innerHTML = IC.x; del.title = T("delete");
    del.onclick = function (e) { e.stopPropagation(); askDelete(s.id); };
    b.append(t, del);
    b.onclick = function () { openSession(s.id); };
    nav.appendChild(b);
  }
}
async function newChat() {
  S.sessionID = null; S.messages = []; S.attachments = [];
  S.revertID = null; S.sysCards = []; S.lastTodoStr = "";
  S.shownPerms = new Set(); S.shownQuests = new Set();
  renderChat(); renderSysCards(); renderSessions();
  $("session-title").textContent = "Vexis";
  $("welcome").classList.remove("hidden");
}
async function ensureSession(firstText) {
  if (S.sessionID) return S.sessionID;
  await workspaceDir();
  const title = (firstText || "").trim().slice(0, 60) || "Vexis chat";
  const s = await POST("/session" + qdir(), { title });
  S.sessionID = s.id;
  $("welcome").classList.add("hidden");
  loadSessions($("search").value.trim()).catch(function () {});
  return S.sessionID;
}
async function openSession(id) {
  S.sessionID = id; S.attachments = [];
  S.revertID = null; S.sysCards = []; S.lastTodoStr = "";
  renderSysCards();
  $("welcome").classList.add("hidden");
  await loadMessages();
  renderSessions();
  checkTodoCard().catch(function () {});
  restorePendingCards().catch(function () {});
}
async function loadMessages() {
  let msgs = await GET("/session/" + S.sessionID + "/message?limit=200");
  S.messages = Array.isArray(msgs) ? msgs : ((msgs && msgs.data) || []);
  renderChat();
  try {
    const info = await GET("/session/" + S.sessionID);
    S.revertID = (info && info.revert && info.revert.messageID) || null;
    $("session-title").textContent = sessTitle(info);
    if (S.revertID) renderChat();
  } catch (e) {}
}
let confirmCb = null;
function askDelete(id) {
  $("confirm-text").textContent = T("confirmDelete");
  $("confirm-modal").classList.add("open");
  confirmCb = function () {
    return api("DELETE", "/session/" + id).then(function () {
      if (id === S.sessionID) return newChat();
      loadSessions($("search").value.trim()).catch(function () {});
    });
  };
}
function fmtTime(ms) {
  if (!ms) return "";
  try { return new Date(ms).toLocaleString(S.prefs.lang, { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}
function msgTime(m) {
  const t = (m.info && m.info.time) || {};
  return fmtTime(t.created || t.updated);
}
function messageText(m) {
  return (m.parts || []).filter(function (p) { return p.type === "text" && p.text; })
    .map(function (p) { return p.text; }).join("\n");
}
function toolTitle(tool, st) {
  st = st || {};
  const inp = st.input || {};
  const t = String(tool || "");
  if (t === "write" || t === "edit") {
    const fp = String(inp.filePath || inp.path || "").replace(/\\/g, "/").split("/").pop() || t;
    return (t === "write" ? "Writing " : "Editing ") + fp;
  }
  if (t === "read") {
    const fp = String(inp.filePath || inp.path || "").replace(/\\/g, "/").split("/").pop();
    return "Reading " + (fp || "file");
  }
  if (t === "bash") {
    const cmd = String(inp.command || inp.cmd || "").trim();
    return cmd ? "Running `" + cmd.slice(0, 120) + "`" : "Running command";
  }
  return st.title || t.replace(/_/g, " ") || T("toolLabel");
}
/* ---------- component library: links / thinking / chips ---------- */
function linkCardHTML(url) {
  let host = url;
  try { host = new URL(url).hostname; } catch (e) {}
  return '<a class="link-card" href="' + esc(url) + '" target="_blank" rel="noopener">' +
    '<img class="lc-fav" src="https://www.google.com/s2/favicons?domain=' + esc(host) + '&sz=64" alt="" ' +
    'onerror="this.style.display=\'none\'" />' +
    '<span class="lc-text"><span class="lc-host">' + esc(host) + "</span>" +
    '<span class="lc-url">' + esc(url) + "</span></span>" +
    '<span class="lc-arrow">' + IC.arrowUpRight + '</span></a>';
}
/* ---------- Thinking UI: ThinkingIndicator / ThinkingSummary / ThinkingDetails ----------
   Privacy: only short, user-safe activity summaries are ever rendered.
   Raw reasoning / chain-of-thought / internal tokens are NEVER displayed. */
function toolThinkType(tool) {
  const t = String(tool || "");
  if (t === "webfetch" || t === "websearch" || t === "grep" || t === "glob") return "searching";
  if (t === "read" || t === "list") return "reading";
  if (t === "bash") return "running";
  if (t === "browser" || t === "playwright" || t === "screenshot") return "preview";
  return "working";
}
/* short subject for the live line: file name / command snippet / query */
function toolDetail(tool, st) {
  st = st || {};
  const inp = st.input || {};
  const t = String(tool || "");
  if (t === "read" || t === "write" || t === "edit") {
    const fp = String(inp.filePath || inp.path || "").replace(/\\/g, "/").split("/").pop();
    if (fp) return fp;
  }
  if (t === "bash") {
    const c = String(inp.command || inp.cmd || "").trim();
    if (c) return "`" + c.slice(0, 40) + (c.length > 40 ? "…" : "") + "`";
  }
  if (t === "websearch" || t === "webfetch") {
    const q = String(inp.query || inp.url || "");
    if (q) return q.slice(0, 40);
  }
  return t ? t.replace(/_/g, " ") : "";
}
const THINK_LIVE = {
  thinking: function () { return T("thinking"); },
  generating: function () { return T("generating"); },
  working: function () { return T("working"); },
  searching: function () { return T("liveSearching"); },
  reading: function () { return T("liveReading"); },
  running: function () { return T("liveRunning"); },
  preview: function () { return T("livePreview"); },
};
/* ThinkingIndicator: the subtle inline status line shown while generating. */
function thinkingIndicatorHTML(activityType) {
  const label = (THINK_LIVE[activityType] || THINK_LIVE.thinking)();
  return '<div class="think-line think-live" role="status" aria-live="polite">' +
    '<span class="ti-glyph" aria-hidden="true">◇</span>' +
    '<span class="ti-label">' + esc(label) + "</span>" +
    '<span class="ti-elapsed" aria-hidden="true"></span>' +
    '<span class="ti-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>';
}
/* elapsed-time tick for the live activity line (starts on send, stops when done) */
let TI_TICK = null, TI_START = 0;
function tiPaint() {
  const s = TI_START ? Math.floor((Date.now() - TI_START) / 1000) : 0;
  const txt = s >= 5 ? (s < 60 ? " · " + s + "s" : " · " + Math.floor(s / 60) + "m " + (s % 60) + "s") : "";
  document.querySelectorAll(".think-live .ti-elapsed").forEach(function (el) {
    if (el.textContent !== txt) el.textContent = txt;
  });
}
function tiStart() {
  TI_START = Date.now();
  if (!TI_TICK) TI_TICK = setInterval(tiPaint, 1000);
  tiPaint();
}
function tiStop() {
  if (TI_TICK) { clearInterval(TI_TICK); TI_TICK = null; }
  TI_START = 0;
}
/* ThinkingDetails: expanded list of safe high-level activity summaries. */
function thinkingDetailsHTML(items) {
  return items.map(function (k) {
    return '<div class="think-item"><span class="ti-bullet" aria-hidden="true">·</span>' +
      "<span>" + esc(T(k)) + "</span></div>";
  }).join("");
}
/* ThinkingSummary: "◇ Thought for 2.4s ˅" - click to expand details. */
function thinkingSummaryHTML(model, open) {
  let label;
  if (model && model.duration != null) label = T("thoughtFor").replace("{t}", String(model.duration));
  else label = T("thoughtLabel");
  const items = (model && model.activityItems) || [];
  return '<details class="think-done"' + (open ? " open" : "") + ">" +
    '<summary class="think-line">' +
      '<span class="ti-glyph" aria-hidden="true">◇</span>' +
      '<span class="ti-label">' + esc(label) + "</span>" +
      '<span class="ts-chev" aria-hidden="true">⌄</span>' +
    "</summary>" +
    '<div class="think-details">' + thinkingDetailsHTML(items) + "</div></details>";
}
/* thinkModel: derives activity items + duration from message parts (no reasoning text). */
function thinkModel(parts, info) {
  let hadReasoning = false, hadTool = false;
  const items = [];
  const push = function (key) { if (items.indexOf(key) === -1) items.push(key); };
  for (const p of parts || []) {
    if (p.type === "reasoning" && (p.text || "").trim()) hadReasoning = true;
    else if (p.type === "tool") {
      hadTool = true;
      const t = String(p.tool || "");
      if (t === "webfetch" || t === "websearch" || t === "grep" || t === "glob") push("actSearch");
      else if (t === "read" || t === "list") push("actRead");
      else if (t === "bash") push("actRun");
      else if (t === "write" || t === "edit" || t === "patch") push("actUpdate");
      else push("actTool");
    }
  }
  if (!hadReasoning && !hadTool) return null;
  const out = [];
  if (hadReasoning) out.push("actUnderstand");
  out.push.apply(out, items);
  out.push("actPrepare");
  const t = (info && info.time) || {};
  const duration = (t.created && t.completed && t.completed >= t.created)
    ? ((t.completed - t.created) / 1000).toFixed(1) : null;
  return { activityItems: out, duration: duration, hadReasoning: hadReasoning, hadTool: hadTool };
}
/* Unified component API (props: isThinking, isComplete, isExpanded,
   activityItems, duration, activityType). */
const ThinkingBlock = {
  indicator: thinkingIndicatorHTML,
  summary: thinkingSummaryHTML,
  details: thinkingDetailsHTML,
  render: function (props) {
    props = props || {};
    if (props.isThinking) return ThinkingBlock.indicator(props.activityType || "thinking");
    if (props.isComplete) {
      const items = props.activityItems || [];
      if (!items.length) return "";
      return ThinkingBlock.summary({ activityItems: items, duration: props.duration },
        !!props.isExpanded);
    }
    return "";
  },
};
/* update/hide the live indicator inside the streaming activity box. */
function updateThinking(actBox, activityType, tool, st) {
  if (!actBox) return;
  let el = actBox.querySelector(".think-live");
  if (!el) {
    const tpl = document.createElement("div");
    tpl.innerHTML = thinkingIndicatorHTML(activityType || "thinking");
    actBox.insertBefore(tpl.firstElementChild, actBox.firstChild);
    return;
  }
  let label = (THINK_LIVE[activityType] || THINK_LIVE.thinking)();
  if (tool) {
    const det = toolDetail(tool, st);
    if (det) label += " · " + det;
  }
  const lab = el.querySelector(".ti-label");
  if (lab && lab.textContent !== label) lab.textContent = label;
}
function chipsHTML(atts) {
  if (!atts || !atts.length) return "";
  return '<div class="chip-row">' + atts.map(function (a) {
    if (String(a.mime || "").indexOf("image/") === 0) {
      return '<span class="chip img-chip"><img src="' + esc(a.dataUrl) + '" alt="' + esc(a.name) + '" /></span>';
    }
    return '<span class="chip file-chip"><span class="chip-ic">' + IC.clip + "</span>" + esc(a.name) + "</span>";
  }).join("") + "</div>";
}
function userTextHTML(text) {
  return esc(text)
    .replace(/@([\w./\\-]+)/g, '<span class="chip mention-chip">@$1</span>')
    .replace(/\n/g, "<br>");
}
function scrollChat(force) {
  const w = $("chat-wrap");
  if (force || (w.scrollHeight - w.scrollTop - w.clientHeight) < 120) {
    w.scrollTop = w.scrollHeight;
  }
}
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).catch(function () { fallbackCopy(t); });
  } else fallbackCopy(t);
  function fallbackCopy(x) {
    const ta = document.createElement("textarea");
    ta.value = x; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
}
/* msgDone: a message is finished when the engine stamped completion or when
   every part reports completed (the engine sometimes omits time.completed). */
function msgDone(m) {
  const info = (m && m.info) || {};
  if (info.time && info.time.completed) return true;
  const parts = (m && m.parts) || [];
  return parts.length > 0 && parts.every(function (p) {
    return (p.state || {}).status === "completed";
  });
}
/* ---------- opencode-style step rows: Thinking… / Shell… / Edit… / WebFetch… › --- */
function stepMeta(p) {
  const st = p.state || {};
  const inp = st.input || {};
  const t = String(p.tool || "");
  const fpOf = function (v) { const s = String(v || "").replace(/\\/g, "/"); return s.split("/").pop() || s; };
  if (p.type === "reasoning" || p.type === "thinking") return { kind: "think", label: T("stepThink") };
  if (t === "bash" || t === "shell") return { kind: "shell", label: T("stepShell"),
    sum: String(inp.command || inp.cmd || "").replace(/\s+/g, " ").slice(0, 90) };
  if (t === "edit" || t === "write" || t === "patch" || t === "apply_patch")
    return { kind: "edit", label: T("stepEdit"), sum: fpOf(inp.filePath || inp.path) };
  if (t === "webfetch") return { kind: "fetch", label: T("stepFetch"), sum: String(inp.url || "").slice(0, 90) };
  if (t === "websearch") return { kind: "search", label: T("stepSearch"), sum: String(inp.query || "").slice(0, 90) };
  if (t === "grep" || t === "glob") return { kind: "search", label: T("stepSearch"), sum: String(inp.pattern || inp.query || "").slice(0, 90) };
  if (t === "read" || t === "list") return { kind: "read", label: T("stepRead"), sum: fpOf(inp.filePath || inp.path) };
  if (t === "todowrite" || t === "todo") return { kind: "todo", label: T("stepTodo"), sum: "" };
  if (t === "task") return { kind: "task", label: T("stepTask"), sum: String(inp.description || inp.prompt || "").slice(0, 70) };
  if (t === "question") return { kind: "quest", label: T("stepQuestion"), sum: questSum(p) };
  return { kind: "tool", label: T("stepTool"), sum: t.replace(/_/g, " ") };
}
function stepBodyHTML(p) {
  const st = p.state || {};
  let out = "";
  const pre = function (s, cls) {
    if (s != null && String(s).trim()) out += '<pre class="sr-pre ' + (cls || "") + '">' + esc(String(s).slice(0, 6000)) + "</pre>";
  };
  if (st.input) pre(typeof st.input === "string" ? st.input : JSON.stringify(st.input, null, 1), "sr-in");
  if (st.output != null) pre(typeof st.output === "string" ? st.output : JSON.stringify(st.output, null, 1), "sr-out");
  if (!out) out = '<span class="muted">…</span>';
  return out;
}
/* read-only rendering of a question tool part in history: shows each question
   with the options the user picked (metadata.answers) plus any custom answer.
   Unanswered (aborted/still-running) questions say so instead of showing a
   fake wall of unselected options; answered ones hide the unpicked options. */
function questHistoryHTML(p) {
  const st = p.state || {};
  const qs = ((st.input || {}).questions) || p.questions || [];
  const ans = ((st.metadata || {}).answers) || p.answers || [];
  const sts = String(st.status || "");
  const waiting = sts === "running" || sts === "pending" || sts === "asked";
  let html = "";
  qs.forEach(function (qq, qi) {
    const picked = (ans[qi] || []).map(function (a) { return String(a); })
      .filter(function (a) { return !!a; });
    const opts = qq.options || [];
    const answered = picked.length > 0;
    html += '<div class="q-hist' + (answered ? " answered" : "") + '">';
    html += '<div class="q-hist-q">' +
      (qq.header ? '<span class="q-hist-h">' + esc(qq.header) + "</span>" : "") +
      esc(qq.question || qq.header || "") + "</div>";
    if (!answered) {
      html += '<div class="q-hist-none">' +
        esc(waiting ? T("questionWaiting") : T("questionNotAnswered")) + "</div>";
    }
    html += '<div class="q-hist-opts">';
    opts.forEach(function (o) {
      const on = picked.indexOf(o.label) >= 0;
      /* once answered, only the picked options matter - hide the rest */
      if (answered && !on) return;
      html += '<div class="q-hist-opt' + (on ? " on" : " dim") + '"><span class="q-mark">' +
        (on ? "&#9679;" : "&#9675;") + '</span><span class="q-hist-lbl">' + esc(o.label) +
        (o.description ? '<span class="q-hist-desc">' + esc(o.description) + "</span>" : "") +
        "</span></div>";
    });
    picked.forEach(function (a) {
      if (opts.some(function (o) { return o.label === a; })) return;
      html += '<div class="q-hist-opt on custom"><span class="q-mark">&#10003;</span>' +
        '<span class="q-hist-lbl">' + esc(a) + "</span></div>";
    });
    html += "</div></div>";
  });
  return html || '<span class="muted">…</span>';
}
/* does this question part have at least one real answer? */
function questAnswered(p) {
  const ans = ((p.state || {}).metadata || {}).answers || p.answers || [];
  return ans.some(function (a) { return Array.isArray(a) && a.some(function (x) { return !!x; }); });
}
/* compact "Question → Answer" one-liner for the collapsed step-row header */
function questSum(p) {
  const st = p.state || {};
  const qs = ((st.input || {}).questions) || p.questions || [];
  const ans = ((st.metadata || {}).answers) || p.answers || [];
  if (!qs.length) return String(st.title || "");
  const q0 = qs[0];
  const qtxt = String(q0.header || q0.question || "").replace(/\s+/g, " ").slice(0, 120);
  const a0 = (ans[0] || [])[0];
  if (!a0) return String(st.title || qtxt);
  return qtxt + " → " + String(a0).replace(/\s+/g, " ").slice(0, 120);
}
function questBodyHTML(p) {
  return '<div class="q-hist-wrap">' + questHistoryHTML(p) + "</div>";
}
function stepKey(p) {
  if (p.id) return "step-" + p.id;
  const inp = JSON.stringify(((p.state || {}).input) || {}).slice(0, 80);
  return "step-" + (p.tool || "t") + "-" + inp;
}
function stepRowHTML(key, label, sum, bodyHTML, opts) {
  opts = opts || {};
  return '<details class="step-row sk-' + (opts.kind || "tool") +
    (opts.run ? " sr-run" : "") + (opts.err ? " sr-err" : "") + (opts.open ? " open" : "") + '"' +
    (key ? ' data-step="' + esc(key) + '"' : "") + ">" +
    '<summary><span class="sr-chev">›</span><span class="sr-label">' + esc(label) + "…</span>" +
    (sum ? '<span class="sr-sum">' + esc(sum) + "</span>" : "") +
    (opts.run ? '<span class="sr-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : "") +
    "</summary>" +
    (bodyHTML ? '<div class="sr-body">' + bodyHTML + "</div>" : "") + "</details>";
}
/* live (streaming) step rows inside the activity box */
function liveStep(actBox, key, meta, opts, bodyHTML) {
  if (!actBox) return null;
  let el = actBox.querySelector('[data-step="' + CSS.escape(key) + '"]');
  const tmp = document.createElement("div");
  tmp.innerHTML = stepRowHTML(key, meta.label, meta.sum, bodyHTML, opts);
  const nel = tmp.firstElementChild;
  if (el) {
    if (el.open) nel.open = true;
    el.replaceWith(nel);
  } else {
    actBox.appendChild(nel);
  }
  return nel;
}
/* reconcile live rows from polled messages (works even without SSE) */
function syncLiveSteps(msgs, afterId, actBox) {
  let started = afterId == null;
  for (const m of msgs) {
    const info = m.info || {};
    if (info.id === afterId) { started = true; continue; }
    if (!started || info.role !== "assistant") continue;
    const mdone = msgDone(m);
    for (const p of m.parts || []) {
      if (p.type === "reasoning" && (p.text || "").trim()) {
        liveStep(actBox, "step-think", { kind: "think", label: T("stepThink") },
          { kind: "think", run: !mdone, open: !!S.prefs.showThinking },
          '<div class="md sr-md">' + esc(p.text.slice(-4000)) + "</div>");
      } else if (p.type === "tool" && p.tool) {
        const sts = String(((p.state || {}).status) || "");
        const running = !(sts === "completed" || sts === "error" || sts === "failed" || sts === "rejected");
        if (p.tool === "question") {
          /* a PENDING question lives only in the composer dock (the input-bar
             card) - never also as a "Question...>" row in the message stream.
             Once answered/failed it shows as the read-only Q&A history row. */
          if (running) continue;
          liveStep(actBox, stepKey(p),
            { kind: "quest", label: T("stepQuestion"), sum: questSum(p) },
            { kind: "quest", run: false,
              err: sts === "error" || sts === "failed" || sts === "rejected" },
            questBodyHTML(p));
        } else {
          const m2 = stepMeta(p);
          liveStep(actBox, stepKey(p), m2,
            { kind: m2.kind, run: running, err: sts === "error" || sts === "failed" || sts === "rejected",
              open: !running && !!S.prefs.showToolDetails }, stepBodyHTML(p));
        }
        artAutoPush(p);
      }
    }
  }
}
function renderChat() {
  const chat = $("chat");
  chat.innerHTML = "";
  let lastVisible = -1;
  for (let i = 0; i < S.messages.length; i++) {
    const r = (S.messages[i].info || {}).role;
    if (r === "user" || r === "assistant") lastVisible = i;
  }
  let revIdx = -1;
  if (S.revertID) {
    for (let i = 0; i < S.messages.length; i++) {
      if (((S.messages[i].info || {}).id) === S.revertID) { revIdx = i; break; }
    }
  }
  for (let i = 0; i < S.messages.length; i++) {
    const m = S.messages[i];
    const info = m.info || {};
    if (info.role !== "user" && info.role !== "assistant") continue;
    const isFinal = i === lastVisible;
    const undone = revIdx >= 0 && i >= revIdx;
    const done = info.role === "assistant" ? msgDone(m) : true;
    const div = document.createElement("div");
    div.className = "msg-row " + info.role + (undone ? " reverted" : "");
    div.dataset.mid = info.id || "";
    const av = document.createElement("div");
    av.className = "msg-avatar";
    av.textContent = info.role === "user" ? "U" : "V";
    const body = document.createElement("div");
    body.className = "msg-body";
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    const who = document.createElement("span");
    who.textContent = (info.role === "user" ? T("you") : T("vexis")) + (msgTime(m) ? " · " + msgTime(m) : "");
    if (undone) {
      const rb = document.createElement("span");
      rb.className = "reverted-badge";
      rb.textContent = T("revertedBadge");
      who.appendChild(rb);
    }
    const acts = document.createElement("span");
    acts.className = "acts";
    const mkAct = function (svg, title, fn) {
      const b = document.createElement("button");
      b.innerHTML = svg; b.title = title || "";
      b.onclick = fn;
      acts.appendChild(b);
      return b;
    };
    mkAct(IC.copy, T("copy"), function () { copyText(messageText(m)); });
    if (info.role === "assistant" && done) {
      mkAct(IC.regen, T("regenerate"), function () { regenerate(div); });
      const up = mkAct(IC.thumbUp, "", function () { up.classList.toggle("act-on"); down.classList.remove("act-on"); });
      const down = mkAct(IC.thumbDown, "", function () { down.classList.toggle("act-on"); up.classList.remove("act-on"); });
    }
    meta.appendChild(who); meta.appendChild(acts);
    const bub = document.createElement("div");
    bub.className = "msg-content";
    if (info.role === "assistant") {
      const segs = [];
      let textBuf = "";
      const flushText = function () {
        if (textBuf) { segs.push({ t: "text", html: '<div class="md' + arCls(textBuf) + '">' + md(textBuf) + "</div>" }); textBuf = ""; }
      };
      const pushStep = function (meta, open, body, err) {
        const last = segs[segs.length - 1];
        if (last && last.t === "step" && last.kind === "think" && meta.kind === "think") {
          last.body += body;
          if (open) last.open = true;
          return;
        }
        segs.push({ t: "step", kind: meta.kind, label: meta.label, sum: meta.sum || "",
          open: open, err: !!err, body: body });
      };
      if (!done) segs.push({ t: "raw", html: thinkingIndicatorHTML("thinking") });
      for (const p of m.parts || []) {
        if (p.type === "text" && p.text) { textBuf += (textBuf ? "\n" : "") + p.text; continue; }
        if (p.url && (String(p.mime || "").indexOf("image/") === 0 || String(p.url).indexOf("data:image") === 0)) {
          flushText();
          segs.push({ t: "raw", html: '<div class="preview-card img-preview"><img class="thumb" src="' + esc(safeImg(p.url)) + '" /></div>' });
          continue;
        }
        if (p.type === "reasoning") {
          if (!(p.text || "").trim()) continue;
          flushText();
          pushStep({ kind: "think", label: T("stepThink") }, !!S.prefs.showThinking,
            '<div class="md sr-md">' + md(p.text) + "</div>", false);
          continue;
        }
        if (p.type === "tool" && p.tool === "question") {
          flushText();
          const st = p.state || {};
          const sts = String(st.status || "");
          /* still-pending question = the card in the composer dock, not a row */
          if (sts === "running" || sts === "pending" || sts === "asked") continue;
          const err = sts === "error" || sts === "failed" || sts === "rejected";
          pushStep({ kind: "quest", label: T("stepQuestion"), sum: questSum(p) },
            questAnswered(p), questBodyHTML(p), err);
          continue;
        }
        if (p.type === "tool" && p.tool) {
          flushText();
          const m2 = stepMeta(p);
          const sts = String(((p.state || {}).status) || "");
          const err = sts === "error" || sts === "failed" || sts === "rejected";
          pushStep(m2, !!S.prefs.showToolDetails || err, stepBodyHTML(p), err);
          continue;
        }
        if (p.type === "question") {
          flushText();
          pushStep({ kind: "quest", label: T("stepQuestion"), sum: questSum(p) },
            questAnswered(p), questBodyHTML(p), false);
          continue;
        }
      }
      flushText();
      let html = segs.map(function (s) {
        if (s.t !== "step") return s.html;
        return stepRowHTML(null, s.label, s.sum, s.body, { kind: s.kind, open: s.open, err: s.err });
      }).join("");
      bub.innerHTML = html;
      /* final reply with zero text = the model returned nothing (question
         turns keep their summary instead - the answer came as a question) */
      const hasTxt = !!messageText(m).trim();
      const hasQ = (m.parts || []).some(function (p) {
        return p.type === "question" || p.tool === "question";
      });
      if (done && !hasTxt && !hasQ && isFinal) {
        bub.innerHTML = html + '<div class="empty-reply"><span>' + esc(T("modelFail")) +
          '</span><button type="button" class="btn er-retry">' + esc(T("retry")) + "</button></div>";
        const rb = bub.querySelector(".er-retry");
        if (rb) rb.onclick = function () { resendFromRow(div); };
      } else if (!html) {
        bub.innerHTML = "<span style='color:var(--muted)'>…</span>";
      }
    } else {
      let chips = "", txt = "";
      for (const p of m.parts || []) {
        if (p.type === "text" && p.text) txt += (txt ? "\n" : "") + p.text;
        else if (p.url || p.type === "file") {
          if (String(p.mime || "").indexOf("image/") === 0 || String(p.url || "").indexOf("data:image") === 0) {
            chips += '<span class="chip img-chip"><img src="' + esc(safeImg(p.url)) + '" alt="' + esc(p.filename || "") + '" /></span>';
          } else {
            chips += '<span class="chip file-chip"><span class="chip-ic">' + IC.clip + "</span>" +
              esc(p.filename || p.url || "file") + "</span>";
          }
        }
      }
      bub.innerHTML = (chips ? '<div class="chip-row">' + chips + "</div>" : "") +
        (txt ? '<div class="utext">' + userTextHTML(txt) + "</div>" : "") ||
        "<span style='color:var(--muted)'>…</span>";
    }
    body.appendChild(meta); body.appendChild(bub);
    div.appendChild(av); div.appendChild(body);
    chat.appendChild(div);
  }
  chat.querySelectorAll("[data-copycode]").forEach(function (b) {
    b.onclick = function () {
      const pre = b.closest(".codeblock").querySelector("pre");
      copyText(pre.innerText);
      b.textContent = T("copied");
      setTimeout(function () { b.textContent = T("copy"); }, 1200);
    };
  });
  updateStats();
  const w = $("chat-wrap");
  w.scrollTop = w.scrollHeight;
}
/* per-tool expander (shown when /details or the settings toggle is on) */
function toolDetHTML(p) {
  const st = p.state || {};
  const sts = String(st.status || "");
  let inner = "";
  if (st.input) {
    const s = typeof st.input === "string" ? st.input : JSON.stringify(st.input, null, 1);
    if (s && s.trim()) inner += '<pre class="td-pre">' + esc(String(s).slice(0, 1500)) + "</pre>";
  }
  if (st.output != null) {
    const s = typeof st.output === "string" ? st.output : JSON.stringify(st.output, null, 1);
    if (s && s.trim()) inner += '<pre class="td-pre">' + esc(String(s).slice(0, 2000)) + "</pre>";
  }
  const cls = "tool-det" + (sts === "error" || sts === "failed" || sts === "rejected" ? " td-err" :
    (sts === "completed" ? " td-ok" : ""));
  return '<details class="' + cls + '"><summary>' + esc(toolTitle(p.tool, st)) +
    (sts ? " · " + esc(sts) : "") + "</summary>" + inner + "</details>";
}
/* tokens / context % in the topbar (from the last assistant message info) */
function fmtTok(n) {
  n = +n || 0;
  return n >= 1000 ? (Math.round(n / 100) / 10) + "k" : String(n);
}
/* last assistant usage + the model THAT message ran (not the currently
   selected one - switching models must not corrupt the context %) */
function lastUsage() {
  for (let i = (S.messages || []).length - 1; i >= 0; i--) {
    const inf = (S.messages[i] || {}).info || {};
    if (inf.role === "assistant" && inf.tokens) {
      let mdl = null;
      const m = inf.model;
      if (m && m.modelID) {
        mdl = MODELS.find(function (x) {
          return modelKey(x) === m.providerID + "/" + m.modelID;
        }) || null;
      }
      return { tok: inf.tokens, cost: inf.cost || null, model: mdl || currentModel() };
    }
  }
  return { tok: null, cost: null, model: currentModel() };
}
function updateStats() {
  const el = $("chat-stats");
  if (!el) return;
  const u = lastUsage();
  const tok = u.tok, cost = u.cost;
  if (!tok) { el.textContent = ""; el.title = ""; return; }
  const lim = u.model.context || 0;
  const used = +tok.input || 0;
  const parts = [fmtTok(used) + " " + T("tokensLbl").toLowerCase()];
  if (lim) parts.push(Math.min(100, Math.round(used / lim * 100)) + "% " + T("ctxLbl").toLowerCase());
  const ct = cost ? (+cost.total || 0) : 0;
  if (ct > 0) parts.push("$" + ct.toFixed(4));
  el.textContent = parts.join(" · ");
  el.title = T("tokensLbl") + ": " + JSON.stringify(tok) + (cost ? " · " + T("costLbl") + ": " + JSON.stringify(cost) : "");
  renderUsagePop();
}
/* navbar usage popover: Cost / Context / Tokens card like opencode's chip */
function usageRows() {
  const u = lastUsage();
  const tok = u.tok;
  if (!tok) return null;
  const lim = u.model.context || 0;
  const used = +tok.input || 0;
  const pct = lim ? Math.min(100, Math.round(used / lim * 100)) : 0;
  const total = (+tok.input || 0) + (+tok.output || 0) + (+tok.reasoning || 0);
  const ct = u.cost ? (+u.cost.total || 0) : 0;
  return [
    [T("costLbl"), "$" + ct.toFixed(2)],
    [T("ctxLbl"), pct + "%"],
    [T("tokensLbl"), total.toLocaleString("en-US")],
  ];
}
function renderUsagePop() {
  const pop = $("usage-pop");
  if (!pop || pop.classList.contains("hidden")) return;
  const rows = usageRows();
  pop.innerHTML = rows ? rows.map(function (r) {
    return '<div class="usage-row"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>";
  }).join("") : "<p class='muted'>—</p>";
}
/* ---------- right sidebar: context / todo / diff ---------- */
/* right sidebar: the artifact panel - Files (browse the workspace), Browser
   (preview any site/page the AI builds) and Todo (the task list). */
async function renderRSB() {
  const box = $("rsb-body");
  if (!box) return;
  const tab = S.rsbTab || "files";
  document.querySelectorAll(".rsb-tab").forEach(function (x) {
    x.classList.toggle("on", x.dataset.rtab === tab);
  });
  /* the browser tab is a full-bleed Chrome-style window: no panel padding */
  box.classList.toggle("rsb-flush", tab === "browser");
  if (tab === "todo") {
    let arr = [];
    if (S.sessionID) {
      try {
        const out = await GET("/session/" + S.sessionID + "/todo");
        arr = Array.isArray(out) ? out : ((out && out.data) || []);
      } catch (e) {}
    }
    if (arr.length) {
      box.innerHTML = taskPhaseHTML() + todoCardHTML(arr);
    } else {
      box.innerHTML = "<p class='muted'>" + esc(T("todoEmpty")) + "</p>" +
        "<p class='muted'>" + esc(T("todoHint")) + "</p>";
      const rb = document.createElement("button");
      rb.className = "btn"; rb.textContent = T("reload");
      rb.onclick = function () { renderRSB(); };
      box.appendChild(rb);
    }
    return;
  }
  if (tab === "browser") {
    renderBrowserTab(box);
    return;
  }
  renderFilesTab(box, S.filesPath || "workspace");
}

/* right-rail Files tab: browse anything inside the vexis folder */
async function renderFilesTab(box, rel) {
  rel = rel || "workspace";
  S.filesPath = rel;
  box.innerHTML = "<p class='muted'>" + esc(T("loading")) + "</p>";
  let out = null;
  try {
    out = await GET("/vexis/files?path=" + encodeURIComponent(rel));
  } catch (e) {
    box.innerHTML = "<p class='muted'>" + esc(T("errLoad")) + "</p>";
    return;
  }
  box.innerHTML = "";
  const here = (out && out.rel) || rel;
  const head = document.createElement("div");
  head.className = "rsb-group";
  const crumbs = document.createElement("div");
  crumbs.className = "file-crumbs";
  here.split("/").forEach(function (seg, i, parts) {
    if (i > 0) crumbs.appendChild(document.createTextNode(" / "));
    const b = document.createElement("button");
    b.type = "button"; b.className = "crumb";
    b.textContent = seg === "." ? T("filesTitle") : seg;
    b.onclick = function () {
      renderFilesTab(box, parts.slice(0, i + 1).join("/") || ".");
    };
    crumbs.appendChild(b);
  });
  head.appendChild(crumbs);
  box.appendChild(head);
  const list = document.createElement("div");
  list.className = "rsb-group";
  const entries = (out && out.entries) || [];
  const absDir = (out && out.path) || "";
  if (!entries.length) {
    list.innerHTML = "<p class='muted'>—</p>";
  }
  entries.slice().sort(function (a, b) {
    if (!!a.dir !== !!b.dir) return a.dir ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  }).forEach(function (en) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "file-row" + (en.hidden ? " hidden-f" : "");
    const ic = document.createElement("span");
    ic.className = "tbox"; ic.textContent = en.dir ? "▸" : "·";
    const nm = document.createElement("span");
    nm.textContent = en.name;
    row.appendChild(ic); row.appendChild(nm);
    const child = (here === "." ? "" : here + "/") + en.name;
    row.onclick = function () {
      if (en.dir) renderFilesTab(box, child);
      else previewFile(box, absDir + "/" + en.name, en.name);
    };
    list.appendChild(row);
  });
  box.appendChild(list);
}
async function previewFile(box, absPath, name) {
  if (!/\.((md|txt|json|jsonc))$/i.test(name)) return;
  try {
    const out = await GET("/vexis/file?path=" + encodeURIComponent(absPath));
    const pre = document.createElement("pre");
    pre.className = "sr-pre";
    pre.textContent = String((out && out.content) || "").slice(0, 8000) || "—";
    const wrap = document.createElement("div");
    wrap.className = "rsb-group";
    const h = document.createElement("h5");
    h.textContent = name;
    wrap.appendChild(h); wrap.appendChild(pre);
    box.appendChild(wrap);
    wrap.scrollIntoView(false);
  } catch (e) {}
}
/* ---------- artifacts: the AI pushes files / sites into this panel ----------
   Two entry points, both landing in pushArtifact():
     * the `vexis_show` tool -> POST /vexis/artifact -> /vexis/events SSE
     * a completed write/edit of a deliverable file, caught by artAutoPush() */
const ART_PREVIEW = [".html", ".htm", ".svg", ".png", ".jpg", ".jpeg", ".gif",
  ".webp", ".ico", ".pdf", ".txt", ".md", ".json", ".csv", ".xml", ".css",
  ".js", ".mp4", ".webm", ".mp3", ".wav"];
const ART_AUTO = [".html", ".htm", ".svg", ".pdf", ".png", ".jpg", ".jpeg",
  ".gif", ".webp", ".md"];
function artExt(name) {
  const s = String(name || "").split("?")[0].toLowerCase();
  const i = s.lastIndexOf(".");
  return i >= 0 ? s.slice(i) : "";
}
function artIsPreviewable(name) { return ART_PREVIEW.indexOf(artExt(name)) >= 0; }
function artPreviewable(a) {
  if (a && typeof a.preview === "boolean") return a.preview;
  return artIsPreviewable(a && (a.path || a.url));
}
/* a finished write/edit of a deliverable file goes to the panel on its own */
function artAutoPush(p) {
  const tool = String((p && p.tool) || "");
  if (tool !== "write" && tool !== "edit") return;
  const st = (p && p.state) || {};
  if (String(st.status || "") !== "completed") return;
  const inp = st.input || {};
  const fp = String(inp.filePath || inp.path || "");
  if (!fp || ART_AUTO.indexOf(artExt(fp)) < 0) return;
  if (!S.artAuto) S.artAuto = {};
  if (S.artAuto[fp]) return;
  S.artAuto[fp] = 1;
  POST("/vexis/artifact", { path: fp }).catch(function () {});
}
async function loadArtifacts() {
  try {
    const out = await GET("/vexis/artifacts");
    if (out && Array.isArray(out.artifacts)) S.artifacts = out.artifacts;
    const rsb = $("rsb");
    if (S.rsbTab === "browser" && rsb && !rsb.classList.contains("hidden")) renderRSB();
  } catch (e) {}
}
/* server -> UI push channel (artifacts). EventSource reconnects by itself. */
function connectUiEvents() {
  if (typeof EventSource === "undefined") return;
  try {
    const es = new EventSource("/vexis/events");
    es.onmessage = function (m) {
      let ev = null;
      try { ev = JSON.parse(m.data); } catch (e) { return; }
      if (ev && ev.type === "artifact" && ev.artifact) pushArtifact(ev.artifact);
    };
    S.uiES = es;
  } catch (e) {}
}
function brwOpenArtifact(a) {
  const ts = brwTabs();
  let t = ts.filter(function (x) {
    return (x.art && x.art.url === a.url) || x.url === a.url;
  })[0];
  if (!t) {
    t = { id: "t" + Date.now().toString(36), hist: [], hi: -1 };
    ts.push(t);
  }
  t.art = a;
  t.label = a.title;
  if (artPreviewable(a)) {
    t.hist = t.hist.slice(0, t.hi + 1);
    t.hist.push(a.url);
    t.hi = t.hist.length - 1;
    t.url = a.url;
    t.n = (t.n || 0) + 1;   /* cache-bust: the file may have just changed */
  } else {
    t.url = "";
  }
  S.brwActive = t.id;
}
function pushArtifact(art) {
  if (!art || !art.url) return;
  const a = Object.assign({}, art);
  if (!a.title) {
    a.title = a.kind === "url" ? a.url
      : (String(a.path || a.url).split(/[\\/]/).pop() || a.url);
  }
  a.id = a.id || ("a" + Date.now().toString(36));
  /* the SSE channel can occasionally deliver the same artifact twice; the
     server stamps every push with a fresh id, so id == delivery is unique */
  if (!S.artSeen) S.artSeen = {};
  if (S.artSeen[a.id]) return;
  S.artSeen[a.id] = 1;
  const seen = Object.keys(S.artSeen);
  if (seen.length > 200) delete S.artSeen[seen[0]];
  if (!Array.isArray(S.artifacts)) S.artifacts = [];
  const i = S.artifacts.findIndex(function (x) { return x.url === a.url; });
  if (i >= 0) S.artifacts.splice(i, 1);
  S.artifacts.unshift(a);
  if (S.artifacts.length > 30) S.artifacts.length = 30;
  S.artId = a.id;
  /* open the panel on its Browser tab and show the artifact */
  const rsb = $("rsb");
  if (rsb) rsb.classList.remove("hidden");
  S.prefs.rsbOpen = true;
  S.rsbTab = "browser"; S.prefs.rsbTab = "browser";
  savePrefs();
  brwOpenArtifact(a);
  renderRSB();
  try { notify(T("artPushed"), a.title); } catch (e) {}
}
/* right-rail Browser tab: opencode-style tabbed preview (tab strip, back /
   forward / reload, URL bar, recents, open-outside). In-page iframes can't
   frame-bust sites, so framing-blocked pages get the open-outside button. */
function brwTabs() {
  if (!Array.isArray(S.brwTabs)) S.brwTabs = [];
  return S.brwTabs;
}
function brwActive() {
  const ts = brwTabs();
  let t = ts.filter(function (x) { return x.id === S.brwActive; })[0];
  if (!t && ts.length) { t = ts[0]; S.brwActive = t.id; }
  return t || null;
}
function brwNorm(u) {
  u = String(u || "").trim();
  if (u && !/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u;
  return u;
}
function brwHost(u) {
  try { return new URL(u).hostname || u; } catch (e) { return u || T("brwNewTab"); }
}
function brwRemember(u) {
  const rec = S.prefs.browserRecent || [];
  S.prefs.browserRecent = [u].concat(rec.filter(function (x) { return x !== u; })).slice(0, 8);
  savePrefs();
}
function brwFrameSrc(t) {
  let u = String((t && t.url) || "");
  if (/^\/vexis\/raw\?/i.test(u)) u += "&_v=" + ((t && t.n) || 1);
  return u;
}
function brwOpenUrl(box, u) {
  u = String(u || "").trim();
  const local = /^\/vexis\/raw\?/i.test(u);
  u = local ? u : brwNorm(u);
  if (!u) return;
  if (!local && !/^https?:\/\//i.test(u)) return;
  let t = brwActive();
  if (!t) {
    t = { id: "t" + Date.now().toString(36), hist: [], hi: -1 };
    brwTabs().push(t);
    S.brwActive = t.id;
  }
  t.hist = t.hist.slice(0, t.hi + 1);
  t.hist.push(u);
  t.hi = t.hist.length - 1;
  t.url = u;
  t.art = null; t.label = null;
  if (!local) brwRemember(u);
  renderBrowserTab(box);
}
/* inline chrome icons: real SVG beats text glyphs for a native browser look */
const BRW_SVG = {
  back: '<path d="M15.5 4.5 8 12l7.5 7.5"/>',
  fwd: '<path d="M8.5 4.5 16 12l-7.5 7.5"/>',
  reload: '<path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8"/><path d="M20.6 4.6v5.2h-5.2"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  close: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5.5 15.5V6a2 2 0 0 1 2-2H17"/>',
  ext: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><path d="M12 3.8c2.2 2.4 3.3 5.2 3.3 8.2s-1.1 5.8-3.3 8.2c-2.2-2.4-3.3-5.2-3.3-8.2s1.1-5.8 3.3-8.2Z"/>',
  file: '<path d="M7 3.5h6.5L19 9v11.5H7z"/><path d="M13.5 3.5V9H19"/>',
};
function brwSvg(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (BRW_SVG[name] || "") + "</svg>";
}
function brwCloseTab(tab, box) {
  const ts = brwTabs();
  const i = ts.indexOf(tab);
  if (i >= 0) ts.splice(i, 1);
  if (S.brwActive === tab.id) S.brwActive = (ts[Math.max(0, i - 1)] || {}).id || null;
  renderBrowserTab(box);
}
/* can this be navigated to? keeps a pasted windows path from becoming a URL */
function brwLikelyUrl(u) {
  u = String(u || "").trim();
  if (!u) return false;
  if (/^[a-z]:[\\/]/i.test(u) || u.indexOf("\\") >= 0) return false;
  if (u.charAt(0) === "/") return /^\/vexis\/raw\?/i.test(u);
  return true;
}
function renderBrowserTab(box) {
  box.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "brw";
  const tabs = brwTabs();
  const act = brwActive();
  /* tab strip */
  const tabsRow = document.createElement("div");
  tabsRow.className = "brw-tabs";
  const tablist = document.createElement("div");
  tablist.className = "brw-tablist";
  tabs.forEach(function (t) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "brw-tab" + (t.id === (act || {}).id ? " on" : "");
    b.title = (t.art && t.art.path) || t.url || "";
    const fav = document.createElement("span");
    fav.className = "brw-fav";
    fav.innerHTML = brwSvg(t.art && !t.url ? "file"
      : (/^\/vexis\/raw\?/i.test(t.url || "") ? "lock" : "globe"));
    const lb = document.createElement("span");
    lb.className = "brw-tab-t";
    lb.textContent = t.label || brwHost(t.url);
    const x = document.createElement("span");
    x.className = "brw-x"; x.innerHTML = brwSvg("close"); x.title = T("brwCloseTab");
    x.onclick = function (e) { e.stopPropagation(); brwCloseTab(t, box); };
    b.appendChild(fav); b.appendChild(lb); b.appendChild(x);
    b.onclick = function () { S.brwActive = t.id; renderBrowserTab(box); };
    tablist.appendChild(b);
  });
  tabsRow.appendChild(tablist);
  const add = document.createElement("button");
  add.type = "button"; add.className = "brw-new"; add.title = T("brwNewTab");
  add.innerHTML = brwSvg("plus");
  add.onclick = function () {
    const nt = { id: "t" + Date.now().toString(36), hist: [], hi: -1, url: "" };
    tabs.push(nt);
    S.brwActive = nt.id;
    renderBrowserTab(box);
  };
  tabsRow.appendChild(add);
  wrap.appendChild(tabsRow);
  /* toolbar: circular nav buttons + a rounded omnibox, like Chrome */
  const t = brwActive();
  const bar = document.createElement("div");
  bar.className = "brw-bar";
  const isLocal = !!(t && t.url) && /^\/vexis\/raw\?/i.test(t.url);
  const nav = function (icon, title, ok, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "brw-ic"; b.title = title;
    b.innerHTML = brwSvg(icon);
    b.disabled = !ok;
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  nav("back", T("brwBack"), !!(t && t.hi > 0), function () {
    if (t && t.hi > 0) { t.hi--; t.url = t.hist[t.hi]; renderBrowserTab(box); }
  });
  nav("fwd", T("brwFwd"), !!(t && t.hist && t.hi < t.hist.length - 1), function () {
    if (t && t.hist && t.hi < t.hist.length - 1) { t.hi++; t.url = t.hist[t.hi]; renderBrowserTab(box); }
  });
  nav("reload", T("brwReload"), !!(t && t.url), function () {
    if (!t) return;
    t.n = (t.n || 1) + 1;   /* cache-bust a local artifact on reload */
    renderBrowserTab(box);
  });
  const omni = document.createElement("div");
  omni.className = "omni";
  const oic = document.createElement("span");
  oic.className = "omni-ic";
  oic.innerHTML = brwSvg(isLocal ? "lock" : "globe");
  const inp = document.createElement("input");
  inp.type = "text"; inp.placeholder = T("brwUrl"); inp.spellcheck = false;
  inp.value = (t && t.url) || (t && t.art && t.art.path) || "";
  inp.onkeydown = function (e) {
    if (e.key === "Enter" && brwLikelyUrl(inp.value)) brwOpenUrl(box, inp.value);
  };
  omni.appendChild(oic); omni.appendChild(inp);
  bar.appendChild(omni);
  const cpv = isLocal ? ((t && t.art && t.art.path) || t.url) : ((t && t.url) || "");
  const cp = document.createElement("button");
  cp.type = "button"; cp.className = "brw-ic"; cp.disabled = !cpv;
  cp.title = isLocal ? T("artCopyPath") : T("brwCopyLink");
  cp.innerHTML = brwSvg("copy");
  cp.onclick = function () {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(cpv);
      notify(cp.title, String(cpv).slice(0, 80));
    } catch (e) {}
  };
  bar.appendChild(cp);
  if (t && t.url && !isLocal) {
    const eb = document.createElement("button");
    eb.type = "button"; eb.className = "brw-ic"; eb.title = T("brwOpenExt");
    eb.innerHTML = brwSvg("ext");
    eb.onclick = function () { POST("/vexis/open", { url: t.url }).catch(function () {}); };
    bar.appendChild(eb);
  }
  wrap.appendChild(bar);
  /* page area: the live frame, or a home screen with recents + artifacts */
  const page = document.createElement("div");
  page.className = "brw-page";
  if (t && t.url) {
    const fr = document.createElement("iframe");
    fr.className = "brw-frame";
    /* local artifacts are AI-authored HTML: run the script, but keep the frame
       on an opaque origin so it can never reach the app's DOM or secret */
    fr.setAttribute("sandbox", isLocal
      ? "allow-scripts allow-forms"
      : "allow-scripts allow-same-origin allow-forms");
    fr.src = brwFrameSrc(t);
    page.appendChild(fr);
  } else {
    const home = document.createElement("div");
    home.className = "brw-home";
    const em = document.createElement("div");
    em.className = "brw-empty";
    const g = document.createElement("div");
    g.className = "brw-globe";
    const h = document.createElement("div");
    h.className = "brw-empty-t";
    const p = document.createElement("p");
    p.className = "muted";
    if (t && t.art) {
      /* a file the panel cannot render inline (zip, docx, ...) */
      g.innerHTML = brwSvg("file");
      h.textContent = t.art.title || "artifact";
      p.textContent = T("artNoPreview");
      em.appendChild(g); em.appendChild(h); em.appendChild(p);
      if (t.art.path) {
        const pp = document.createElement("p");
        pp.className = "muted art-path"; pp.textContent = t.art.path;
        em.appendChild(pp);
      }
      const cpb = document.createElement("button");
      cpb.type = "button"; cpb.className = "btn"; cpb.textContent = T("artCopyPath");
      cpb.onclick = function () {
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(t.art.path || "");
          notify(cpb.textContent, String(t.art.path || "").slice(0, 80));
        } catch (e) {}
      };
      em.appendChild(cpb);
    } else {
      g.innerHTML = brwSvg("globe");
      h.textContent = T("brwEmptyT");
      p.textContent = T("brwEmptyS");
      em.appendChild(g); em.appendChild(h); em.appendChild(p);
    }
    home.appendChild(em);
    const rec = S.prefs.browserRecent || [];
    if (rec.length) {
      const rh = document.createElement("div");
      rh.className = "brw-recent-h"; rh.textContent = T("brwRecent");
      home.appendChild(rh);
      rec.forEach(function (u) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "file-row";
        const ic = document.createElement("span");
        ic.className = "tbox"; ic.innerHTML = brwSvg("globe");
        const nm = document.createElement("span");
        nm.textContent = u;
        b.appendChild(ic); b.appendChild(nm);
        b.onclick = function () { brwOpenUrl(box, u); };
        home.appendChild(b);
      });
    }
    renderArtifactsList(home, box);
    page.appendChild(home);
  }
  wrap.appendChild(page);
  box.appendChild(wrap);
}
/* recent artifacts the AI pushed, so they survive a reload / new session */
function renderArtifactsList(wrap, box) {
  const list = S.artifacts || [];
  if (!list.length) return;
  const h = document.createElement("div");
  h.className = "brw-recent-h"; h.textContent = T("artifacts");
  wrap.appendChild(h);
  list.slice(0, 15).forEach(function (a) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "file-row" + (a.id === S.artId ? " art-on" : "");
    const ic = document.createElement("span");
    ic.className = "tbox";
    ic.innerHTML = brwSvg(a.kind === "url" ? "globe" : "file");
    const nm = document.createElement("span");
    nm.textContent = a.title || a.url;
    nm.title = a.path || a.url;
    b.appendChild(ic); b.appendChild(nm);
    b.onclick = function () { S.artId = a.id; brwOpenArtifact(a); renderRSB(); };
    wrap.appendChild(b);
  });
}
async function buildSystem() {
  let sys = IDENTITY.slice(0, 6000);
  try {
    const mem = await GET("/vexis/memory");
    const files = (mem && mem.files) || [];
    for (const f of files) {
      const content = String((f && f.content) || "").trim();
      if (!content) continue;
      if (sys.length > 15000) break;
      sys += "\n\n## Knowledge: " + (f.name || "file") + "\n" + content.slice(0, 4000);
    }
  } catch (e) {}
  return sys;
}
/* ---------- streaming (poll-based: engine SSE carries no text deltas) ---------- */
function assistantTextAfter(msgs, afterId) {
  let out = "", started = afterId == null;
  for (const m of msgs) {
    const info = m.info || {};
    if (info.id === afterId) { started = true; continue; }
    if (!started || info.role !== "assistant") continue;
    for (const p of m.parts || []) {
      if (p.type === "text" && p.text) out += p.text;
    }
  }
  return out;
}
function sessionDone(msgs) {
  if (!msgs.length) return false;
  const info = msgs[msgs.length - 1].info || {};
  if (info.role !== "assistant") return false;
  return msgDone(msgs[msgs.length - 1]);
}
/* ---------- streaming: live engine SSE events + poll reconciliation ---------- */
function normItems(out) {
  if (Array.isArray(out)) return out;
  if (out && Array.isArray(out.data)) return out.data;
  return [];
}
async function pendingPerms() {
  try {
    const out = await GET("/api/session/" + S.sessionID + "/permission");
    const items = normItems(out).filter(function (q) { return q && (q.id || q.requestID); });
    if (items.length) return items;
  } catch (e) {}
  try {
    const out2 = await GET("/permission" + qdir());
    return normItems(out2).filter(function (q) { return q && (q.id || q.requestID); });
  } catch (e2) { return []; }
}
async function pendingQuests() {
  /* NOTE (2026-10-11): engine 1.18.35 serves pending questions ONLY on the
     global route GET /question?directory= (items shaped {id:"que_...", questions,
     tool:{messageID,callID}}). The session route /api/session/:id/question
     always returns {"data":[]} here, so poll it first for compat then fall
     back to the global route that actually carries the que_ items. */
  try {
    const out = await GET("/api/session/" + S.sessionID + "/question");
    const items = normItems(out).filter(function (q) { return q && q.id; });
    if (items.length) return items;
  } catch (e) {}
  try {
    const out2 = await GET("/question" + qdir());
    return normItems(out2).filter(function (q) { return q && q.id; });
  } catch (e2) { return []; }
}
function permTitle(q) {
  return q.title || q.tool || (q.action ? String(q.action) : "") || T("permTitle");
}
function permDesc(q) {
  const d = q.description || q.detail || q.command || q.input || "";
  if (typeof d === "string") return d.slice(0, 500);
  try { return JSON.stringify(d).slice(0, 500); } catch (e) { return ""; }
}
/* v2 question/permission endpoints, with a v1 fallback. Verified live against
   engine 1.18.35 (2026-10-11): questions live on the GLOBAL routes -
   GET /question?directory= lists [{id:"que_...", questions, tool}],
   POST /question/:que/reply {answers:[[labels]]} answers, while
   /api/session/:sid/question/:id/reply 404s (QuestionNotFoundError).
   So for questions the global route goes FIRST. */
function replyQuest(id, answers) {
  return POST("/question/" + encodeURIComponent(id) + "/reply" + qdir(),
      { answers: answers })
    .catch(function () {
      const sid = S.sessionID;
      return POST("/api/session/" + encodeURIComponent(sid) + "/question/" +
        encodeURIComponent(id) + "/reply", { answers: answers });
    });
}
function rejectQuest(id) {
  return POST("/question/" + encodeURIComponent(id) + "/reject" + qdir(), {})
    .catch(function () {
      const sid = S.sessionID;
      return POST("/api/session/" + encodeURIComponent(sid) + "/question/" +
        encodeURIComponent(id) + "/reject", {});
    });
}
/* Called after a restored (reloaded-session) question/permission card is
   answered. If no stream is running the engine will continue the turn on its
   own - spin up a shell + streamTurn so the reply shows without a reload. */
function afterPendingAnswered() {
  if (S.streaming || !S.sessionID) return;
  S.streaming = true; S.stopFlag = false;
  $("btn-send").classList.add("hidden");
  $("btn-stop").classList.remove("hidden");
  (async function () {
    try {
      const msgs = await GET("/session/" + S.sessionID + "/message?limit=200");
      const arr = Array.isArray(msgs) ? msgs : ((msgs && msgs.data) || []);
      let anchor = null;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (((arr[i].info || {}).role) === "assistant") { anchor = (arr[i].info || {}).id; break; }
      }
      const shell = renderAssistantShell();
      await streamTurn(anchor, shell.bubble, shell.actBox, shell.div);
      await refreshAfterTurn("");
    } catch (e) { /* fall back to plain history render */ }
    finally {
      S.streaming = false; S.stopFlag = false;
      $("btn-send").classList.remove("hidden");
      $("btn-stop").classList.add("hidden");
      restorePendingCards(); /* a follow-up question may be waiting */
    }
  })();
}
/* re-show pending question/permission cards after a reload or when opening an
   old session - without this the user could never answer a question that was
   pending when the window was refreshed. Cards live in the composer dock
   (#pending-cards) - they REPLACE the input bar while a question is open. */
function pendingDock() {
  return $("pending-cards") || $("chat");
}
function syncPendingDock() {
  const dock = $("pending-cards");
  const wrap = $("composer-wrap");
  if (!dock || !wrap) return;
  const has = dock.children.length > 0;
  dock.classList.toggle("hidden", !has);
  wrap.classList.toggle("has-pending", has);
  if (has) { dock.scrollTop = dock.scrollHeight; }
}
async function restorePendingCards() {
  if (!S.sessionID || S.streaming) return;
  try {
    const dock = pendingDock();
    const perms = await pendingPerms();
    for (const q of perms) {
      const id = q.id || q.requestID;
      /* re-add even if "shown" before - renderChat may have wiped the node */
      if (dock.querySelector('[data-perm="' + CSS.escape(String(id)) + '"]')) {
        S.shownPerms.add(id); continue;
      }
      S.shownPerms.add(id); renderPermCard(dock, q);
    }
    const quests = await pendingQuests();
    for (const q of quests) {
      if (dock.querySelector('[data-quest="' + CSS.escape(String(q.id)) + '"]')) {
        S.shownQuests.add(q.id); continue;
      }
      S.shownQuests.add(q.id); renderQuestCard(dock, q);
    }
    syncPendingDock();
    if (quests.length || perms.length) {
      const w = $("chat-wrap");
      w.scrollTop = w.scrollHeight;
    }
  } catch (e) {}
}
function replyPerm(id, reply, message) {
  const sid = S.sessionID;
  const body = { reply: reply };
  if (message) body.message = message;
  return POST("/api/session/" + encodeURIComponent(sid) + "/permission/" +
      encodeURIComponent(id) + "/reply", body)
    .catch(function () {
      return POST("/permission/" + encodeURIComponent(id) + "/reply" + qdir(), body);
    });
}
function renderPermCard(container, q) {
  const id = q.id || q.requestID;
  if (container.querySelector('[data-perm="' + CSS.escape(String(id)) + '"]')) return;
  const d = document.createElement("div");
  d.className = "perm"; d.dataset.perm = String(id);
  const h = document.createElement("h4");
  h.innerHTML = IC.lock + "<span>" + esc(permTitle(q)) + "</span>";
  const p = document.createElement("p"); p.textContent = permDesc(q);
  const row = document.createElement("div"); row.className = "row";
  const mk = function (label, primary, fn) {
    const b = document.createElement("button");
    b.className = "btn" + (primary ? " primary" : "");
    b.textContent = label;
    b.onclick = function () {
      b.disabled = true;
      fn().then(function () { d.remove(); afterPendingAnswered(); });
    };
    row.appendChild(b);
  };
  mk(T("allowOnce"), true, function () { return replyPerm(id, "once"); });
  mk(T("allowAlways"), false, function () { return replyPerm(id, "always"); });
  mk(T("deny"), false, function () { return replyPerm(id, "reject"); });
  d.appendChild(h); d.appendChild(p); d.appendChild(row);
  container.appendChild(d);
  syncPendingDock();
  notify(T("permTitle"), permTitle(q));
}
/* opencode-style question card: one question at a time, tab strip, progress,
   radio/checkbox options with descriptions, "type your own answer", a review
   step and submit. Mirrors the engine's own web UI state machine. */
function renderQuestCard(container, q) {
  if (container.querySelector('[data-quest="' + CSS.escape(String(q.id)) + '"]')) return;
  const questions = q.questions || [];
  if (!questions.length) return;
  const d = document.createElement("div");
  d.className = "quest"; d.dataset.quest = String(q.id);

  const answers = questions.map(function () { return []; });   /* picked labels */
  const custom = questions.map(function () { return ""; });     /* typed text */
  const customOn = questions.map(function () { return false; });
  let tab = 0, reviewing = false, submitted = false;

  const head = document.createElement("h4");
  head.innerHTML = IC.help + "<span>" + esc(T("questTitle")) + "</span>";
  const tabs = document.createElement("div"); tabs.className = "q-tabs";
  const prog = document.createElement("div"); prog.className = "q-progress";
  const body = document.createElement("div"); body.className = "q-body";
  const nav = document.createElement("div"); nav.className = "q-nav";
  d.appendChild(head); d.appendChild(tabs); d.appendChild(prog);
  d.appendChild(body); d.appendChild(nav);

  function chosen(qi) {
    const arr = answers[qi].slice();
    const c = customOn[qi] ? custom[qi].trim() : "";
    if (c && arr.indexOf(c) === -1) arr.push(c);
    return arr;
  }
  function updateProgress() {
    const cur = reviewing ? questions.length : tab + 1;
    prog.textContent = T("questionProgress")
      .replace("{current}", String(cur)).replace("{total}", String(questions.length));
  }
  function renderTabs() {
    tabs.innerHTML = "";
    questions.forEach(function (qq, qi) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "q-tab" + ((!reviewing && qi === tab) ? " on" : "") +
        (chosen(qi).length ? " answered" : "");
      b.textContent = String(qi + 1);
      b.title = qq.header || qq.question || "";
      b.onclick = function () { reviewing = false; tab = qi; renderQuestion(); };
      tabs.appendChild(b);
    });
  }
  function renderQuestion() {
    const qq = questions[tab] || {};
    const opts = qq.options || [];
    body.innerHTML = "";
    const title = document.createElement("div");
    title.className = "q-title";
    title.textContent = qq.header || qq.question || "";
    body.appendChild(title);
    if (qq.header && qq.question) {
      const sub = document.createElement("div");
      sub.className = "q-sub"; sub.textContent = qq.question;
      body.appendChild(sub);
    }
    const hint = document.createElement("div");
    hint.className = "q-hint";
    hint.textContent = qq.multiple ? T("questionMultiHint") : T("questionSingleHint");
    body.appendChild(hint);
    opts.forEach(function (o) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "q-opt";
      const on = answers[tab].indexOf(o.label) >= 0;
      if (on) row.setAttribute("data-picked", "");
      row.innerHTML = '<span class="q-mark ' + (qq.multiple ? "q-check" : "q-radio") + '"></span>' +
        '<span class="q-text"><span class="q-label">' + esc(o.label) + "</span>" +
        (o.description ? '<span class="q-desc">' + esc(o.description) + "</span>" : "") +
        "</span>";
      row.onclick = function () {
        if (qq.multiple) {
          const i = answers[tab].indexOf(o.label);
          if (i >= 0) answers[tab].splice(i, 1); else answers[tab].push(o.label);
        } else {
          answers[tab] = [o.label];
        }
        renderQuestion();
      };
      body.appendChild(row);
    });
    /* "Type your own answer" */
    const cstOn = customOn[tab] && !!custom[tab].trim();
    const cst = document.createElement("button");
    cst.type = "button";
    cst.className = "q-opt q-custom-toggle" + (cstOn ? " on" : "");
    cst.innerHTML = '<span class="q-mark">' + (cstOn ? "&#10003;" : "&#43;") + "</span>" +
      '<span class="q-label">' + esc(T("optionTypeOwn")) + "</span>";
    cst.onclick = function () {
      if (!customOn[tab]) {
        customOn[tab] = true;
        if (!qq.multiple) { answers[tab] = []; custom[tab] = ""; }
      } else if (!custom[tab].trim()) {
        customOn[tab] = false;
      }
      renderQuestion();
    };
    body.appendChild(cst);
    if (customOn[tab]) {
      const wrap = document.createElement("div");
      wrap.className = "q-custom";
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "q-input";
      inp.placeholder = T("questionCustomPlaceholder");
      inp.value = custom[tab];
      inp.oninput = function () { custom[tab] = inp.value; renderNav(); };
      wrap.appendChild(inp);
      body.appendChild(wrap);
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0);
    }
    renderTabs(); updateProgress(); renderNav();
  }
  function renderReview() {
    body.innerHTML = "";
    const title = document.createElement("div");
    title.className = "q-title"; title.textContent = T("reviewTitle");
    body.appendChild(title);
    questions.forEach(function (qq, qi) {
      const a = chosen(qi);
      const box = document.createElement("div");
      box.className = "q-review-item";
      box.innerHTML = '<div class="q-review-q">' + esc(qq.header || qq.question || "") + "</div>" +
        '<div class="q-review-a' + (a.length ? "" : " empty") + '">' +
        esc(a.length ? a.join(", ") : T("questionNotAnswered")) + "</div>";
      box.onclick = function () { reviewing = false; tab = qi; renderQuestion(); };
      body.appendChild(box);
    });
    renderTabs(); updateProgress(); renderNav();
  }
  function renderNav() {
    nav.innerHTML = "";
    const mk = function (label, primary, fn, cls) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (primary ? " primary" : "") + (cls ? " " + cls : "");
      b.textContent = label;
      b.onclick = fn;
      nav.appendChild(b);
      return b;
    };
    if (submitted) return;
    if (reviewing) {
      mk(T("questionBack"), false, function () { reviewing = false; renderQuestion(); });
      const submit = mk(T("questionSubmit"), true, function () {
        submit.disabled = true; submitted = true;
        const payload = questions.map(function (_, qi) { return chosen(qi); });
        replyQuest(q.id, payload).then(function () { d.remove(); afterPendingAnswered(); })
          .catch(function () { submit.disabled = false; submitted = false; });
      });
      return;
    }
    if (tab > 0) mk(T("questionBack"), false, function () { tab--; renderQuestion(); });
    if (tab < questions.length - 1) {
      mk(T("questionNext"), true, function () { tab++; renderQuestion(); });
    } else {
      mk(T("questionReview"), true, function () { reviewing = true; renderReview(); });
    }
    mk(T("questionSkip"), false, function () {
      submitted = true;
      rejectQuest(q.id).then(function () { d.remove(); afterPendingAnswered(); })
        .catch(function () { d.remove(); });
    }, "q-dismiss");
  }

  renderQuestion();
  container.appendChild(d);
  syncPendingDock();
  const first = questions[0] || {};
  notify(T("questTitle"), String(first.header || first.question || "").slice(0, 160));
}
function showError(container, errText) {
  const d = document.createElement("div");
  d.className = "error-box";
  const p = document.createElement("p");
  p.innerHTML = IC.alert + "<span>" + esc(T("modelFail") + " " + String(errText || "").slice(0, 300)) + "</span>";
  d.appendChild(p);
  const row = document.createElement("div");
  row.className = "row";
  const curKey = S.prefs.modelKey;
  MODELS.filter(function (m) { return modelKey(m) !== curKey; }).slice(0, 6).forEach(function (m) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = T("switchModel") + ": " + m.name;
    b.onclick = function () { S.prefs.modelKey = modelKey(m); savePrefs(); applyPrefs(); fillStatic(); d.remove(); };
    row.appendChild(b);
  });
  const r = document.createElement("button");
  r.className = "btn primary"; r.textContent = T("retry");
  r.onclick = function () { d.remove(); };
  row.appendChild(r);
  /* model router fallback: one click switches model and resends */
  const fbKey = S.prefs.routerFallback;
  if (fbKey && fbKey !== curKey && S.lastUserText) {
    const fb = MODELS.filter(function (m) { return modelKey(m) === fbKey; })[0];
    if (fb) {
      const f = document.createElement("button");
      f.className = "btn"; f.textContent = T("retryFallback") + ": " + fb.name;
      f.onclick = function () {
        S.prefs.modelKey = fbKey;
        savePrefs(); applyPrefs(); fillStatic();
        const t = S.lastUserText;
        d.remove();
        send(t);
      };
      row.appendChild(f);
    }
  }
  d.appendChild(row);
  container.appendChild(d);
  notify(T("modelFail"), String(errText || "").slice(0, 160));
}
function connectEvents(handler) {
  if (typeof EventSource === "undefined") return null;
  let es = null, backoff = 1000;
  const url = "/event" + qdir();
  const hook = function (e) {
    e.onmessage = function (m) {
      backoff = 1000;
      try { handler(JSON.parse(m.data)); } catch (err) {}
    };
    e.onerror = function () {
      try { e.close(); } catch (err2) {}
      backoff = Math.min(backoff * 2, 15000);
      setTimeout(connect, backoff);
    };
  };
  const connect = function () {
    try {
      es = new EventSource(url);
      hook(es);
      es._vexisUrl = url;
    } catch (e) { es = null; }
  };
  connect();
  /* expose a handle compatible with old callers (truthy while configured) */
  return { get _vexisUrl() { return url; }, close() { try { es && es.close(); } catch (e) {} } };
}
function lastAssistantPart(msgs, afterId) {
  let started = afterId == null, lastPart = null;
  for (const m of msgs) {
    const info = m.info || {};
    if (info.id === afterId) { started = true; continue; }
    if (!started || info.role !== "assistant") continue;
    const ps = m.parts || [];
    if (ps.length) lastPart = ps[ps.length - 1];
  }
  return lastPart;
}
async function streamTurn(userMsgId, bubble, actBox, shellDiv) {
  let last = "", stable = 0, userId = userMsgId || null;
  let sseText = "", engineIdle = null, idleAtCount = -1, turnError = false, lastMsgCount = -1;
  let thinkType = "thinking", toolRunning = false;
  /* Part-type registry so reasoning deltas can never be mistaken for answer
     text and leak into the reply bubble. Reasoning stays in its <details>. */
  const partTypes = {};
  let sseThink = "";
  /* typewriter: displayed text chases the target instead of dumping chunks */
  let shown = "", twTimer = null;
  const twReduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const draw = function (t) {
    bubble._vexisText = true;
    bubble.innerHTML = '<div class="md' + arCls(t) + '">' + esc(t).replace(/\n/g, "<br>") + "</div>";
    const w = $("chat-wrap");
    w.scrollTop = w.scrollHeight;
  };
  const twTick = function () {
    if (shown.length >= last.length) { clearInterval(twTimer); twTimer = null; return; }
    const diff = last.length - shown.length;
    const step = diff > 500 ? Math.ceil(diff / 5) : Math.min(diff, Math.max(3, Math.ceil(diff / 4)));
    shown = last.slice(0, shown.length + step);
    draw(shown);
  };
  const paint = function (text) {
    if (text.length <= last.length) return false;
    last = text; stable = 0;
    if (twReduced) { shown = text; draw(text); return true; }
    if (!twTimer) twTimer = setInterval(twTick, 26);
    return true;
  };
  let es = null;
  try {
  es = connectEvents(function (ev) {
    const p = ev.properties || {};
    if (p.sessionID && S.sessionID && p.sessionID !== S.sessionID) return;
    /* THE RUN IS OVER ONLY WHEN THE ENGINE GOES IDLE. An assistant message
       completes once per step (tools run in between) - the turn continues.
       idleAtCount: message count when idle arrived - any message after that
       proves it was a stray/early idle and can't end this turn. */
    if (ev.type === "session.idle") { engineIdle = true; idleAtCount = lastMsgCount; return; }
    if (ev.type === "session.status") {
      const isIdle = ((p.status || {}).type === "idle");
      engineIdle = isIdle;
      if (isIdle) idleAtCount = lastMsgCount;
      return;
    }
    if (ev.type === "session.error") { engineIdle = true; idleAtCount = lastMsgCount; turnError = true; return; }
    /* The interactive question card (photo-2 style with big option cards,
       progress + custom answer) is fed by this event + the global pending
       route. The old code ignored it, so the dock stayed empty (photo 4). */
    if (ev.type === "question.asked" && p.id) {
      if (S.shownQuests && !S.shownQuests.has(p.id)) {
        S.shownQuests.add(p.id);
        try { renderQuestCard(pendingDock(), p); } catch (e) {}
        try { syncPendingDock(); } catch (e2) {}
      }
      return;
    }
    if (ev.type === "message.part.delta" && p.field === "text") {
      const ptype = partTypes[p.partID];
      if (ptype === "reasoning" || ptype === "thinking") {
        sseThink += p.delta || "";
        thinkType = "thinking";
        updateThinking(actBox, thinkType);
        liveStep(actBox, "step-think", { kind: "think", label: T("stepThink") },
          { kind: "think", run: true, open: !!S.prefs.showThinking },
          '<div class="md sr-md">' + esc(sseThink.slice(-4000)) + "</div>");
        return;
      }
      /* Unknown part: let polling supply clean text rather than risk mixing in
         reasoning. Only known text parts may feed the reply bubble. */
      if (ptype !== "text") return;
      sseText += p.delta || "";
      if (!toolRunning) thinkType = "generating";
      updateThinking(actBox, thinkType);
      paint(sseText);
      return;
    }
    if (ev.type === "message.part.updated" && p.part) {
      const part = p.part;
      if (part.id) partTypes[part.id] = part.type;
      if (part.type === "text" && part.text && part.text.length > sseText.length) {
        sseText = part.text;
        if (!toolRunning) thinkType = "generating";
        updateThinking(actBox, thinkType);
        paint(sseText);
        return;
      }
      if (part.type === "reasoning" && (part.text || "").trim()) {
        sseThink = part.text;
        thinkType = "thinking";
        updateThinking(actBox, thinkType);
        liveStep(actBox, "step-think", { kind: "think", label: T("stepThink") },
          { kind: "think", run: true, open: !!S.prefs.showThinking },
          '<div class="md sr-md">' + esc(part.text.slice(-4000)) + "</div>");
      } else if (part.type === "tool") {
        const sts = String(((part.state || {}).status) || "");
        const running = !(sts === "completed" || sts === "error" || sts === "failed" || sts === "rejected");
        toolRunning = running;
        if (part.tool === "question") {
          /* pending questions live ONLY in the composer dock - no "Question...>"
             row in the stream; after completion the history render shows it */
          if (!running) {
            liveStep(actBox, stepKey(part),
              { kind: "quest", label: T("stepQuestion"), sum: questSum(part) },
              { kind: "quest", run: false,
                err: sts === "error" || sts === "failed" || sts === "rejected" },
              questBodyHTML(part));
          }
        } else {
          const m2 = stepMeta(part);
          liveStep(actBox, stepKey(part), m2,
            { kind: m2.kind, run: running,
              err: sts === "error" || sts === "failed" || sts === "rejected",
              open: !running && !!S.prefs.showToolDetails }, stepBodyHTML(part));
        }
        artAutoPush(part);
        if (running) {
          thinkType = toolThinkType(part.tool);
          updateThinking(actBox, thinkType, part.tool, part.state);
        }
      }
      return;
    }
  });
    const t0 = Date.now();
    let iter = 0;
    while (Date.now() - t0 < 1800000) {
      if (S.stopFlag || !S.sessionID) break;
      await sleep(iter++ === 0 ? (es ? 250 : 500) : (es ? 1000 : 600));
    let msgs;
    try {
      msgs = await GET("/session/" + S.sessionID + "/message?limit=200");
      if (!Array.isArray(msgs)) msgs = (msgs && msgs.data) || [];
    } catch (e) { continue; }
    if (!userId) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if ((msgs[i].info || {}).role === "user") { userId = (msgs[i].info || {}).id; break; }
      }
      if (!userId) continue;
    }
    const polled = assistantTextAfter(msgs, userId);
    const cur = sseText.length > polled.length ? sseText : polled;
    if (!paint(cur)) stable++;
    /* reconcile the live indicator (subtle status line) from polled state */
    const lp = lastAssistantPart(msgs, userId);
    if (lp && lp.type === "reasoning") { thinkType = "thinking"; toolRunning = false; }
    else if (lp && lp.type === "tool") {
      const sts = String(((lp.state || {}).status) || "");
      const running = !(sts === "completed" || sts === "error" || sts === "failed" || sts === "rejected");
      toolRunning = running;
      if (running) thinkType = toolThinkType(lp.tool);
      else if (bubble._vexisText) thinkType = "generating";
    } else {
      toolRunning = false;
      if (bubble._vexisText) thinkType = "generating";
    }
    updateThinking(actBox, thinkType,
      (lp && lp.type === "tool" && toolRunning) ? lp.tool : null,
      (lp && lp.type === "tool") ? lp.state : null);
    try { syncLiveSteps(msgs, userId, actBox); } catch (e) {}
    try {
      const perms = await pendingPerms();
      for (const q of perms) {
        const id = q.id || q.requestID;
        if (!S.shownPerms.has(id)) { S.shownPerms.add(id); renderPermCard(pendingDock(), q); }
      }
      const quests = await pendingQuests();
      for (const q of quests) {
        if (!S.shownQuests.has(q.id)) { S.shownQuests.add(q.id); renderQuestCard(pendingDock(), q); }
      }
      syncPendingDock();
    } catch (e) {}
    const lastMsg = msgs[msgs.length - 1];
    const lastInfo = (lastMsg && lastMsg.info) || {};
    const msgLive = lastInfo.role === "assistant" &&
      !(lastInfo.time && lastInfo.time.completed);
    lastMsgCount = msgs.length;
    const busy = toolRunning || msgLive || lastInfo.role === "user";
    if (busy) stable = 0;
    const quiet = !busy && lastInfo.role === "assistant";
    if (turnError) break;
    /* trust "idle" only if no message appeared after it (stray-idle guard);
       engine busy => 120 silent polls (dead-run escape); no status events =>
       60s with SSE / ~8 polls without */
    const trustIdle = engineIdle === true && idleAtCount === lastMsgCount;
    const patience = trustIdle ? 0 : (engineIdle === false ? 120 : (es ? 60 : 8));
    if (quiet && sessionDone(msgs) && stable >= patience) break;
    /* engine went idle without ever creating an assistant reply */
    if (trustIdle && lastInfo.role === "user") break;
  }
  } finally {
    if (twTimer) { clearInterval(twTimer); twTimer = null; }
    if (shown !== last) { shown = last; if (last) draw(last); }
    if (es) { try { es.close(); } catch (e) {} }
  }
  /* the completed "◇ Thought for Xs ˅" summary is rendered from history
     by refreshAfterTurn -> renderChat; nothing to collapse here. */
}
/* Empty-reply guard: if the turn ended with zero assistant text, delete the
   failed turn and re-send the same message once. Pending questions/permissions
   are never retried (the model waits for the user there - not a failure), and
   a turn that IS a question (answered or not) is a valid reply - never delete it. */
async function maybeRetryEmpty(shell, text) {
  try {
    if ((await pendingPerms()).length) return;
    if ((await pendingQuests()).length) return;
    const msgs = await GET("/session/" + S.sessionID + "/message?limit=200");
    const arr = Array.isArray(msgs) ? msgs : ((msgs && msgs.data) || []);
    let uidx = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (((arr[i].info || {}).role) === "user") { uidx = i; break; }
    }
    if (uidx === -1) return;
    const anchor = uidx > 0 ? ((arr[uidx - 1].info || {}).id || null) : null;
    if (assistantTextAfter(arr, anchor).trim()) return;
    /* the "reply" was a question - even fully answered ones have no text part;
       deleting here would wipe the user's answers from history */
    {
      let started = anchor == null;
      for (const m of arr) {
        const info = m.info || {};
        if (info.id === anchor) { started = true; continue; }
        if (!started || info.role !== "assistant") continue;
        const isQ = (m.parts || []).some(function (p) {
          return p.type === "question" || p.tool === "question";
        });
        if (isQ) return;
      }
    }
    /* remove the whole failed turn (newest first so deletes stay valid) */
    for (let i = arr.length - 1; i >= uidx; i--) {
      const id = (arr[i].info || {}).id;
      if (!id) continue;
      await DEL("/session/" + S.sessionID + "/message/" + id);
    }
    const model = currentModel();
    await POST("/session/" + S.sessionID + "/prompt_async", {
      model: modelPayload(),
      agent: S.prefs.agent || "build",
      parts: [{ type: "text", text }],
      system: IDENTITY.slice(0, 6000),
    });
    tiStart();
    await streamTurn(anchor, shell.bubble, shell.actBox, shell.div);
  } catch (e) { /* leave history as-is; renderChat shows "No response" + Retry */ }
}
async function send(text) {
  text = (text || "").trim();
  if (!text || S.streaming) return;
  if (text[0] !== "/" && !(text[0] === "!" && text.length > 1)) S.lastUserText = text;
  hidePopup();
  if (text[0] === "!" && text.length > 1) { runShell(text.slice(1)); return; }
  const m = text.match(/^\/(\S+)\s*([\s\S]*)$/);
  let cmd = null;
  if (m) {
    const lc = localCmd(m[1].toLowerCase());
    if (lc) { await runLocal(lc, m[2] || ""); return; }
    await ensureCommands();
    const hit = (S.commands || []).find(function (c) { return c.name === m[1]; });
    if (hit) cmd = { name: hit.name, args: m[2] || "" };
  }
  S.streaming = true; S.stopFlag = false;
  $("btn-send").classList.add("hidden");
  $("btn-stop").classList.remove("hidden");
  $("welcome").classList.add("hidden");
  renderUserBubble(text, S.attachments.slice());
  const shell = renderAssistantShell();
  let turnOk = false;
  try {
    const sid = await ensureSession(text);
    const model = currentModel();
    const parts = [];
    for (const a of S.attachments) {
      parts.push({ type: "file", mime: a.mime, filename: a.name, url: a.dataUrl });
    }
    S.attachments = [];
    renderAttachments();
    try {
      const mentioned = await collectFileParts(text);
      for (const fp of mentioned) parts.push(fp);
    } catch (e) {}
    parts.push({ type: "text", text });
    let beforeId = null;
    try {
      const ms = await GET("/session/" + sid + "/message?limit=5");
      const arr = Array.isArray(ms) ? ms : (ms.data || []);
      if (arr.length) beforeId = (arr[arr.length - 1].info || {}).id || null;
    } catch (e) {}
    if (cmd) {
      await POST("/session/" + sid + "/command", {
        command: cmd.name, arguments: cmd.args, agent: S.prefs.agent || "build", model: model.modelID,
      });
    } else {
      await POST("/session/" + sid + "/prompt_async", {
        model: modelPayload(),
        agent: S.prefs.agent || "build",
        parts, system: await buildSystem(),
      });
    }
    await streamTurn(beforeId, shell.bubble, shell.actBox, shell.div);
    if (!cmd && !S.stopFlag && !parts.some(function (p) { return p.type === "file"; })) {
      await maybeRetryEmpty(shell, text);
    }
    await refreshAfterTurn(text);
    turnOk = true;
  } catch (e) {
    shell.div.remove();
    showError($("chat"), e.message);
  } finally {
    tiStop();
    shell.div.classList.remove("streaming");
    const pav = shell.div.querySelector(".msg-avatar");
    if (pav) pav.classList.remove("pulsing");
    const live = shell.div.querySelector(".think-live");
    if (live) live.remove();
    S.streaming = false;
    $("btn-send").classList.remove("hidden");
    $("btn-stop").classList.add("hidden");
    if (turnOk && !S.stopFlag) notify($("session-title").textContent, T("done"));
  }
}
function renderUserBubble(text, atts) {
  const chat = $("chat");
  const div = document.createElement("div");
  div.className = "msg-row user";
  const av = document.createElement("div");
  av.className = "msg-avatar"; av.textContent = "U";
  const body = document.createElement("div");
  body.className = "msg-body";
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const who = document.createElement("span");
  who.textContent = T("you");
  meta.appendChild(who);
  const bub = document.createElement("div");
  bub.className = "msg-content";
  bub.innerHTML = chipsHTML(atts) + '<div class="utext' + arCls(text) + '">' + userTextHTML(text) + "</div>";
  body.appendChild(meta); body.appendChild(bub);
  div.appendChild(av); div.appendChild(body);
  chat.appendChild(div);
  const w = $("chat-wrap");
  w.scrollTop = w.scrollHeight;
}
function renderAssistantShell() {
  const chat = $("chat");
  const div = document.createElement("div");
  div.className = "msg-row assistant streaming";
  const av = document.createElement("div");
  av.className = "msg-avatar pulsing"; av.textContent = "V";
  const body = document.createElement("div");
  body.className = "msg-body";
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const who = document.createElement("span");
  who.textContent = T("vexis");
  meta.appendChild(who);
  const actBox = document.createElement("div");
  actBox.innerHTML = thinkingIndicatorHTML("thinking");
  tiStart();
  const bub = document.createElement("div");
  bub.className = "msg-content";
  body.appendChild(meta); body.appendChild(actBox); body.appendChild(bub);
  div.appendChild(av); div.appendChild(body);
  chat.appendChild(div);
  const w = $("chat-wrap");
  w.scrollTop = w.scrollHeight;
  return { div: div, bubble: bub, actBox: actBox };
}
async function syncMessages() {
  try {
    const msgs = await GET("/session/" + S.sessionID + "/message?limit=200");
    S.messages = Array.isArray(msgs) ? msgs : ((msgs && msgs.data) || []);
  } catch (e) {}
  renderChat();
}
/* keep the /todo checklist card in sync when the engine's list changes */
async function checkTodoCard() {
  if (!S.sessionID) return;
  try {
    const out = await GET("/session/" + S.sessionID + "/todo");
    const arr = Array.isArray(out) ? out : ((out && out.data) || []);
    const str = JSON.stringify(arr);
    if (str === S.lastTodoStr) return;
    S.lastTodoStr = str;
    if (!arr.length) { sysRemove("todo"); return; }
    sysCard("todo", todoCardHTML(arr));
  } catch (e) {}
}
async function refreshAfterTurn(firstText) {
  try {
    const info = await GET("/session/" + S.sessionID);
    S.revertID = (info && info.revert && info.revert.messageID) || null;
    let title = info && info.title;
    if (!title || /^new session/i.test(title)) {
      const t = (firstText || "").trim();
      if (t) {
        title = t.slice(0, 60);
        try { await api("PATCH", "/session/" + S.sessionID, { title }); } catch (e) {}
      }
    }
    $("session-title").textContent = title || "Vexis";
  } catch (e) {}
  await syncMessages();
  if (!$("rsb").classList.contains("hidden")) renderRSB().catch(function () {});
  beep();
  await checkTodoCard();
  loadSessions($("search").value.trim()).catch(function () {});
}
/* delete the answered turn (user msg + every assistant msg after it) and
   re-send the same text: no duplicate user bubble, no leftover empty reply */
async function resendFromRow(rowDiv) {
  if (S.streaming || S.resending || !rowDiv || !S.sessionID) return;
  S.resending = true;
  try {
    let prev = rowDiv.previousElementSibling, userRow = null;
    while (prev) {
      if (prev.classList && prev.classList.contains("msg-row") && prev.classList.contains("user")) {
        userRow = prev;
        break;
      }
      prev = prev.previousElementSibling;
    }
    if (!userRow) return;
    const userMid = userRow.dataset.mid || "";
    const arr = S.messages || [];
    let uidx = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (((arr[i].info || {}).id) === userMid) { uidx = i; break; }
    }
    if (uidx === -1) return;
    const text = messageText(arr[uidx]);
    if (!text.trim()) return;
    for (let i = arr.length - 1; i >= uidx; i--) {
      const id = (arr[i].info || {}).id;
      if (!id) continue;
      try { await DEL("/session/" + S.sessionID + "/message/" + id); } catch (e) { return; }
    }
    S.messages = arr.slice(0, uidx);
    renderChat();
    S.resending = false;
    send(text);
  } finally {
    S.resending = false;
  }
}
async function regenerate(anchorDiv) {
  resendFromRow(anchorDiv);
}
function exportMD() {
  const lines = ["# " + $("session-title").textContent];
  for (const m of S.messages) {
    const info = m.info || {};
    if (info.role !== "user" && info.role !== "assistant") continue;
    lines.push("");
    lines.push("## " + (info.role === "user" ? T("you") : T("vexis")) +
      (msgTime(m) ? " (" + msgTime(m) + ")" : ""));
    lines.push(messageText(m) || "");
    for (const p of m.parts || []) {
      if (p.type === "tool") lines.push("> [" + toolTitle(p.tool, p.state) + "]");
    }
  }
  copyText(lines.join("\n"));
  toast(T("exported"));
}
/* ---------- system cards: local command results, statuses, todo ---------- */
function renderSysCards() {
  const box = $("sys-cards");
  if (!box) return;
  box.innerHTML = S.sysCards.map(function (c) {
    return '<div class="msg-row system"><div class="msg-avatar">i</div><div class="msg-body">' +
      '<div class="msg-content sys-card" data-sys="' + esc(c.id) + '">' + c.html + "</div></div></div>";
  }).join("");
  const w = $("chat-wrap");
  w.scrollTop = w.scrollHeight;
}
function sysCard(id, html) {
  const card = { id: id, html: html };
  const i = S.sysCards.findIndex(function (c) { return c.id === id; });
  if (i >= 0) S.sysCards[i] = card; else S.sysCards.push(card);
  renderSysCards();
  return document.querySelector('#sys-cards [data-sys="' + CSS.escape(id) + '"]');
}
function sysRemove(id) {
  const n = S.sysCards.length;
  S.sysCards = S.sysCards.filter(function (c) { return c.id !== id; });
  if (S.sysCards.length !== n) renderSysCards();
}
function cmdCard(name, html) { return sysCard("cmd-" + name, html); }

/* Windows toast when the window is in the background (server -> toast.ps1) */
function notify(title, msg) {
  try {
    if (document.hasFocus()) return;
    const h = { "Content-Type": "application/json" };
    if (S.secret) h["X-Vexis-Secret"] = S.secret;
    fetch("/vexis/toast", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ title: String(title || "Vexis").slice(0, 80), message: String(msg || "").slice(0, 240) }),
    }).catch(function () {});
  } catch (e) {}
}

/* ---------- local slash commands (implemented in the UI, no engine roundtrip) ---------- */
async function ensureCommands() {
  if (S.commands) return S.commands;
  try {
    await workspaceDir();
    const list = await GET("/command" + qdir());
    S.commands = Array.isArray(list) ? list : (list.data || []);
  } catch (e) { S.commands = []; }
  return S.commands;
}
function lastUserMsgId() {
  const a = S.messages || [];
  for (let i = a.length - 1; i >= 0; i--) {
    if (((a[i].info || {}).role) === "user") return (a[i].info || {}).id || null;
  }
  return null;
}
function modelPayload() {
  const model = currentModel();
  const payload = { providerID: model.providerID, modelID: model.modelID };
  if (S.prefs.variantKey && S.prefs.variantKey !== "default" &&
      model.variants && model.variants[S.prefs.variantKey]) {
    payload.variant = S.prefs.variantKey;
  }
  return payload;
}
/* task phases (Plan -> Act -> Observe -> Verify) derived from the live
   turn: todos = plan, tool calls = act, tool outputs = observe,
   diff/test activity = verify. Display only - the engine runs the loop. */
function taskPhaseHTML() {
  let tools = [], outputs = 0, verify = 0;
  const msgs = S.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (((msgs[i].info || {}).role) !== "assistant") continue;
    for (const p of (msgs[i].parts || [])) {
      if (p.type === "tool" && p.tool) {
        if (tools.indexOf(p.tool) < 0) tools.push(p.tool);
        const st = p.state || {};
        if (st.output != null && String(st.output).trim()) outputs++;
        if (p.tool === "question") continue;
        if (/test|diff|verify|check|build/i.test(p.tool)) verify++;
      }
    }
    break;
  }
  const chip = function (label, val, on) {
    return '<div class="phase-chip' + (on ? " on" : "") + '"><span>' + esc(label) +
      "</span><b>" + esc(val) + "</b></div>";
  };
  return '<div class="phase-strip">' +
    chip(T("phPlan"), "●", true) +
    chip(T("phAct"), tools.length ? tools.slice(0, 3).join(", ") : "—", tools.length > 0) +
    chip(T("phObserve"), String(outputs), outputs > 0) +
    chip(T("phVerify"), String(verify), verify > 0) +
    "</div>";
}
function todoCardHTML(arr) {
  if (!arr || !arr.length) return "<p class='muted'>" + esc(T("todoEmpty")) + "</p>";
  const items = arr.slice(0, 15).map(function (t) {
    const st = String(t.status || "pending");
    const cls = st === "completed" ? "done" : (st === "in_progress" ? "prog" : "");
    const box = st === "completed" ? "✓" : (st === "in_progress" ? "◐" : "○");
    return '<div class="todo-item ' + cls + '"><span class="tbox">' + box + "</span><span>" +
      esc(t.content || "") + "</span><small>" + esc(st) + "</small></div>";
  }).join("");
  return "<h5>" + esc(T("todoTitle")) + "</h5>" + items;
}
function diffLineHTML(l) {
  const t = typeof l === "string" ? l : String((l && (l.content || l.line)) || "");
  let ty = "";
  if (typeof l === "string") { if (t[0] === "+") ty = "add"; else if (t[0] === "-") ty = "del"; }
  else if (l && (l.type === "add" || l.added)) ty = "add";
  else if (l && (l.type === "del" || l.deleted || l.removed)) ty = "del";
  else if (l && (l.type === "header" || l.header)) ty = "hdr";
  return '<div class="diff-line ' + ty + '">' + esc(t) + "</div>";
}
function diffCardHTML(diff) {
  const arr = Array.isArray(diff) ? diff : ((diff && diff.data) || []);
  if (!arr.length) return "<p class='muted'>" + esc(T("noDiff")) + "</p>";
  const files = arr.map(function (f) {
    if (typeof f === "string") return '<div class="diff-file"><div class="df-path">' + esc(f) + "</div></div>";
    const path = f.path || f.file || f.filePath || "?";
    let adds = f.additions || f.add || 0, dels = f.deletions || f.del || 0;
    if (!adds && !dels && (f.patch || f.diff)) {
      String(f.patch || f.diff).split("\n").forEach(function (ln) {
        if (ln.charAt(0) === "+" && ln.indexOf("+++") !== 0) adds++;
        else if (ln.charAt(0) === "-" && ln.indexOf("---") !== 0) dels++;
      });
    }
    let body = "";
    if (Array.isArray(f.lines)) body = f.lines.map(diffLineHTML).join("");
    else if (Array.isArray(f.chunks)) {
      body = f.chunks.map(function (c) {
        return (c.header ? '<div class="diff-line hdr">' + esc(c.header) + "</div>" : "") +
          ((c.lines || []).map(diffLineHTML).join(""));
      }).join("");
    } else if (f.patch || f.diff) body = "<pre>" + esc(String(f.patch || f.diff).slice(0, 8000)) + "</pre>";
    else body = "<pre>" + esc(JSON.stringify(f, null, 1).slice(0, 3000)) + "</pre>";
    return '<div class="diff-file"><div class="df-path">' + esc(path) +
      '<span class="df-stat"><span class="add">+' + adds + '</span> <span class="del">-' + dels +
      "</span></span></div><div class=\"df-body\">" + body + "</div></div>";
  }).join("");
  return "<h5>" + esc(T("diffTitle")) + "</h5>" + files;
}

async function cmdCompact() {
  cmdCard("compact", "<p class='muted'>" + esc(T("compactBusy")) + "</p>");
  const model = currentModel();
  const ok = await POST("/session/" + S.sessionID + "/summarize",
    { providerID: model.providerID, modelID: model.modelID });
  if (ok === false) throw new Error("summarize failed");
  cmdCard("compact", "<p>" + esc(T("compactDone")) + "</p>");
  await syncMessages();
}
async function cmdUndo() {
  const uid = lastUserMsgId();
  if (!uid) { cmdCard("undo", "<p class='muted'>" + esc(T("noTurn")) + "</p>"); return; }
  await POST("/session/" + S.sessionID + "/revert", { messageID: uid });
  const info = await GET("/session/" + S.sessionID);
  S.revertID = (info && info.revert && info.revert.messageID) || uid;
  await syncMessages();
  cmdCard("undo", "<p>" + esc(T("undoDone")) + "</p>");
}
async function cmdRedo() {
  await POST("/session/" + S.sessionID + "/unrevert");
  S.revertID = null;
  await syncMessages();
  cmdCard("redo", "<p>" + esc(T("redoDone")) + "</p>");
}
async function cmdShare() {
  const out = await POST("/session/" + S.sessionID + "/share");
  const url = (out && ((out.share && out.share.url) || out.url)) || "";
  const el = cmdCard("share",
    "<p>" + esc(T("shareNote")) + "</p><p class='mono'>" + esc(url) + "</p>" +
    "<div class='row'><button class='btn' data-sharecopy>" + esc(T("copy")) + "</button></div>");
  if (el) {
    const b = el.querySelector("[data-sharecopy]");
    if (b) b.onclick = function () { copyText(url); b.textContent = T("copied"); };
  }
}
async function cmdUnshare() {
  await DEL("/session/" + S.sessionID + "/share");
  cmdCard("share", "<p>" + esc(T("unshareDone")) + "</p>");
}
async function cmdTools() {
  let ids = await GET("/experimental/tool/ids");
  ids = Array.isArray(ids) ? ids : ((ids && ids.data) || []);
  let mcp = [];
  try {
    const m = await GET("/mcp" + qdir());
    if (Array.isArray(m)) mcp = m;
    else if (m && m.data && Array.isArray(m.data)) mcp = m.data;
    else if (m && typeof m === "object") mcp = Object.keys(m);
  } catch (e) {}
  const chips = ids.map(function (id) { return '<span class="chip">' + esc(id) + "</span>"; }).join("");
  let html = "<h5>" + esc(T("toolsCount").replace("{n}", ids.length)) + "</h5>" +
    '<div class="chip-row">' + chips + "</div>";
  if (mcp.length) html += "<p class='muted'>" + esc(T("mcpCount").replace("{n}", mcp.length)) + "</p>";
  cmdCard("tools", html);
}
async function cmdMemory() {
  await workspaceDir();
  const cfg = await GET("/vexis/config").catch(function () { return null; });
  let home = "";
  if (cfg && cfg.path) home = String(cfg.path).replace(/[\\\/]\.config[\\\/]opencode[\\\/][^\\\/]+$/, "");
  const candidates = [];
  if (S.dir) candidates.push({ label: "project", path: S.dir + "\\AGENTS.md" });
  if (home) {
    candidates.push({ label: "global", path: home + "\\.config\\opencode\\AGENTS.md" });
    candidates.push({ label: "global", path: home + "\\.config\\opencode\\AGENTS.local.md" });
  }
  let found = 0, body = "";
  for (const c of candidates) {
    let content = "";
    try {
      const out = await GET("/file/content?directory=" + encodeURIComponent(S.dir || "") +
        "&path=" + encodeURIComponent(c.path));
      content = (out && out.content) || "";
    } catch (e) {}
    if (!content) {
      body += '<div class="todo-item"><span class="tbox">○</span><span class="mono">' +
        esc(c.path) + "</span></div>";
      continue;
    }
    found++;
    body += '<div class="todo-item done"><span class="tbox">✓</span><span class="mono">' +
      esc(c.path) + "</span></div><details><summary>" + esc(c.label) +
      "</summary><pre>" + esc(content.slice(0, 4000)) + "</pre></details>";
  }
  const instructions = (cfg && cfg.content) ? (parseJsoncSafe(cfg.content) || {}) : {};
  const ilist = Array.isArray(instructions.instructions) ? instructions.instructions : [];
  ilist.forEach(function (line) {
    found++;
    body += '<details><summary>config instructions</summary><pre>' + esc(String(line).slice(0, 4000)) + "</pre></details>";
  });
  const head = found
    ? "<h5>" + esc(T("memoryFound").replace("{n}", found)) + "</h5>"
    : "<h5>" + esc(T("memoryNone")) + "</h5>";
  cmdCard("memory", head + body);
}
function parseJsoncSafe(text) {
  try { return parseJsonc(text); } catch (e) { return null; }
}
async function cmdContext() {
  const u = lastUsage();
  const tok = u.tok, cost = u.cost;
  if (!tok) { cmdCard("ctx", "<p class='muted'>" + esc(T("ctxNoData")) + "</p>"); return; }
  const lim = u.model.context || 0;
  const used = +tok.input || 0;
  const pct = lim ? Math.min(100, Math.round(used / lim * 100)) : 0;
  const cls = pct > 85 ? "full" : (pct > 65 ? "hot" : "");
  let html = "<h5>" + esc(T("ctxLbl")) + "</h5>";
  if (lim) html += '<div class="ctx-bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div>';
  html += '<div class="todo-item"><span class="tbox">·</span><span>' + esc(T("tokensLbl")) +
    "</span><small>" + fmtTok(used) + (lim ? " / " + fmtTok(lim) + " (" + pct + "%)" : "") + "</small></div>";
  html += '<div class="todo-item"><span class="tbox">·</span><span>input</span><small>' + fmtTok(tok.input || 0) + "</small></div>";
  html += '<div class="todo-item"><span class="tbox">·</span><span>output</span><small>' + fmtTok(tok.output || 0) + "</small></div>";
  if (tok.reasoning) html += '<div class="todo-item"><span class="tbox">·</span><span>reasoning</span><small>' + fmtTok(tok.reasoning) + "</small></div>";
  if (cost) {
    const ct = +cost.total || 0;
    html += '<div class="todo-item"><span class="tbox">·</span><span>' + esc(T("costLbl")) +
      "</span><small>$" + ct.toFixed(5) + "</small></div>";
  }
  cmdCard("ctx", html);
}
async function cmdThinking() {
  S.prefs.showThinking = !S.prefs.showThinking;
  savePrefs();
  const st = $("set-thinking");
  if (st) st.checked = S.prefs.showThinking;
  renderChat();
  cmdCard("thinking", "<p>" + esc(T("thinkingShow") + " · " + (S.prefs.showThinking ? T("on") : T("off"))) + "</p>");
}
async function cmdDetails() {
  S.prefs.showToolDetails = !S.prefs.showToolDetails;
  savePrefs();
  const sd = $("set-details");
  if (sd) sd.checked = S.prefs.showToolDetails;
  renderChat();
  cmdCard("details", "<p>" + esc(T("detailsShow") + " · " + (S.prefs.showToolDetails ? T("on") : T("off"))) + "</p>");
}
async function cmdDiff() {
  /* engine diffs against the snapshot at a given message: anchor on the FIRST
     user message so the card shows everything this session changed on disk */
  const a = S.messages || [];
  let anchor = null;
  for (const m of a) {
    const inf = m.info || {};
    if (inf.role === "user" && inf.id) { anchor = inf.id; break; }
  }
  if (!anchor) { cmdCard("diff", "<p class='muted'>" + esc(T("noDiff")) + "</p>"); return; }
  const out = await GET("/session/" + S.sessionID + "/diff?messageID=" + encodeURIComponent(anchor));
  cmdCard("diff", diffCardHTML(out));
}
async function cmdTodo() {
  const out = await GET("/session/" + S.sessionID + "/todo");
  const arr = Array.isArray(out) ? out : ((out && out.data) || []);
  S.lastTodoStr = JSON.stringify(arr);
  cmdCard("todo", todoCardHTML(arr));
}
async function cmdOcr() {
  cmdCard("ocr", "<p class='muted'>/ocr …</p>");
  try {
    const r = await POST("/vexis/ocr", {});
    const t = String((r && r.text) || "").trim();
    cmdCard("ocr", t
      ? "<pre>" + esc(t.slice(0, 6000)) + "</pre>"
      : "<p class='muted'>" + esc(T("ocrEmpty")) + "</p>");
  } catch (e) {
    cmdCard("ocr", "<p>" + esc(String((e && e.message) || e).slice(0, 200)) + "</p>");
  }
}
async function cmdShot() {
  cmdCard("screenshot", "<p class='muted'>/screenshot …</p>");
  try {
    const r = await POST("/vexis/shot", {});
    if (r && r.image) {
      S.attachments.push({ name: "screenshot.png", mime: "image/png", dataUrl: r.image });
      renderAttachments();
      cmdCard("screenshot", "<p>" + esc(T("shotDone")) + "</p>");
    } else {
      cmdCard("screenshot", "<p class='muted'>" + esc(T("ocrEmpty")) + "</p>");
    }
  } catch (e) {
    cmdCard("screenshot", "<p>" + esc(String((e && e.message) || e).slice(0, 200)) + "</p>");
  }
}
async function cmdHelp() {
  await ensureCommands();
  const local = LOCAL_CMDS.map(function (c) {
    return '<div class="todo-item"><span class="tbox">/</span><span><b>/' + c.n + "</b> — " + esc(T(c.d)) + "</span></div>";
  }).join("");
  const eng = (S.commands || []).map(function (c) {
    return '<div class="todo-item"><span class="tbox">/</span><span><b>/' + esc(c.name) + "</b>" +
      (c.description ? " — " + esc(c.description) : "") + "</span></div>";
  }).join("");
  const tips = '<div class="todo-item"><span class="tbox">!</span><span>' + esc(T("descShell")) + "</span></div>" +
    '<div class="todo-item"><span class="tbox">@</span><span>' + esc(T("hint")) + "</span></div>" +
    '<div class="todo-item"><span class="tbox">⌘</span><span>' + esc(T("keybindPalette")) + " · Ctrl+P</span></div>";
  cmdCard("help", "<h5>" + esc(T("descHelp")) + "</h5>" + local + tips +
    (eng ? "<h5 style='margin-top:8px'>engine</h5>" + eng : ""));
}

const LOCAL_CMDS = [
  { n: "compact", a: ["summarize"], d: "descCompact", needSession: true, run: cmdCompact },
  { n: "undo", d: "descUndo", needSession: true, run: cmdUndo },
  { n: "redo", d: "descRedo", needSession: true, run: cmdRedo },
  { n: "share", d: "descShare", needSession: true, run: cmdShare },
  { n: "unshare", d: "descUnshare", needSession: true, run: cmdUnshare },
  { n: "tools", d: "descTools", run: cmdTools },
  { n: "memory", d: "descMemory", run: cmdMemory },
  { n: "context", a: ["ctx"], d: "descContext", needSession: true, run: cmdContext },
  { n: "thinking", d: "descThinking", run: cmdThinking },
  { n: "details", d: "descDetails", run: cmdDetails },
  { n: "diff", d: "descDiff", needSession: true, run: cmdDiff },
  { n: "todo", d: "descTodo", needSession: true, run: cmdTodo },
  { n: "ocr", d: "descOcr", run: cmdOcr },
  { n: "screenshot", a: ["shot"], d: "descShot", run: cmdShot },
  { n: "help", a: ["?"], d: "descHelp", run: cmdHelp },
];
function localCmd(name) {
  return LOCAL_CMDS.find(function (c) {
    return c.n === name || (c.a || []).indexOf(name) >= 0;
  }) || null;
}
async function runLocal(lc, args) {
  if (lc.needSession && !S.sessionID) {
    cmdCard(lc.n, "<p class='muted'>" + esc(T("noSessionErr")) + "</p>");
    return;
  }
  S.streaming = true;
  $("btn-send").classList.add("hidden");
  $("btn-stop").classList.remove("hidden");
  $("welcome").classList.add("hidden");
  cmdCard(lc.n, "<p class='muted'>/" + esc(lc.n) + " …</p>");
  try {
    await lc.run(args || "");
  } catch (e) {
    cmdCard(lc.n, "<p>" + esc(T("modelFail") + " " + String((e && e.message) || e).slice(0, 200)) + "</p>");
  } finally {
    S.streaming = false;
    $("btn-send").classList.remove("hidden");
    $("btn-stop").classList.add("hidden");
  }
}

/* ---------- !shell: run a command via the engine ---------- */
async function runShell(cmdText) {
  cmdText = (cmdText || "").trim();
  if (!cmdText || S.streaming) return;
  S.streaming = true; S.stopFlag = false;
  $("btn-send").classList.add("hidden");
  $("btn-stop").classList.remove("hidden");
  $("welcome").classList.add("hidden");
  sysCard("shell", "<p class='muted mono'>! " + esc(cmdText) + " — " + esc(T("shellRunning")) + "</p>");
  try {
    const sid = await ensureSession("!" + cmdText);
    await POST("/session/" + sid + "/shell", { agent: S.prefs.agent || "build", command: cmdText });
    sysRemove("shell");
    await syncMessages();
    checkTodoCard().catch(function () {});
    loadSessions($("search").value.trim()).catch(function () {});
  } catch (e) {
    sysCard("shell", "<p>" + esc(T("shellFail") + " " + String((e && e.message) || e).slice(0, 200)) + "</p>");
  } finally {
    S.streaming = false;
    S.stopFlag = false;
    $("btn-send").classList.remove("hidden");
    $("btn-stop").classList.add("hidden");
  }
}

/* ---------- @file: resolve mentions to text/file parts before sending ---------- */
async function collectFileParts(text) {
  const seen = {}, parts = [];
  const re = /(^|\s)@"([^"]+)"|(^|\s)@([^\s]+)/g;
  let mm;
  while ((mm = re.exec(text)) && parts.length < 5) {
    const raw = (mm[2] || mm[4] || "").trim();
    if (!raw || seen[raw]) continue;
    seen[raw] = 1;
    if (/[\\\/]/.test(raw) || /\.\w+$/.test(raw)) {
      /* looks like a path - resolve it */
    } else continue;
    const abs = /^[a-zA-Z]:[\\/]/.test(raw) || raw.indexOf("\\\\") === 0
      ? raw : (S.dir ? S.dir + "\\" + raw : raw);
    try {
      const out = await GET("/file/content?directory=" + encodeURIComponent(S.dir || "") +
        "&path=" + encodeURIComponent(abs));
      const content = (out && out.content) || "";
      if (!content || content.length > 200000) continue;
      const b64 = btoa(unescape(encodeURIComponent(content)));
      parts.push({
        type: "file", mime: "text/plain",
        filename: raw.replace(/^.*[\\\/]/, "") || raw,
        url: "data:text/plain;base64," + b64,
      });
    } catch (e) {}
  }
  return parts;
}

/* ---------- command palette (Ctrl+P) ---------- */
let palIdx = 0, palFiltered = [];
function paletteItems() {
  const items = [];
  LOCAL_CMDS.forEach(function (c) {
    items.push({ label: "/" + c.n, desc: T(c.d), run: function () { send("/" + c.n); } });
  });
  (S.commands || []).forEach(function (c) {
    items.push({ label: "/" + c.name, desc: c.description || "", run: function () { send("/" + c.name); } });
  });
  items.push({ label: "!", desc: T("descShell"), run: function () { $("input").focus(); } });
  items.push({ label: T("newChat"), desc: "", run: function () { newChat(); } });
  items.push({ label: T("settings"), desc: "", run: function () { setInspector(true); } });
  ["general", "appearance", "models", "agents", "permissions", "mcp", "config", "about"].forEach(function (tab) {
    items.push({
      label: T("settings") + " · " + tab, desc: "",
      run: function () {
        setInspector(true);
        const nav = document.querySelector('.settings-nav[data-tab="' + tab + '"]');
        if (nav) nav.click();
      },
    });
  });
  items.push({ label: T("theme"), desc: "", run: function () {
    S.prefs.theme = S.prefs.theme === "black" ? "light" : "black";
    savePrefs(); applyPrefs(); syncThemeSeg();
  } });
  items.push({ label: "Markdown", desc: T("exported"), run: function () { exportMD(); } });
  items.push({ label: T("switchModel"), desc: currentModel().name, run: function () {
    const b = $("model-picker-btn");
    if (b) b.click();
  } });
  return items;
}
function openPalette() {
  const p = $("palette");
  if (!p) return;
  ensureCommands().catch(function () {});
  p.classList.remove("hidden");
  const inp = $("palette-input");
  inp.value = ""; palIdx = 0;
  renderPalette();
  inp.focus();
}
function closePalette() {
  const p = $("palette");
  if (p) p.classList.add("hidden");
}
function togglePalette() {
  const p = $("palette");
  if (!p) return;
  if (p.classList.contains("hidden")) openPalette(); else closePalette();
}
function renderPalette() {
  const inp = $("palette-input");
  const q = (inp ? inp.value : "").trim().toLowerCase();
  palFiltered = paletteItems().filter(function (it) {
    return !q || (it.label + " " + (it.desc || "")).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 30);
  if (palIdx >= palFiltered.length) palIdx = 0;
  const list = $("palette-list");
  if (!list) return;
  list.innerHTML = palFiltered.map(function (it, i) {
    return '<button type="button" class="palette-item' + (i === palIdx ? " active" : "") +
      '" data-i="' + i + '"><span>' + esc(it.label) + '</span><span class="desc">' +
      esc(it.desc || "") + "</span></button>";
  }).join("");
  list.querySelectorAll(".palette-item").forEach(function (b) {
    b.onclick = function () { runPalette(+b.dataset.i); };
    b.onmouseenter = function () {
      palIdx = +b.dataset.i;
      list.querySelectorAll(".palette-item").forEach(function (x, xi) {
        x.classList.toggle("active", xi === palIdx);
      });
    };
  });
}
function runPalette(i) {
  const it = palFiltered[i];
  closePalette();
  if (it && it.run) { try { it.run(); } catch (e) {} }
}

/* ---------- composer: popup, attach, send/stop ---------- */
function hidePopup() { $("popup").classList.add("hidden"); }
function showPopup(items, onPick) {
  const p = $("popup");
  p.innerHTML = "";
  if (!items.length) { hidePopup(); return; }
  items.slice(0, 10).forEach(function (it) {
    const b = document.createElement("button");
    const label = document.createElement("span");
    label.textContent = it.label;
    b.appendChild(label);
    if (it.desc) {
      const d = document.createElement("span");
      d.className = "desc"; d.textContent = it.desc;
      b.appendChild(d);
    }
    b.onclick = function () { hidePopup(); onPick(it); $("input").focus(); };
    p.appendChild(b);
  });
  const r = $("composer").getBoundingClientRect();
  const z = uiZoom();
  p.style.left = Math.max(8, r.left + 12) / z + "px";
  p.style.bottom = ((window.innerHeight - r.top + 6) / z) + "px";
  p.style.top = "auto";
  p.classList.remove("hidden");
}
async function handlePopup() {
  const v = $("input").value;
  const slash = v.match(/^\/(\S*)$/);
  if (slash) {
    await ensureCommands();
    const q = slash[1].toLowerCase();
    const hits = [];
    LOCAL_CMDS.forEach(function (c) {
      const names = [c.n].concat(c.a || []);
      for (const nm of names) {
        if (("/" + nm).toLowerCase().indexOf("/" + q) === 0) {
          hits.push({ label: "/" + c.n, desc: T(c.d), insert: "/" + c.n + " " });
          break;
        }
      }
    });
    (S.commands || []).forEach(function (c) {
      if ((c.name || "").toLowerCase().indexOf(q) === 0) {
        hits.push({ label: "/" + c.name, desc: c.description || "", insert: "/" + c.name + " " });
      }
    });
    showPopup(hits, function (it) { $("input").value = it.insert || ""; });
    return;
  }
  const at = v.match(/@([^\s]*)$/);
  if (at) {
    let files = [];
    try {
      await workspaceDir();
      const out = await GET("/find/file" + qdir() + "&query=" + encodeURIComponent(at[1] || "") + "&limit=12");
      files = Array.isArray(out) ? out : (out.data || out.files || []);
    } catch (e) { files = []; }
    showPopup(files.map(function (f) {
      const p = typeof f === "string" ? f : (f.path || f.file || "");
      return { label: "@" + p, desc: "", pick: p };
    }), function (it) {
      $("input").value = v.replace(/@[^\s]*$/, "@" + it.pick + " ");
    });
    return;
  }
  hidePopup();
}
function renderAttachments() {
  const box = $("attachments");
  box.innerHTML = "";
  S.attachments.forEach(function (a, i) {
    const img = document.createElement("img");
    img.src = a.dataUrl; img.title = a.name + " (" + T("removeImg") + ")";
    img.onclick = function () { S.attachments.splice(i, 1); renderAttachments(); };
    box.appendChild(img);
  });
}
function fillKb(sel, opts, val) {
  if (!sel) return;
  sel.innerHTML = "";
  opts.forEach(function (o) {
    const el = document.createElement("option");
    el.value = o[0]; el.textContent = o[1];
    sel.appendChild(el);
  });
  sel.value = val;
}
function fillStatic() {
  /* never let a missing element or stale i18n bundle abort init - that froze
     the whole app on the French static shell with a dead send button */
  try {
  const sl = $("set-lang");
  if (!sl) return;
  sl.innerHTML = "";
  const locales = (typeof VEXIS_LOCALES !== "undefined" && VEXIS_LOCALES) || [];
  locales.forEach(function (pair) {
    const o = document.createElement("option");
    o.value = pair[0]; o.textContent = pair[1];
    sl.appendChild(o);
  });
  const sm = $("set-model");
  sm.innerHTML = "";
  MODELS.forEach(function (m, i) {
    const o = document.createElement("option");
    o.value = String(i); o.textContent = m.name + " · " + provLabel(m.providerID);
    sm.appendChild(o);
  });
  const ml = $("model-list");
  ml.innerHTML = "";
  const curKey = S.prefs.modelKey;
  MODELS.forEach(function (m) {
    const key = modelKey(m);
    const b = document.createElement("button");
    b.className = "model-picker-item" + (key === curKey ? " active" : "");
    const left = document.createElement("span");
    const nm = document.createElement("b");
    nm.textContent = m.name;
    const sub = document.createElement("small");
    sub.textContent = provLabel(m.providerID) + (m.context ? " · " + Math.round(m.context / 1000) + "k" : "");
    left.appendChild(nm); left.appendChild(sub);
    const badge = document.createElement("span");
    badge.className = "free-badge";
    badge.textContent = T("free");
    b.appendChild(left); b.appendChild(badge);
    b.onclick = function () {
      S.prefs.modelKey = key;
      savePrefs(); applyPrefs(); fillStatic();
      setMenuOpen(false);
    };
    const vars = m.variants ? Object.keys(m.variants) : [];
    if (vars.length) {
      const vrow = document.createElement("div");
      vrow.className = "variant-row";
      const all = ["default"].concat(vars.filter(function (v) { return v !== "default"; }));
      all.forEach(function (vk) {
        const vb = document.createElement("span");
        vb.className = "vchip" + ((S.prefs.variantKey || "default") === vk ? " active" : "");
        vb.textContent = vk;
        vb.onclick = function (e) {
          e.stopPropagation();
          S.prefs.variantKey = vk;
          savePrefs();
          fillStatic();
        };
        vrow.appendChild(vb);
      });
      b.appendChild(vrow);
    }
    ml.appendChild(b);
  });
  fillKb($("kb-send"), [["enter", T("optEnter")], ["ctrlenter", T("optCtrlEnter")]], S.prefs.keys.send);
  fillKb($("kb-new"), [["ctrl+n", "Ctrl+N"], ["none", T("optNone")]], S.prefs.keys.new);
  fillKb($("kb-palette"), [["ctrl+p", "Ctrl+P"], ["ctrl+k", "Ctrl+K"], ["none", T("optNone")]], S.prefs.keys.palette);
  const ex = $("examples");
  ex.innerHTML = "";
  [[T("ex1"), T("ex1d")], [T("ex2"), T("ex2d")], [T("ex3"), T("ex3d")], [T("ex4"), T("ex4d")]].forEach(function (pair) {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.dataset.prompt = pair[0];
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = pair[0];
    const s = document.createElement("div");
    s.className = "s";
    s.textContent = pair[1];
    card.appendChild(t); card.appendChild(s);
    card.onclick = function () { $("input").value = pair[0]; send(pair[0]); };
    ex.appendChild(card);
  });
  } catch (e) { /* broken static fill must never brick the app shell */ }
}
function toast(msg, ms) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.hidden = true; }, ms || 2200);
}
function uiZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return (z && z > 0) ? z : 1;
}
/* the composer menus are position:fixed so no scroll/overflow ancestor can clip
   them; the nearest ancestor that creates a containing block (the composer has
   a backdrop-filter) becomes the coordinate origin, and html{zoom} scales every
   length, so offsets are converted back to style px before being written. */
function menuOrigin(el) {
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const cs = getComputedStyle(p);
    const wc = cs.willChange || "";
    if (cs.transform !== "none" || cs.filter !== "none" || cs.backdropFilter !== "none" ||
        cs.perspective !== "none" || cs.contain !== "none" ||
        /transform|filter|perspective/.test(wc)) {
      return p.getBoundingClientRect();
    }
    p = p.parentElement;
  }
  return { left: 0, top: 0 };
}
function placeMenu(menu, btn) {
  if (!menu || !btn) return;
  const z = uiZoom();
  const org = menuOrigin(menu);
  const br = btn.getBoundingClientRect();
  const boxEl = btn.closest(".composer") || btn.closest(".model-picker-wrap") || btn;
  const bx = boxEl.getBoundingClientRect();
  const wv = menu.offsetWidth * z;        /* visual size */
  const hv = menu.offsetHeight * z;
  const vw = window.innerWidth, vh = window.innerHeight;
  const visLeft = Math.max(8, Math.min(br.left, vw - wv - 8));
  /* float the panel clear of the whole composer: it must not cover the prompt
     text area (above the chip row) nor the hint line under the card */
  let visTop = bx.top - hv - 8;
  if (visTop < 8) visTop = bx.bottom + 8;
  if (visTop + hv > vh - 8) visTop = Math.max(8, vh - hv - 8);
  menu.style.position = "fixed";
  menu.style.left = Math.round((visLeft - org.left) / z) + "px";
  menu.style.top = Math.round((visTop - org.top) / z) + "px";
  menu.style.right = "auto";
  menu.style.bottom = "auto";
}
function setMenuOpen(open, which) {
  const agent = which === "agent";
  const ml = $(agent ? "agent-list" : "model-list");
  if (!ml) return;
  if (open) {
    closeMenus();
    /* re-parent onto <body>: the chat view animates its opacity and the
       composer carries a backdrop-filter, so any ancestor can otherwise clip
       the panel or let the page bleed through it */
    if (ml.parentNode !== document.body) document.body.appendChild(ml);
  }
  ml.classList.toggle("hidden", !open);
  ml.classList.toggle("open", !!open);
  const btn = $(agent ? "agent-picker-btn" : "model-picker-btn");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) placeMenu(ml, btn);           /* measure once it is rendered */
}
function closeMenus() {
  [["model-list", "model-picker-btn"], ["agent-list", "agent-picker-btn"]].forEach(function (p) {
    const ml = $(p[0]);
    if (!ml) return;
    ml.classList.add("hidden");
    ml.classList.remove("open");
    const btn = $(p[1]);
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}
function setInspector(open) {
  const bd = $("settings-backdrop");
  if (!bd) return;
  bd.classList.toggle("open", open);
  if (open) {
    closeMenus();
    const act = document.querySelector(".settings-nav.active");
    if (act) ensureSection(act.dataset.tab);
    const c = $("btn-close-settings");
    if (c) c.focus();
  }
}
async function refreshStatus() {
  const el = $("sbStatus");
  try {
    await GET("/api/health");
    el.textContent = T("connected");
    el.classList.remove("bad"); el.classList.add("ok");
  } catch (e) {
    el.textContent = T("offline");
    el.classList.remove("ok"); el.classList.add("bad");
  }
}

/* ---------- settings sections: models/agents/permissions/mcp/config/about ---------- */
const SEC_LOADERS = {};
const SEC_DONE = {};
let PERM_DRAFT = null;

function parseJsonc(text) {
  // two passes: a comment can sit between a trailing comma and its closer
  // (`, /* x */ }`), so comments must go before the comma pass.
  return JSON.parse(stripTrailingCommas(stripJsoncComments(text)));
}
function stripJsoncComments(text) {
  const out = [];
  let i = 0, n = text.length, inStr = false;
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out.push(c);
      if (c === "\\" && i + 1 < n) { out.push(text[i + 1]); i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out.push(c); i++; continue; }
    if (c === "/" && text[i + 1] === "/") { while (i < n && text[i] !== "\n" && text[i] !== "\r") i++; continue; }
    if (c === "/" && text[i + 1] === "*") { i += 2; while (i + 1 < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
    out.push(c); i++;
  }
  return out.join("");
}
function stripTrailingCommas(text) {
  const out = [];
  let i = 0, n = text.length, inStr = false;
  while (i < n) {
    const c = text[i];
    if (inStr) {
      out.push(c);
      if (c === "\\" && i + 1 < n) { out.push(text[i + 1]); i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out.push(c); i++; continue; }
    if (c === ",") {
      let j = i + 1;
      while (j < n && " \t\r\n".indexOf(text[j]) >= 0) j++;
      if (j < n && (text[j] === "}" || text[j] === "]")) { i++; continue; }
    }
    out.push(c); i++;
  }
  return out.join("");
}

function secGroup(box, title) {
  const g = document.createElement("div");
  g.className = "group";
  const h = document.createElement("h4");
  h.textContent = title;
  g.appendChild(h);
  box.appendChild(g);
  return g;
}
function secRow(parent, cls) {
  const r = document.createElement("div");
  r.className = "sec-row" + (cls ? " " + cls : "");
  parent.appendChild(r);
  return r;
}
function secMain(row) {
  const m = document.createElement("div");
  m.className = "sec-main";
  row.appendChild(m);
  return m;
}
function secMuted(parent, text) {
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  parent.appendChild(p);
  return p;
}
function secLoading(box) { box.innerHTML = '<p class="muted">' + esc(T("loading")) + "</p>"; }
function secError(boxId, tab) {
  const box = $(boxId);
  if (!box) return;
  box.innerHTML = "";
  secMuted(box, T("errLoad"));
  const b = document.createElement("button");
  b.className = "btn btn-sm";
  b.textContent = T("retry");
  b.onclick = function () { SEC_DONE[tab] = false; ensureSection(tab); };
  box.appendChild(b);
}
/* the modal is grouped into 4 high-level tabs; each one hosts one or more of
   the independent section loaders below (models, agents, memory, ...). */
const TAB_SECTIONS = {
  general: ["about"],
  ai: ["models", "agents", "memory"],
  security: ["permissions", "mcp"],
  system: ["config"],
};
function ensureSection(tab) {
  const list = TAB_SECTIONS[tab] || [tab];
  list.forEach(function (key) {
    const fn = SEC_LOADERS[key];
    if (!fn || SEC_DONE[key]) return;
    SEC_DONE[key] = true;
    fn();
  });
}
function invalidateSections(tabs) {
  tabs.forEach(function (t) { SEC_DONE[t] = false; });
}
function refreshSections() {
  Object.keys(SEC_DONE).forEach(function (k) { SEC_DONE[k] = false; });
  const active = document.querySelector(".settings-nav.active");
  if (active) ensureSection(active.dataset.tab);
}

SEC_LOADERS.models = async function () {
  const box = $("sec-models");
  if (!box) return;
  secLoading(box);
  let keysOut = null;
  try {
    if (!PROVIDERS) await loadModels();
    keysOut = await GET("/vexis/auth");
  } catch (e) { secError("sec-models", "models"); return; }
  renderModels(box, (keysOut && keysOut.entries) || []);
};

function renderModels(box, keyEntries) {
  box.innerHTML = "";
  /* model router: primary + fallback (fallback is one click away on errors) */
  const gr = secGroup(box, T("routerTitle"));
  const rr = secRow(gr);
  const rmain = secMain(rr);
  const rb = document.createElement("b"); rb.textContent = T("routerFallback");
  const rs = document.createElement("small");
  rs.textContent = T("routerNote");
  rmain.appendChild(rb); rmain.appendChild(rs);
  const sel = document.createElement("select");
  sel.className = "perm-select";
  const none = document.createElement("option");
  none.value = ""; none.textContent = "—";
  sel.appendChild(none);
  MODELS.forEach(function (m) {
    const o = document.createElement("option");
    o.value = modelKey(m); o.textContent = m.name;
    sel.appendChild(o);
  });
  sel.value = S.prefs.routerFallback || "";
  sel.onchange = function () {
    S.prefs.routerFallback = sel.value;
    savePrefs();
  };
  rr.appendChild(sel);
  const g1 = secGroup(box, T("freeModels"));
  MODELS.forEach(function (m) {
    const row = secRow(g1);
    const main = secMain(row);
    const b = document.createElement("b"); b.textContent = m.name;
    const s = document.createElement("small");
    s.textContent = provLabel(m.providerID) + (m.context ? " · " + Math.round(m.context / 1000) + "k" : "");
    main.appendChild(b); main.appendChild(s);
    const active = modelKey(m) === (S.prefs.modelKey || DEFAULT_MODEL_KEY);
    if (active) {
      const badge = document.createElement("span");
      badge.className = "badge on";
      badge.textContent = "✓";
      row.appendChild(badge);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      btn.textContent = T("switchModel");
      btn.onclick = function () {
        S.prefs.modelKey = modelKey(m);
        savePrefs(); applyPrefs(); fillStatic();
        renderModels(box, keyEntries);
      };
      row.appendChild(btn);
    }
  });

  const keySet = {};
  keyEntries.forEach(function (e) { keySet[e.provider] = 1; });
  const provs = PROVIDERS || [];

  /* the add-key form is built before the provider cards so each card's button
     can drop the provider id straight into it */
  const form = document.createElement("div");
  form.className = "inline-form";
  const dl = document.createElement("datalist");
  dl.id = "prov-datalist";
  provs.forEach(function (p) {
    const o = document.createElement("option"); o.value = p.id; dl.appendChild(o);
  });
  const inp1 = document.createElement("input");
  inp1.placeholder = T("provider");
  inp1.setAttribute("list", "prov-datalist");
  const inp2 = document.createElement("input");
  inp2.type = "password"; inp2.placeholder = T("keyLabel");
  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-sm primary";
  addBtn.textContent = T("addKey");
  addBtn.onclick = async function () {
    const prov = inp1.value.trim(), key = inp2.value.trim();
    if (!prov || !key) { toast(T("fillFields")); return; }
    try {
      await POST("/vexis/auth", { provider: prov, key: key });
      toast(T("saved"));
      SEC_DONE.models = false;
      ensureSection("models");
    } catch (e) { toast(T("failSave")); }
  };
  form.appendChild(dl); form.appendChild(inp1); form.appendChild(inp2); form.appendChild(addBtn);
  function focusKeyForm(pid) {
    inp1.value = pid || "";
    inp2.focus();
    if (inp2.scrollIntoView) inp2.scrollIntoView({ block: "nearest" });
  }

  const g2 = secGroup(box, T("providers"));
  if (!provs.length) secMuted(g2, T("errLoad"));
  provs.forEach(function (p) {
    const row = secRow(g2, "prov-card");
    const main = secMain(row);
    const b = document.createElement("b"); b.textContent = p.name || p.id;
    const models = p.models || {};
    const ids = Object.keys(models);
    let free = 0;
    ids.forEach(function (mid) {
      const c = (models[mid] || {}).cost || {};
      if (+c.input === 0 && +c.output === 0) free++;
    });
    const s = document.createElement("small");
    s.textContent = p.id + " · " + ids.length + " " + T("modelsCount") +
      (free ? " · " + free + " " + T("free") : "");
    main.appendChild(b); main.appendChild(s);
    const hasKey = !!keySet[p.id] || !!(p.key && String(p.key).length);
    const st = document.createElement("span");
    st.className = "prov-status" + (hasKey ? " on" : "");
    st.appendChild(document.createElement("i"));
    st.appendChild(document.createTextNode(hasKey ? T("keyLabel") : T("noKeyLabel")));
    row.appendChild(st);
    if (!hasKey) {
      const add = document.createElement("button");
      add.className = "btn btn-sm";
      add.textContent = T("addKey");
      add.onclick = function () { focusKeyForm(p.id); };
      row.appendChild(add);
    }
  });

  const g3 = secGroup(box, T("apiKeys"));
  if (!keyEntries.length) secMuted(g3, T("noKeys"));
  keyEntries.forEach(function (e) {
    const row = secRow(g3);
    const main = secMain(row);
    const b = document.createElement("b"); b.textContent = e.provider;
    const s = document.createElement("small"); s.className = "mono";
    s.textContent = (e.masked || "") + " · " + (e.chars || 0) + " chars";
    main.appendChild(b); main.appendChild(s);
    const del = document.createElement("button");
    del.className = "btn btn-sm danger";
    del.textContent = T("delete");
    del.onclick = async function () {
      try {
        await DEL("/vexis/auth?provider=" + encodeURIComponent(e.provider));
        toast(T("saved"));
      } catch (err) { toast(T("failSave")); }
      SEC_DONE.models = false;
      ensureSection("models");
    };
    row.appendChild(del);
  });
  secMuted(g3, T("authNote"));
  g3.appendChild(form);
}

SEC_LOADERS.agents = async function () {
  const box = $("sec-agents");
  if (!box) return;
  secLoading(box);
  let list;
  try { list = await GET("/agent"); } catch (e) { secError("sec-agents", "agents"); return; }
  const all = Array.isArray(list) ? list : (list && list.data) || [];
  const agents = all.filter(function (a) { return a && !a.hidden; });
  box.innerHTML = "";
  if (!agents.length) { secMuted(box, T("errLoad")); return; }
  const primary = agents.filter(function (a) { return a.mode === "primary"; });
  const subs = agents.filter(function (a) { return a.mode !== "primary"; });
  const pick = primary.length ? primary : agents;
  const names = pick.map(function (a) { return a.name; });
  if (names.indexOf(S.prefs.agent) === -1) {
    S.prefs.agent = names.indexOf("build") >= 0 ? "build" : names[0];
    savePrefs();
    syncAgentSwitch();
  }

  const g1 = secGroup(box, T("defaultAgent"));
  const field = document.createElement("label");
  field.className = "field";
  const sel = document.createElement("select");
  pick.forEach(function (a) {
    const o = document.createElement("option");
    o.value = a.name;
    o.textContent = a.name + " · " + a.mode;
    sel.appendChild(o);
  });
  sel.value = S.prefs.agent;
  sel.onchange = function () { S.prefs.agent = sel.value; savePrefs(); syncAgentSwitch(); };
  field.appendChild(sel);
  g1.appendChild(field);
  secMuted(g1, T("usedForMsg"));

  const makeCard = function (a) {
    const card = document.createElement("div");
    card.className = "sec-card";
    const head = secRow(card);
    const main = secMain(head);
    const b = document.createElement("b"); b.textContent = a.name;
    main.appendChild(b);
    if (a.description) {
      const s = document.createElement("small"); s.textContent = a.description;
      main.appendChild(s);
    }
    const modeB = document.createElement("span");
    modeB.className = "badge";
    modeB.textContent = a.mode;
    head.appendChild(modeB);
    const perms = Array.isArray(a.permission) ? a.permission : [];
    const counts = { allow: 0, ask: 0, deny: 0 };
    perms.forEach(function (p) { if (counts[p.action] !== undefined) counts[p.action]++; });
    secMuted(card, "allow " + counts.allow + " · ask " + counts.ask + " · deny " + counts.deny);
    if (perms.length) {
      const det = document.createElement("details");
      const sum = document.createElement("summary");
      sum.textContent = T("secPerms") + " (" + perms.length + ")";
      det.appendChild(sum);
      perms.forEach(function (p) {
        const r = document.createElement("div");
        r.className = "sec-row mini";
        const code = document.createElement("code");
        code.textContent = p.permission + (p.pattern && p.pattern !== "*" ? " " + p.pattern : "");
        const ab = document.createElement("span");
        ab.className = "badge act-" + String(p.action || "");
        ab.textContent = p.action || "";
        r.appendChild(code); r.appendChild(ab);
        det.appendChild(r);
      });
      card.appendChild(det);
    }
    return card;
  };

  /* main agents (build / plan) first, then the sub agents the model invokes */
  secGroup(box, T("primaryAgents"));
  primary.forEach(function (a) { box.appendChild(makeCard(a)); });
  if (subs.length) {
    secGroup(box, T("subAgents"));
    subs.forEach(function (a) { box.appendChild(makeCard(a)); });
  }
};

SEC_LOADERS.permissions = async function () {
  const box = $("sec-perms");
  if (!box) return;
  secLoading(box);
  let fileOut = null, cfgOut = null;
  try {
    fileOut = await GET("/vexis/config");
    cfgOut = await GET("/config");
  } catch (e) { secError("sec-perms", "permissions"); return; }
  let obj = null;
  try { obj = parseJsonc((fileOut && fileOut.content) || "{}"); } catch (e) { obj = null; }
  if (!obj || typeof obj !== "object") obj = {};
  let perm = (obj.permission && typeof obj.permission === "object") ? obj.permission : null;
  if (!perm) {
    perm = (cfgOut && cfgOut.permission) || {};
    obj.permission = perm;
  }
  PERM_DRAFT = { obj: obj };
  box.innerHTML = "";
  const tools = Object.keys(perm).sort();
  if (!tools.length) { secMuted(box, T("noPerms")); return; }

  /* the flat permission map can get long, so bucket the tools into the few
     categories people actually reason about (files / shell / web / other) */
  const CATS = [
    { id: "files", keys: ["edit", "write", "patch", "read", "glob", "grep", "list", "ls", "multiedit"] },
    { id: "shell", keys: ["bash", "shell", "powershell", "cmd", "run", "terminal", "task"] },
    { id: "web", keys: ["webfetch", "websearch", "fetch", "browser", "http", "mcp"] },
  ];
  function permBase(tool) {
    const i = tool.indexOf(":");
    return i > 0 ? tool.slice(0, i) : tool;
  }
  function permCat(tool) {
    const b = permBase(tool);
    for (let i = 0; i < CATS.length; i++) if (CATS[i].keys.indexOf(b) >= 0) return CATS[i].id;
    return "other";
  }
  const buckets = {};
  tools.forEach(function (tool) {
    const c = permCat(tool);
    (buckets[c] || (buckets[c] = [])).push(tool);
  });
  ["files", "shell", "web", "other"].forEach(function (cid) {
    const list = buckets[cid];
    if (!list || !list.length) return;
    const h = document.createElement("div");
    h.className = "perm-group-h";
    h.textContent = T("permCat_" + cid);
    box.appendChild(h);
    list.forEach(function (tool) {
      const row = secRow(box, "perm-tool");
      const code = document.createElement("code");
      code.textContent = tool;
      row.appendChild(code);
      const sel = document.createElement("select");
      sel.className = "perm-select";
      ["allow", "ask", "deny"].forEach(function (act) {
        const o = document.createElement("option");
        o.value = act; o.textContent = act;
        sel.appendChild(o);
      });
      sel.value = perm[tool] || "ask";
      sel.onchange = function () { perm[tool] = sel.value; };
      row.appendChild(sel);
    });
  });
  const btn = $("btn-save-perms");
  if (btn) btn.onclick = async function () {
    if (!PERM_DRAFT) return;
    try {
      await POST("/vexis/config", { content: JSON.stringify(PERM_DRAFT.obj, null, 2) });
      toast(T("saved"));
      invalidateSections(["mcp", "agents"]);
    } catch (e) { toast(T("failSave")); }
  };
};

SEC_LOADERS.mcp = async function () {
  const box = $("sec-mcp");
  if (!box) return;
  secLoading(box);
  let out;
  try { out = await GET("/mcp"); } catch (e) { secError("sec-mcp", "mcp"); return; }
  const servers = (out && typeof out === "object") ? out : {};
  const names = Object.keys(servers);
  box.innerHTML = "";
  if (!names.length) secMuted(box, T("noMcp"));
  names.forEach(function (nm) {
    const card = document.createElement("div");
    card.className = "sec-card";
    const row = secRow(card);
    const main = secMain(row);
    const b = document.createElement("b"); b.textContent = nm;
    let info = servers[nm];
    try { info = JSON.stringify(info); } catch (e) { info = String(info); }
    if (info.length > 160) info = info.slice(0, 160) + "…";
    const s = document.createElement("small"); s.textContent = info;
    main.appendChild(b); main.appendChild(s);
    box.appendChild(card);
  });
  const g = secGroup(box, T("mcpAdd"));
  const form = document.createElement("div");
  form.className = "inline-form";
  const inp1 = document.createElement("input");
  inp1.placeholder = T("mcpName");
  const inp2 = document.createElement("input");
  inp2.placeholder = T("mcpCmd");
  const btn = document.createElement("button");
  btn.className = "btn btn-sm primary";
  btn.textContent = T("add");
  form.appendChild(inp1); form.appendChild(inp2); form.appendChild(btn);
  g.appendChild(form);
  secMuted(g, T("noteRestart"));
  btn.onclick = async function () {
    const nm = inp1.value.trim(), cmd = inp2.value.trim();
    if (!nm || !cmd) { toast(T("fillFields")); return; }
    try {
      const fileOut = await GET("/vexis/config");
      const obj = parseJsonc(fileOut.content || "{}");
      if (!obj.mcp || typeof obj.mcp !== "object") obj.mcp = {};
      obj.mcp[nm] = { type: "local", command: cmd.split(/\s+/), enabled: true };
      await POST("/vexis/config", { content: JSON.stringify(obj, null, 2) });
      toast(T("saved"));
      SEC_DONE.mcp = false;
      ensureSection("mcp");
      invalidateSections(["permissions"]);
    } catch (e) { toast(T("failSave")); }
  };
};

/* engine status cards + raw JSONC editor (small_model / compaction / agents...) */
SEC_LOADERS.config = async function () {
  const box = $("sec-config");
  if (!box) return;
  secLoading(box);
  const settled = await Promise.allSettled([
    GET("/global/health"), GET("/path" + qdir()), GET("/vcs" + qdir()),
    GET("/lsp" + qdir()), GET("/formatter" + qdir()), GET("/mcp" + qdir()),
    GET("/experimental/tool/ids"), GET("/vexis/config"),
  ]);
  const val = function (i) { return settled[i] && settled[i].status === "fulfilled" ? settled[i].value : null; };
  const health = val(0), path = val(1), vcs = val(2), lsp = val(3), fmt = val(4), mcp = val(5), tools = val(6), cfg = val(7);
  box.innerHTML = "";
  const g1 = secGroup(box, T("statusGroup"));
  const wrap = document.createElement("div");
  wrap.className = "cfg-status";
  const kv = function (k, v) {
    const d = document.createElement("div");
    d.className = "kv";
    const b = document.createElement("b"); b.textContent = k;
    const s = document.createElement("span"); s.textContent = v;
    d.appendChild(b); d.appendChild(s);
    wrap.appendChild(d);
  };
  kv("version", health && health.version ? String(health.version) : "—");
  kv("directory", (path && (path.cwd || path.directory)) || S.dir || "—");
  kv("branch", vcs && vcs.branch ? String(vcs.branch) : "—");
  kv("lsp", Array.isArray(lsp) ? String(lsp.length) : "—");
  kv("formatter", Array.isArray(fmt) ? String(fmt.length) : "—");
  kv("mcp", mcp ? (Array.isArray(mcp) ? mcp.length : Object.keys(mcp).length) : "—");
  kv("tools", Array.isArray(tools) ? tools.length : "—");
  g1.appendChild(wrap);
  secMuted(g1, T("gitNote"));

  const g2 = secGroup(box, T("secConfig"));
  secMuted(g2, T("cfgNote"));
  const ta = document.createElement("textarea");
  ta.className = "cfg-editor";
  ta.spellcheck = false;
  ta.value = (cfg && cfg.content) || "";
  g2.appendChild(ta);
  const row = document.createElement("div");
  row.className = "row-actions";
  const save = document.createElement("button");
  save.className = "btn btn-sm primary";
  save.textContent = T("save");
  save.onclick = async function () {
    try { parseJsonc(ta.value); }
    catch (e) { toast(T("invalidJson")); return; }
    try {
      await POST("/vexis/config", { content: ta.value });
      toast(T("saved"));
      secMuted(g2, T("noteRestart"));
    } catch (e) { toast(T("failSave")); }
  };
  const revert = document.createElement("button");
  revert.className = "btn btn-sm";
  revert.textContent = T("reload");
  revert.onclick = function () { SEC_DONE.config = false; ensureSection("config"); };
  row.appendChild(save); row.appendChild(revert);
  g2.appendChild(row);
};

SEC_LOADERS.memory = async function () {
  const box = $("sec-memory");
  if (!box) return;
  secLoading(box);
  let mem = null;
  try { mem = await GET("/vexis/memory"); } catch (e) { secError("sec-memory", "memory"); return; }
  box.innerHTML = "";
  const g1 = secGroup(box, T("memKnowledge"));
  secMuted(g1, T("memInjectNote"));
  const list = document.createElement("div");
  list.className = "mem-list";
  const drawList = function (files) {
    list.innerHTML = "";
    if (!files.length) { secMuted(list, T("memEmpty")); return; }
    files.forEach(function (f) {
      const r = document.createElement("div");
      r.className = "mem-item";
      const nm = document.createElement("span");
      nm.textContent = f.name + " · " + Math.max(1, Math.round((f.size || 0) / 1024)) + " kB";
      const acts = document.createElement("span");
      acts.className = "mem-acts";
      const ed = document.createElement("button");
      ed.className = "btn btn-sm"; ed.textContent = T("memEdit");
      ed.onclick = function () { nameIn.value = f.name; ta2.value = f.content || ""; ta2.focus(); };
      const del = document.createElement("button");
      del.className = "btn btn-sm"; del.textContent = T("delete");
      del.onclick = async function () {
        try {
          await DEL("/vexis/memory?name=" + encodeURIComponent(f.name));
          SEC_DONE.memory = false; ensureSection("memory");
        } catch (e) { toast(T("failSave")); }
      };
      acts.appendChild(ed); acts.appendChild(del);
      r.appendChild(nm); r.appendChild(acts);
      list.appendChild(r);
    });
  };
  drawList((mem && mem.files) || []);
  g1.appendChild(list);
  const g1f = secGroup(box, T("memAdd"));
  const nameIn = document.createElement("input");
  nameIn.className = "cfg-editor"; nameIn.placeholder = "my-notes.md";
  const ta2 = document.createElement("textarea");
  ta2.className = "cfg-editor"; ta2.rows = 6; ta2.placeholder = T("memContent");
  g1f.appendChild(nameIn); g1f.appendChild(ta2);
  const row1 = document.createElement("div");
  row1.className = "row-actions";
  const addB = document.createElement("button");
  addB.className = "btn btn-sm primary"; addB.textContent = T("save");
  addB.onclick = async function () {
    let name = (nameIn.value || "").trim().replace(/[^\w.\- ]/g, "");
    if (!name) { toast(T("memName")); return; }
    if (!/\.md$/i.test(name)) name += ".md";
    try {
      await POST("/vexis/memory", { name: name, content: ta2.value });
      toast(T("saved"));
      SEC_DONE.memory = false; ensureSection("memory");
    } catch (e) { toast(T("failSave")); }
  };
  row1.appendChild(addB);
  g1f.appendChild(row1);
  const g2 = secGroup(box, T("memAgents"));
  secMuted(g2, T("memAgentsNote"));
  const agents = (mem && mem.agents) || [];
  const sel = document.createElement("select");
  sel.className = "mem-select";
  agents.forEach(function (a) {
    const o = document.createElement("option");
    o.value = a.path; o.textContent = a.label;
    sel.appendChild(o);
  });
  const taA = document.createElement("textarea");
  taA.className = "cfg-editor"; taA.rows = 10;
  const loadA = async function () {
    if (!agents.length) { taA.value = ""; return; }
    try {
      const r = await GET("/vexis/file?path=" + encodeURIComponent(sel.value));
      taA.value = (r && r.content) || "";
    } catch (e) { taA.value = ""; }
  };
  sel.onchange = loadA;
  g2.appendChild(sel); g2.appendChild(taA);
  const row2 = document.createElement("div");
  row2.className = "row-actions";
  const saveA = document.createElement("button");
  saveA.className = "btn btn-sm primary"; saveA.textContent = T("save");
  saveA.onclick = async function () {
    if (!agents.length) return;
    try {
      await POST("/vexis/file", { path: sel.value, content: taA.value });
      toast(T("saved"));
    } catch (e) { toast(T("failSave")); }
  };
  row2.appendChild(saveA);
  g2.appendChild(row2);
  if (agents.length) await loadA();
};

SEC_LOADERS.about = async function () {
  const box = $("sec-about");
  if (!box) return;
  secLoading(box);
  let info;
  try { info = await GET("/vexis/info"); } catch (e) { secError("sec-about", "about"); return; }
  box.innerHTML = "";
  function kv(parent, label, value, cls) {
    const row = secRow(parent, "kv");
    const k = document.createElement("span");
    k.className = "kv-k"; k.textContent = label;
    const v = document.createElement("span");
    v.className = "kv-v" + (cls ? " " + cls : "");
    v.textContent = value;
    row.appendChild(k); row.appendChild(v);
    return v;
  }
  function fileRow(parent, label, fi, extra) {
    const row = secRow(parent, "kv");
    const k = document.createElement("span");
    k.className = "kv-k"; k.textContent = label;
    const v = document.createElement("span");
    v.className = "kv-v";
    const pp = document.createElement("span");
    pp.className = "path";
    pp.textContent = (fi && fi.path) || "—";
    v.appendChild(pp);
    const meta = document.createElement("small");
    meta.className = "muted-inline";
    if (fi && fi.exists) {
      let t = fi.size != null ? Math.round(fi.size / 1024) + " KB" : "";
      if (fi.mtime) t += (t ? " · " : "") + fi.mtime;
      if (extra) t += (t ? " · " : "") + extra;
      meta.textContent = t;
    } else {
      meta.textContent = "—";
    }
    v.appendChild(meta);
    row.appendChild(k); row.appendChild(v);
  }
  const g0 = secGroup(box, T("engine"));
  const st = kv(g0, T("engine"),
    info.engine_ok ? T("engineUp") + " (" + info.engine_ms + " ms)" : T("engineDown"),
    info.engine_ok ? "ok" : "bad");
  kv(g0, T("uiPort"), String(info.ui_port));
  kv(g0, "Python", info.python || "");
  const g1 = secGroup(box, T("configFile"));
  fileRow(g1, T("configFile"), info.config);
  fileRow(g1, T("authFile"), info.auth, (info.auth && info.auth.count != null)
    ? info.auth.count + " " + T("keysCount") : "");
  fileRow(g1, T("runtimeFile"), info.runtime);
  secMuted(g1, info.root || "");

  const gUp = secGroup(box, T("updateGroup"));
  const upBody = document.createElement("div");
  gUp.appendChild(upBody);
  let upStatus = null;
  function updText(u) {
    if (!u) return T("loading");
    let s = "";
    switch (u.state) {
      case "idle": case "checking": s = T("updateChecking"); break;
      case "downloading": case "verifying": case "swapping": {
        s = T("updateDownloading");
        if (u.state === "verifying") s = T("loading");
        if (u.state === "swapping") s = T("save");
        if (u.bytes_total) s += " " + Math.round((u.bytes_done || 0) / u.bytes_total * 100) + "%";
        break;
      }
      case "uptodate": s = T("upToDate"); break;
      case "applied": s = T("updatePending"); break;
      case "disabled": s = T("updateDisabled"); break;
      case "blocked": s = T("updateBlocked"); break;
      case "rolled_back": s = T("updateRolledBack"); break;
      case "error": s = T("updateFailed"); break;
      default: s = u.state || "";
    }
    if (u.latest && (u.state === "uptodate" || u.state === "applied")) s += " (" + u.latest + ")";
    if (u.blocked_last && u.state === "rolled_back") s += " " + u.blocked_last;
    if (u.state === "error" && u.message) s += " — " + u.message;
    return s;
  }
  const updBusy = (s) => ["checking", "downloading", "verifying", "swapping"].indexOf(s) >= 0;
  function renderUpdate() {
    upBody.innerHTML = "";
    const u = upStatus || {};
    kv(upBody, T("updateCurrent"), u.current || "…");
    kv(upBody, T("updateLatest"), u.latest || "…");
    secMuted(upBody, updText(u));
    const row = document.createElement("div");
    row.className = "row-actions";
    const b = document.createElement("button");
    b.className = "btn btn-sm";
    b.textContent = T("checkNow");
    b.disabled = !upStatus || updBusy(upStatus.state);
    b.onclick = async function () {
      b.disabled = true;
      try { await POST("/vexis/update/now", {}); } catch (e) {}
      pollUpdate();
    };
    row.appendChild(b);
    upBody.appendChild(row);
  }
  let pollTimer = null;
  function pollUpdate() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async function () {
      try { upStatus = await GET("/vexis/update"); } catch (e) { return; }
      renderUpdate();
      if (!upStatus || !updBusy(upStatus.state)) clearInterval(pollTimer);
    }, 1200);
  }
  try { upStatus = await GET("/vexis/update"); } catch (e) {}
  renderUpdate();
  if (upStatus && updBusy(upStatus.state)) pollUpdate();

  const tbtn = $("btn-test-conn");
  if (tbtn) tbtn.onclick = async function () {
    tbtn.disabled = true;
    const t0 = Date.now();
    try {
      await GET("/api/health");
      const ms = Date.now() - t0;
      st.textContent = T("engineUp") + " (" + ms + " ms)";
      st.className = "kv-v ok";
      toast(T("engineUp") + " (" + ms + " ms)");
    } catch (e) {
      st.textContent = T("engineDown");
      st.className = "kv-v bad";
      toast(T("engineDown"));
    }
    tbtn.disabled = false;
  };
};

/* ---------- init ---------- */
function init() {
  loadPrefs();
  applyPrefs();   /* first: even if fillStatic fails the UI is translated + themed */
  fillStatic();
  loadModels().then(function () { fillStatic(); applyPrefs(); }).catch(function () {});
  loadAgents().catch(function () {});
  connectUiEvents();
  loadArtifacts();
  $("btn-new").onclick = function () { newChat(); };
  $("collapse-btn").onclick = function () {
    const on = $("app").classList.toggle("sb-collapsed");
    S.prefs.sbCollapsed = on; savePrefs();
  };
  if (S.prefs.sbCollapsed) $("app").classList.add("sb-collapsed");
  $("btn-settings").onclick = function () { setInspector(true); };
  $("btn-close-settings").onclick = function () { setInspector(false); };
  /* right sidebar: files / browser / todo (opens on the stats chip too) */
  const rsbEl = $("rsb");
  const toggleRSB = function (tab) {
    if (tab) { S.rsbTab = tab; S.prefs.rsbTab = tab; }
    const show = tab ? true : rsbEl.classList.contains("hidden");
    rsbEl.classList.toggle("hidden", !show);
    document.querySelectorAll(".rsb-tab").forEach(function (x) {
      x.classList.toggle("on", x.dataset.rtab === (S.rsbTab || "files"));
    });
    if (show) renderRSB();
    S.prefs.rsbOpen = show; savePrefs();
  };
  $("btn-rsb").onclick = function () { toggleRSB(); };
  $("btn-usage").onclick = function (e) {
    e.stopPropagation();
    const p = $("usage-pop");
    const willOpen = p.classList.contains("hidden");
    p.classList.toggle("hidden", !willOpen);
    if (willOpen) renderUsagePop();
  };
  document.addEventListener("click", function (e) {
    const p = $("usage-pop");
    if (p && !p.classList.contains("hidden") && !(e.target.closest && e.target.closest(".usage-wrap")))
      p.classList.add("hidden");
  });
  $("rsb-close").onclick = function () { toggleRSB(); };
  const csEl = $("chat-stats");
  if (csEl) csEl.onclick = function () { toggleRSB("files"); };
  document.querySelectorAll(".rsb-tab").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".rsb-tab").forEach(function (x) { x.classList.toggle("on", x === b); });
      S.rsbTab = b.dataset.rtab; S.prefs.rsbTab = S.rsbTab; savePrefs();
      renderRSB();
    };
  });
  if (S.prefs.rsbOpen) toggleRSB(S.prefs.rsbTab || "files");
  /* right rail manual width: drag the left edge (persists in prefs) */
  (function () {
    const grip = $("rsb-grip"), rsb = $("rsb");
    const applyW = function () {
      const w = +S.prefs.rsbW || 0;
      if (w >= 240 && w <= 640 && rsb) {
        rsb.style.flex = "0 0 " + w + "px";
        rsb.style.width = w + "px";
      }
    };
    applyW();
    if (!grip || !rsb) return;
    grip.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      grip.classList.add("drag");
      const x0 = e.clientX, w0 = rsb.getBoundingClientRect().width;
      const mv = function (ev) {
        const w = Math.max(240, Math.min(640, Math.round(w0 + (x0 - ev.clientX))));
        rsb.style.flex = "0 0 " + w + "px";
        rsb.style.width = w + "px";
        S.prefs.rsbW = w;
      };
      const up = function () {
        grip.classList.remove("drag");
        grip.removeEventListener("pointermove", mv);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
        savePrefs();
      };
      grip.addEventListener("pointermove", mv);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    });
  })();
  /* right-click menu inside the chat: copy / select */
  const cmenu = $("ctx-menu");
  const cw = $("chat-wrap");
  if (cmenu && cw) {
    cw.addEventListener("contextmenu", function (e) {
      const row = e.target.closest ? e.target.closest(".msg-row") : null;
      if (!row) return;
      e.preventDefault();
      S.ctxRow = row;
      cmenu.classList.remove("hidden");
      const mw = cmenu.offsetWidth || 180, mh = cmenu.offsetHeight || 96;
      cmenu.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - mw - 8)) + "px";
      cmenu.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - mh - 8)) + "px";
    });
    cmenu.addEventListener("click", function (e) {
      const b = e.target.closest("button");
      if (!b) return;
      const act = b.dataset.act;
      const sel = window.getSelection();
      if (act === "copy-sel") {
        const t = sel ? String(sel) : "";
        if (t) copyText(t);
        else if (S.ctxRow) copyText(S.ctxRow.innerText);
      } else if (act === "copy-all" && S.ctxRow) {
        copyText(S.ctxRow.innerText);
      } else if (act === "select-all" && S.ctxRow) {
        const target = S.ctxRow.querySelector(".msg-body") || S.ctxRow;
        const range = document.createRange();
        range.selectNodeContents(target);
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      }
      cmenu.classList.add("hidden");
    });
    document.addEventListener("mousedown", function (e) {
      if (!cmenu.contains(e.target)) cmenu.classList.add("hidden");
    });
  }
  $("user-chip").onclick = function () { setInspector(true); };
  $("user-chip").onkeydown = function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInspector(true); }
  };
  $("theme-toggle-btn").onclick = function () {
    S.prefs.theme = S.prefs.theme === "black" ? "light" : "black";
    savePrefs(); applyPrefs(); syncThemeSeg();
  };
  document.querySelectorAll("#themeSeg button").forEach(function (b) {
    b.onclick = function () {
      S.prefs.theme = b.dataset.themeVal; savePrefs(); applyPrefs(); syncThemeSeg();
    };
  });
  $("confirm-no").onclick = function () { $("confirm-modal").classList.remove("open"); confirmCb = null; };
  $("confirm-close").onclick = function () { $("confirm-modal").classList.remove("open"); confirmCb = null; };
  $("confirm-yes").onclick = function () {
    $("confirm-modal").classList.remove("open");
    if (confirmCb) { const f = confirmCb; confirmCb = null; f().catch(function () {}); }
  };
  $("set-lang").onchange = function (e) {
    S.prefs.lang = e.target.value; savePrefs(); applyPrefs(); fillStatic();
    renderChat(); renderSessions(); refreshSections();
  };
  const stEl = $("set-theme");
  if (stEl) stEl.onchange = function (e) { S.prefs.theme = e.target.value; savePrefs(); applyPrefs(); };
  $("set-fontsize").oninput = function (e) {
    S.prefs.fontSize = +e.target.value; savePrefs(); applyPrefs();
    $("fontVal").textContent = String(S.prefs.fontSize);
  };
  $("set-sound").onchange = function (e) { S.prefs.sound = e.target.checked; savePrefs(); };
  const stThink = $("set-thinking");
  if (stThink) stThink.onchange = function (e) {
    S.prefs.showThinking = e.target.checked; savePrefs(); renderChat();
  };
  const stDet = $("set-details");
  if (stDet) stDet.onchange = function (e) {
    S.prefs.showToolDetails = e.target.checked; savePrefs(); renderChat();
  };
  const stWide = $("set-wide");
  if (stWide) stWide.onchange = function (e) {
    S.prefs.wideChat = e.target.checked; savePrefs(); applyPrefs();
  };
  const stMotion = $("set-motion");
  if (stMotion) stMotion.onchange = function (e) {
    S.prefs.reduceMotion = e.target.checked; savePrefs(); applyPrefs();
  };
  [["kb-send", "send"], ["kb-new", "new"], ["kb-palette", "palette"]].forEach(function (pair) {
    const sel = $(pair[0]);
    if (sel) sel.onchange = function (e) {
      S.prefs.keys[pair[1]] = e.target.value;
      savePrefs();
      if (pair[1] === "palette" && e.target.value === "none") closePalette();
    };
  });
  $("set-model").onchange = function (e) {
    const m = MODELS[+e.target.value];
    if (m) { S.prefs.modelKey = modelKey(m); savePrefs(); applyPrefs(); fillStatic(); }
  };
  $("model-picker-btn").onclick = function (e) {
    e.stopPropagation();
    setMenuOpen($("model-list").classList.contains("hidden"), "model");
  };
  const apb = $("agent-picker-btn");
  if (apb) apb.onclick = function (e) {
    e.stopPropagation();
    setMenuOpen($("agent-list").classList.contains("hidden"), "agent");
  };
  document.addEventListener("click", function (e) {
    const t = e.target;
    if (!t.closest || (t.closest(".model-picker-wrap") || t.closest(".model-picker-menu"))) return;
    closeMenus();
  });
  window.addEventListener("resize", closeMenus);
  document.addEventListener("scroll", function (e) {
    const t = e.target;
    if (t && t.closest && t.closest(".model-picker-menu")) return;
    closeMenus();
  }, true);
  const sbackdrop = $("settings-backdrop");
  if (sbackdrop) {
    sbackdrop.addEventListener("mousedown", function (e) {
      if (e.target === sbackdrop) setInspector(false);
    });
  }
  document.querySelectorAll(".settings-nav").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".settings-nav").forEach(function (x) { x.classList.toggle("active", x === b); });
      document.querySelectorAll(".ins-panel").forEach(function (p) {
        p.classList.toggle("hidden", p.dataset.panel !== b.dataset.tab);
      });
      ensureSection(b.dataset.tab);
    };
  });
  function keyCombo(e) {
    let s = "";
    if (e.ctrlKey) s += "ctrl+";
    if (e.metaKey) s += "meta+";
    if (e.altKey) s += "alt+";
    const k = String(e.key || "").toLowerCase();
    if (k === "control" || k === "meta" || k === "alt" || k === "shift") return "";
    return s + k;
  }
  document.addEventListener("keydown", function (e) {
    const pal = $("palette");
    if (pal && !pal.classList.contains("hidden")) {
      if (e.key === "Escape") { e.preventDefault(); closePalette(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        palIdx = Math.min(palFiltered.length - 1, palIdx + 1);
        renderPalette();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        palIdx = Math.max(0, palIdx - 1);
        renderPalette();
        return;
      }
      if (e.key === "Enter") { e.preventDefault(); runPalette(palIdx); return; }
      return;
    }
    const kd = S.prefs.keys || {};
    const combo = keyCombo(e);
    if (kd.palette && kd.palette !== "none" && combo === kd.palette) {
      e.preventDefault(); togglePalette(); return;
    }
    if (kd.new && kd.new !== "none" && combo === kd.new) {
      e.preventDefault(); newChat(); return;
    }
    if (e.key !== "Escape") return;
    if (sbackdrop && sbackdrop.classList.contains("open")) { setInspector(false); return; }
    closeMenus();
    const sc = $("sidebar-scrim");
    if (sc && sc.classList.contains("show")) sc.click();
  });
  const bm = $("btn-menu");
  if (bm) bm.onclick = function () {
    const on = $("app").classList.toggle("sb-open");
    $("sidebar-scrim").classList.toggle("show", on);
  };
  const scrim = $("sidebar-scrim");
  if (scrim) scrim.onclick = function () {
    $("app").classList.remove("sb-open");
    scrim.classList.remove("show");
  };
  $("btn-export").onclick = function () { exportMD(); };
  const input = $("input");
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(200, input.scrollHeight) + "px";
    handlePopup().catch(function () {});
  });
  input.addEventListener("keydown", function (e) {
    const sendMode = (S.prefs.keys && S.prefs.keys.send) || "enter";
    const wantSend = sendMode === "ctrlenter"
      ? (e.key === "Enter" && e.ctrlKey && !e.shiftKey)
      : (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey);
    if (wantSend) {
      e.preventDefault();
      const first = $("popup").querySelector("button");
      if (!$("popup").classList.contains("hidden") && first && (input.value[0] === "/" || input.value.indexOf("@") !== -1)) {
        first.click();
        return;
      }
      hidePopup();
      send(input.value);
      input.value = "";
      input.style.height = "auto";
    }
    if (e.key === "Escape") hidePopup();
  });
  const palInput = $("palette-input");
  if (palInput) {
    palInput.addEventListener("input", function () { palIdx = 0; renderPalette(); });
  }
  const palBox = $("palette");
  if (palBox) {
    palBox.addEventListener("mousedown", function (e) {
      if (e.target === palBox) closePalette();
    });
  }
  $("btn-send").onclick = function () {
    send(input.value);
    input.value = "";
    input.style.height = "auto";
  };
  $("btn-stop").onclick = function () {
    S.stopFlag = true;
    if (S.sessionID) POST("/session/" + S.sessionID + "/abort", {}).catch(function () {});
  };
  $("btn-attach").onclick = function () { $("file-input").click(); };
  const shotBtn = $("btn-shot");
  if (shotBtn) shotBtn.onclick = async function () {
    shotBtn.disabled = true;
    try {
      const r = await POST("/vexis/shot", {});
      if (r && r.image) {
        S.attachments.push({ name: "screenshot.png", mime: "image/png", dataUrl: r.image });
        renderAttachments();
      }
    } catch (e) {}
    shotBtn.disabled = false;
  };
  /* question/permission dock: show/hide the input bar around pending cards */
  const dockEl = $("pending-cards");
  if (dockEl && window.MutationObserver) {
    new MutationObserver(function () { syncPendingDock(); })
      .observe(dockEl, { childList: true });
  }
  syncPendingDock();
  $("file-input").onchange = function (e) {
    const files = Array.prototype.slice.call(e.target.files || []);
    files.forEach(function (f) {
      const rd = new FileReader();
      rd.onload = function () {
        S.attachments.push({ name: f.name, mime: f.type || "image/png", dataUrl: rd.result });
        renderAttachments();
      };
      rd.readAsDataURL(f);
    });
    e.target.value = "";
  };
  let searchT = null;
  $("search").addEventListener("input", function (e) {
    clearTimeout(searchT);
    searchT = setTimeout(function () {
      if (S.sideView === "projects") renderProjects().catch(function () {});
      else loadSessions(e.target.value.trim()).catch(function () {});
    }, 300);
  });
  document.querySelectorAll("#sideSeg button").forEach(function (b) {
    b.onclick = function () { setSideView(b.dataset.side); };
  });
  workspaceDir().then(function () {
    return GET("/vexis/bootstrap").catch(function () { return null; });
  }).then(function (bs) {
    if (bs && bs.secret) S.secret = bs.secret;
    try {
      const fv = document.querySelector(".app-footer");
      if (fv && bs && bs.app && bs.app.version) {
        fv.innerHTML = "Vexis v" + esc(bs.app.version) + fv.innerHTML.slice(fv.innerHTML.indexOf(" &middot;"));
      }
    } catch (e) {}
    return loadSessions("");
  }).then(function () {
    newChat();
    refreshStatus();
  }).catch(function () {
    $("chat").innerHTML = '<div class="error-box"><p>engine unreachable - run run.bat</p></div>';
  });
  setInterval(refreshStatus, 30000);
}
document.addEventListener("DOMContentLoaded", init);
