# Privacy — Vexis

Last updated: 2026-10-14 (v0.9.0).

## Local-first

Vexis stores everything on your own disk, inside its folder:

- chats and agent turns: `.data/opencode.db` (SQLite)
- provider keys: `config/auth.json` (**plaintext JSON**)
- engine config: `config/opencode.jsonc`
- knowledge notes: `memory/`
- logs: `config/engine.log`, `vexis_ui/vexis_logs/`, `.data/opencode/log/`

There is no Vexis cloud account, no telemetry, no analytics.

## Plaintext warning

Keys, chats and files are **not encrypted**. Anyone who can log into your
Windows account (or read your disk) can read them. Do not paste secrets you
wouldn't keep in a text file, and set a Windows password + BitLocker if the
machine is shared or portable.

## Network use

- UI + engine talk only over loopback (`127.0.0.1:4001`, `127.0.0.1:8001`).
  Nothing listens on your LAN or the internet.
- Model calls go to the configured provider. Default: free `opencode/*`
  models through the Vexis runtime (your prompts leave the machine to the
  provider). Local-only inference is not bundled: talk to us if you need it.
- The engine updater checks GitHub releases when enabled
  (`VEXIS_AUTO_UPDATE=1` in `.env`). Set it to `0` for fully offline use
  after install (engine binary is already bundled).

## What we never do

- No keystroke logging, no screen recording (screenshots/OCR run only when
  **you** click the button or type `/ocr`).
- The Browser tab is a plain preview; the automation browser (when added)
  will be a separate session that never touches your personal cookies.
