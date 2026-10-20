# Changelog

## 0.9.1 (2026-10-19) — UI overhaul

### Added
- **Agent switcher in the composer**: a dropdown chip (same shape as the model
  picker) beside the prompt picks the agent. It is populated from the engine's
  primary agents (`/agent`, hidden built-ins excluded) and falls back to
  Build/Plan, so only the two main agents are offered — every other agent is a
  sub agent the model invokes itself.
- **Composer prompt box**: the input is one wide rounded card with the prompt on
  top and a utility tray underneath — a borderless `+` attach button, the
  **model picker** (moved out of the top bar) and the agent picker, all as
  dropdown chips, with a high-contrast squircle action button on the right
  (dark glyph, inverts on light themes). Both popovers are re-parented onto
  `<body>` and positioned from measured geometry, so they float clear of the
  card instead of covering the prompt or bleeding the page through.
- **Theme gallery** (General & interface): 24 built-in themes ported from the
  reference settings app, each with a light and a dark palette. Each card is a
  reference-style thumbnail (mini window pinned top-right, two content bars, an
  accent dot bottom-left) with the name and an apply action below. A theme
  drives the whole token set (`--bg`, `--surface`, `--border`, `--text`,
  `--accent`), with the readable foreground derived from the background
  luminance, so any canvas stays legible. The light/dark toggle picks the
  palette.
- Settings reorganized into **four tabs** — *General & interface*, *AI engine*,
  *Security & integrations* and *System* — over rounded cards with uppercase
  section headers and tips. Permissions are bucketed into categories (Files,
  Shell, Web, Other) with a pinned **Save changes** bar, and every provider
  card shows its own key status with an "Add key" shortcut that prefills the
  form.
- **Artifact panel (AI → right rail)**: the assistant can now put what it builds
  into the right sidebar. An explicit `vexis_show` tool (`path` | `url` |
  `title`) pushes on purpose; a completed `write`/`edit` of an `.html`, `.svg`,
  `.md`, `.pdf` or image file is pushed automatically. Pushes travel over a
  Server-Sent Events channel (`POST /vexis/artifact` → `/vexis/events`), the
  panel opens itself, and the artifact list survives a reload
  (`GET /vexis/artifacts`). Local files are served by `/vexis/raw` and rendered
  in a sandboxed, opaque-origin frame, so AI-authored HTML can run its scripts
  without ever reaching the app's DOM or its local secret.
- **Chrome-style Browser panel**: the Browser tab is a full-bleed window with a
  real tab strip (favicon, close button, `+`), circular back / forward / reload
  buttons, a rounded omnibox with a lock / globe glyph, copy-link and
  open-in-browser actions, and a home screen listing recent sites and artifacts.

### Changed
- **Right sidebar** is now the artifact panel and keeps only three tabs:
  **Files** (browse the workspace), **Browser** (preview sites and local pages)
  and **Todo**. Removed Context, Diff, Git, Terminal and Verify tabs (and their
  now-dead UI code; the backend endpoints remain).
- The assistant is told (system prompt) that it has a right sidebar with Files,
  Browser and Todo, and to save artifacts in the workspace and point the user to
  the panel (prefer self-contained HTML for direct preview).
- Settings → Agents now separates **Default agent**, **Main agents**
  (build / plan) and **Sub agents**.
- Internal reports moved to `docs/`; caches, stale logs and legacy pidfiles
  removed from the project root.
- The composer screenshot button is gone; screenshots are taken from the
  `/screenshot` palette command, which attaches the capture to the prompt.

### Fixed
- **Composer model/agent dropdowns** were clipped at the bottom edge and let the
  page show through them (descriptions collided with the hint text under the
  card). The popovers are now portaled to `<body>`, painted with an opaque
  background, wrapped (no more clipped descriptions) and positioned above the
  card, clamped to the viewport.
- **Settings toggle rows** overlapped: the vendor `.toggle` fixed 44×24 box was
  never reset, so the row label was crushed into the switch. Rows now keep the
  label on the left and pin the switch right.
- `/vexis/ocr` crashed on real images: the WinRT `.AsRandomAccessStream()` /
  `.AsTask()` helpers are not discoverable from `powershell -Command` on every
  Windows build. The helper now uses explicit type projections plus a
  reflection-based `Await`, and a regression test OCRs a generated image.
- Right-rail **Git** tab was empty when the workspace repo had been copied from
  another Windows account (git "dubious ownership"). The server now runs git
  with `-c safe.directory=<workspace>`; the engine inherits the same via env,
  so branch/status/log and revert work again.
- `build_exe.bat` built a **console** exe (`--console`) although the shipped
  app is windowed. It now builds `Vexis.spec` (windowed, logo icon).
- `package.py` shipped a ~180 MB `vexis-runtime.prev.exe` rollback copy,
  `vexis_logs/`, and stray bitmaps inside the release zip, and swept the whole
  `vexis_ui` tree including the PyInstaller `build/`+`dist/` output; all excluded.
- Test-suite no longer hardcodes this machine's folder (relocatable).

## 0.9.0 (2026-10-14) — release-prep build

### Added
- **Vexis.exe**: single-file launcher (PyInstaller onefile, ~34MB) in
  `vexis_ui/` — double-click instead of `run.bat` (`build_exe.bat`
  rebuilds it; `Vexis.exe --server` runs the UI server headless).
- Packaging (`package.py`) now ships `Vexis.exe` when present.
- App identity: `version.json` source of truth, version in `/vexis/info`
  and in the footer.
- Release hardening: `X-Vexis-Secret` CSRF header on all state-changing
  local endpoints (`/vexis/bootstrap` handshake), localhost-only binding.
- Permission defaults tightened: `bash`, `external_directory` and `skill`
  now `ask` (reads/local edits stay allowed).
- OCR screen reading (`POST /vexis/ocr`, Windows inbox engine) + `/ocr`
  chat command.
- Packaging: `package.py` builds a clean portable `dist/` + `install.bat`
  (Python check, deps, fresh secret, Desktop shortcut) + `Vexis.iss`
  (Inno Setup script).
- Docs: README, INSTALL, PRIVACY, this changelog.
- Monochrome marketing site in `design/website/`.

### Changed
- Engine 1.18.35 → **1.19.0** (auto-update; pinned in manifest at pack time).

### Fixed
- `jsonc_loads` chokes on UTF-8 BOM in `opencode.jsonc` (broke config
  verification and the permission editor).
- Terminal exit-code detection (`$LASTEXITCODE` is null after cmdlets;
  uses `$?` now).
- Per-port engine pidfiles (test server no longer steals the live pidfile).
- Pending-cards full chat width, right-rail drag handle wired.

## 0.8.x — unreleased development

- Question cards (global `/question` route + `question.asked` events).
- Right rail: Files, Browser (tabbed), Git, Terminal, Verify tabs.
- Projects view, model-router fallback, 20-theme engine, Arabic sizing.
- 80-test suite (backend + frontend contracts + live UI).
