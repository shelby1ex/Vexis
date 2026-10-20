# Vexis — local desktop AI agent

Vexis is a Windows desktop chat app (pywebview + HTML/CSS/JS) powered by a
local OpenCode-compatible runtime engine. Everything runs on your machine:
no cloud database, no login, no account.

- **Chat** with streaming replies, stop/regenerate, image attach + screenshots
- **Agent tools**: shell, grep, read, edit, webfetch, question cards, todo plans
- **Right rail**: Files · Browser · Todo — a Chrome-style browser panel
- **Artifact panel**: the AI pushes files and sites into the right rail
  (`vexis_show` tool, or automatically when it writes an HTML/SVG/PDF/image/md)
- **Projects** view, model router with fallback, permission center, 24 themes
- **Terminal** with persistent shells, **OCR** screen reading (`/ocr`)
- **Test suite**: `python -m pytest tests/ -q` (121 tests)

## Quick start

Requires Windows 10/11, **Python 3.12** on `PATH`, and the **WebView2 runtime**
(bundled with Windows 11; `redist\webview2boot.exe` installs it otherwise).

```bat
git clone https://github.com/thomasshelby1ex-glitch/Vexis.git
cd Vexis
install.bat           :: pip deps + .env secret + Desktop shortcut
vexis_ui\run.bat      :: start the app
```

On first launch the app fetches the pinned engine into `.runtime\`. Prebuilt
releases are attached to the GitHub releases page; the installer is built from
`Vexis.iss` (see below). Nothing in the repo contains your keys — API keys live
in `config\auth.json`, which is git-ignored.

## Build

```bat
build_exe.bat         :: -> vexis_ui\Vexis.exe (PyInstaller, windowed, logo icon)
python package.py     :: -> dist\vexis-<version>.zip (portable release)
```

`dist\VexisSetup-<version>.exe` additionally needs [Inno Setup](https://jrsoftware.org/isinfo.php)
(`iscc`) plus the redistributables in `redist\` (Python 3.12 installer and the
WebView2 bootstrapper) — those are downloaded, not committed.

## Layout

```
vexis/
  vexis_ui/      UI server (server.py), desktop shell (app_desktop.py),
                 frontend (index.html, styles.css, app.js, i18n.js), tests/
  docs/          build/audit reports (internal)
  config/        opencode.jsonc (engine config, committed);
                 auth.json + engine.log are local state (git-ignored)
  memory/        knowledge notes injected into every prompt (RAG-style)
  redist/        installer inputs (Python + WebView2), downloaded (git-ignored)
  version.json   app version source of truth

  .runtime/      engine binary, fetched on first run        (git-ignored)
  .data/         isolated engine database                   (git-ignored)
  .webview2/     WebView2 profile/cache                     (git-ignored)
  workspace/     agent working directory (its own repo)     (git-ignored)
  dist/          release output                             (git-ignored)
```

## Ports

Engine `:4001` (`OPENCODE_PORT`), UI `:8001` (`VEXIS_UI_PORT`).

## Privacy

See [PRIVACY.md](PRIVACY.md). Short version: chats, keys and files stay on
your disk in plaintext. Anyone with access to your Windows account can read
them. Model calls go to the configured provider (default: free
`opencode/*` models via the Vexis runtime).

## Security model

- Servers bind `127.0.0.1` only — nothing is reachable from the network.
- State-changing local endpoints (`/vexis/*` POST/DELETE) require the
  per-install secret header (`X-Vexis-Secret`, from `GET /vexis/bootstrap`,
  readable same-origin only). This blocks CSRF from malicious websites.
- Shell (`bash`), outside-workspace access and skills default to **ask**;
  reads and local edits are allowed (edits are diff-visible and revertible).
- `/vexis/desktop` (mouse/keyboard) and `/vexis/term` (shells) are
  localhost-only with no remote path by design.

## License

Proprietary — © 2026 Vertexcorp. All rights reserved.
