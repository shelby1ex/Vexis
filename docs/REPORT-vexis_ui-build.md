# Vexis — Build Report

Updated: 2026-10-08 · `vexis/vexis_ui/` · Engine: `.runtime\vexis-runtime.exe` (v1.18.35) on `:4097` · UI server `:8100`

---

## What it is

Vexis chat app (vanilla HTML/CSS/JS) wearing the vertex-ai-platform web
structure and style system, powered by the real local OpenCode engine.
No home screen — opens straight into chat. All local (SQLite,
`.runtime\vexis-runtime.exe`); no cloud DB, no login.

---

## Phase 1 — Base build (2026-10-05)

### Web structure (vertex-ai-platform, same navbar)
- `vendor/vertex/css/style.css` (113 KB) + `vendor/vertex/css/vertex.css`
  (167 KB) copied verbatim — tokens, all 18 theme pairs, responsive rules.
- `vendor/vertex/images/vertex-darkmode.png` + `vertex-lightmode.png` —
  same logo (auto-swaps with theme), wordmark reads **VEXIS**.
- Same navbar: `model-picker` + `topbar-actions` (export, theme toggle,
  settings gear). Same shell: `app-shell` grid, sidebar header,
  `new-chat-btn`, `nav-section`, `sidebar-search`, `chat-list`,
  `chat-pane`/`chat-scroll`, `composer`, `msg-row`/`msg-avatar`/`msg-body`/
  `msg-meta`/`msg-content`.
- Content is 100% Vexis: own sessions, own settings, own branding.

### Features (verified live against the engine)
- Chat with word-by-word replies; Enter send / Shift+Enter newline; stop
  (`POST /session/{id}/abort`); timestamps always shown.
- 3 pinned free models (big-pickle, muse-spark, mimo) + switch-model hint
  and retry card on failure.
- Sidebar history with server-side search, auto-titles, delete with
  confirm; greeting + 3 example cards on empty chat.
- Live activity rows (thinking / tool calls / step + tokens), permission
  approve-once/always/deny cards, question option cards.
- Image attach (FilePart data-URL, vision confirmed), `/` command palette,
  `@` file-mention finder, copy + regenerate, markdown export, reply sound,
  adjustable font size.
- Essentials settings: language (47 locale codes; full FR + EN), theme
  black/white, font size, sound, default model.
- Footer: `Vexis - Vertexcorp - bakre lamcharki - 2026 copyright`.

### Fixes made while testing
1. `Transfer-Encoding: chunked` on engine 204s killed Chromium fetches →
   strip TE/body on 1xx/204/304 in both proxies.
2. Missing lazy chunks crashed the chat → crawled all ~870 chunks to fixpoint.
3. Proxy answered shell HTML for `/vcs /path /lsp /mcp /pty /global/*` →
   route by `Accept` header.
4. Settings read `innerText` (empty in hidden iframes) → `textContent`.
5. Theme canvas stuck → inline colors + vertex `black/dark`, `white/light`.

---

## Phase 2 — Power features (2026-10-06/07)

- **Engine auto-updater** (`engine_updater.py`): silent startup + background
  update of the runtime exe (now v1.18.35), never takes the UI down.
- **Model curation**: only proven free opencode models kept; big-pickle
  remains default (`workspace/config.json`).
- **13 local slash commands** as engine prompts (`vexis_ui/prompts/`), plus
  `!` direct shell mode and `@` file mentions.
- **Undo/redo** with real file restore (workspace is a git repo; revert of
  the turn restores files).
- **Diff view** for the last turn (anchored on first user message id).
- **Todo card** rendered from task-tool steps; **tool detail cards** with
  expandable input/output; **thinking toggle**; **stats footer**
  (model / tokens / duration / cost).
- **Toasts** via `toast.ps1` (WinRT), **config panel** (engine config
  JSON editor), **command palette** (Ctrl+K), **keybinds**, **model
  variants** (small/big per provider), **IDENTITY temp-dir rule** so big
  edits never block the app folder.
- OAuth intentionally skipped: `authorize` needs an interactive
  deployment-select flow; free opencode models don't need it.

---

## Phase 3 — UX overhaul + infrastructure (2026-10-08)

### Performance (was 40–65 s "thinking" on the first message)
- Root cause: cold engine pays plugin/catalog load on the FIRST turn
  (dozens of `plugin.added` events; measured with `bench_last.py`).
- **Warmup**: `server.py` runs one invisible throwaway turn at boot
  (`ping` prompt, session deleted after completion) — log line
  `[vexis-ui] engine warmed up`.
- **Watchdog**: background thread health-checks the engine every 10 s and
  relaunches it hidden if it dies (verified by killing the engine —
  back in ~15 s). Re-warms after every restart.
- Server startup reduced: removed the 40 s pre-wait; engine spawns
  immediately when down.

### Config + keys relocated into the vexis folder
- `vexis/config/` now holds `opencode.jsonc`, `plugins/rtk.ts`,
  `package.json`, `node_modules/`, `auth/auth.json` (one-time migration
  from `~/.config/opencode` + `~/.local/share/opencode` runs at server boot).
- Engine is started with `OPENCODE_CONFIG` + `OPENCODE_CONFIG_DIR`
  pointing at `vexis/config` (set in `app_desktop.py`, server watchdog, and
  server itself). Verified: engine `/config` reports
  `provider.opencode.name = "Vexis runtime"`.

### UI overhaul
- **opencode-style step rows**: `Thinking…>` `Shell…>` `Edit…>` `WebFetch…>`
  `Search…>` `Read…>` `Todo…>` `Task…>` `Question…>` rows with chevron
  rotation, per-tool accent colors, streaming bodies, merged consecutive
  thinking segments; wired to both the SSE stream and the poll loop.
- **Right sidebar** (`#rsb`): Context / Todo / Diff tabs, context bars
  (session, title, model, agent, directory, usage, files), open/close
  persisted across reloads.
- **Sidebar collapse fixed**: 56 px icon rail (was fully hidden), state
  persisted.
- **Sharp composer**: squared input, square send/attach buttons, square
  corners everywhere it mattered.
- **Right-click menu** on messages: copy selection / copy all / select all.
- **Search button removed** from topbar and sidebar magnifier removed
  (sidebar search still works through its input).
- **English default**: `index.html lang="en"`, default language `en`,
  one-time migration forces FR → EN once (`langV` version flag).
- **Arabic readability**: base font 17.5 px, larger message text,
  line-height 1.9.
- Message areas are user-selectable (`user-select: text`) for copying.

### Memory / Knowledge (RAG-style injection)
- New **Settings → Memory** panel: knowledge notes (`.md`/`.txt`) CRUD +
  AGENTS.md editor.
- New server routes: `GET/POST/DELETE /vexis/memory` (files in
  `vexis/memory/`), `GET/POST /vexis/file` (path-validated: vexis folder or
  opencode config dir, text types only). Full round-trip tested; `.js`
  correctly rejected.
- `buildSystem()` in `app.js` injects identity + all knowledge files into
  every prompt (replaces the raw identity system string).

### Toasts show "VEXIS"
- `toast.ps1` creates a Start Menu shortcut with explicit
  `AppUserModelID = Vexis.App` via the ShellLink coclass
  (`IPropertyStore::SetValue` on `System.AppUserModel.ID`, then
  `IPersistFile::Save`), one-time stamp file. Toasts are posted with
  `CreateToastNotifier("Vexis.App")` — source name is **Vexis**, not
  "Windows PowerShell". AUMID read back from the .lnk to confirm.

### Startup / window hygiene
- `run.bat` no longer launches the engine visibly (no more `bun.exe`
  taskbar entry); it only runs `app_desktop.py`.
- `app_desktop.py` spawns the engine hidden (`DETACHED_PROCESS`), with the
  config env vars and stdout/stderr to `vexis/config/engine.log`.

### Server hardening
- Proxy returns a clean JSON **502** (`engine unreachable`) instead of a
  dead connection when the engine is down.
- Engine updater, warmup and watchdog all run as threads inside
  `server.py`; updater failure can never take the server down.

### Verification (all green)
- `python -m py_compile server.py, app_desktop.py`
- `node --check app.js, i18n.js`
- `check_ids.js` — 71 html ids, all sections/tabs/panels/loaders match
  (`set-theme` is a known false positive)
- `check_i18n.js` — 180 keys used, FR/EN parity complete
- Live curls: `/api/health`, `/vexis/memory` (GET/POST/DELETE),
  `/vexis/file`, `/config` (engine), UI assets (rsb, memory panel,
  ctx-menu, `lang="en"` all present)
- Watchdog kill test + warmup log line + toast AUMID read-back.

---

## Run

`vexis_ui\run.bat` → `app_desktop.py` → engine `:4097` (hidden, cwd
`vexis/workspace`, git repo for stable project id, config from
`vexis/config`) + UI server `:8100` (warmup + watchdog threads) + native
`Vexis` pywebview window.

Engine and server can each be restarted alone without closing the window.

## Leftovers / notes
- Config now lives in `vexis/config/opencode.jsonc` (allow-all permissions
  incl. external directories); keys in `vexis/config/auth/auth.json`;
  knowledge in `vexis/memory/`.
- Engine logs: `vexis/config/engine.log` (watchdog spawns) and
  `vexis/.runtime/engine.log` (manual spawns).
- `GET /doc` (Swagger) on the engine hangs it — never probe it.
- OAuth skipped on purpose (see Phase 2).
- UI changes need **Ctrl+R** in the Vexis window to load.
