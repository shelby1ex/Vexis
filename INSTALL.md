# Install Vexis (Windows)

## Option A — installer (recommended)

1. Run `dist/VexisSetup-0.9.0.exe`.
2. Keep **Desktop shortcut** / **Start Menu folder** checked as you like
   (Start Menu group: *Vexis*).
3. Keep **Python 3.12 + dependencies** checked unless Python is already set
   up (needed only for the `run.bat` fallback and rebuilding).
4. Missing WebView2 runtime is installed automatically (one admin prompt).
5. Launch from the Desktop/Start Menu. To pin to the taskbar: right-click
   the running Vexis icon → *Pin to taskbar* (Windows forbids installers
   from pinning on your behalf).

## Option B — portable (no install)

1. Unzip the Vexis package anywhere (e.g. `D:\Vexis`).
2. Double-click `vexis_ui\Vexis.exe`.
   - `Vexis.exe` must stay inside `vexis_ui/` (it finds config, engine and
     database relative to its own folder).
   - No Python needed to *run* it (only to *rebuild* it via `build_exe.bat`).
   - Internet needed once for WebView2 if missing; the engine is bundled.
3. Done. The engine starts hidden; the Vexis window opens on
   `http://127.0.0.1:8001/`. Close the window to quit the UI; the engine
   keeps running hidden so the next start is instant. To stop everything,
   kill `vexis-runtime.exe` and the UI server in Task Manager.

> Script fallback: `vexis_ui\run.bat` needs Python 3.12 with
> `pywebview`/`Pillow` (it self-installs them on first run).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Window says engine never comes up | Open `http://127.0.0.1:8001/vexis/info` — `engine_ok` should be `true`. If not, read `config/engine.log` tail. |
| `starting engine …` hangs then continues | A stale `config/engine-<port>.pid` pointed at a dead process. It is cleared automatically and retried (3 attempts). Delete it manually if stuck. |
| Port busy (`SystemExit(1)`) | Another copy is running (check `E:\offline_ai\vexis` duplicate). One copy at a time — ports are fixed. |
| `pip install` fails | Run `python -m pip install pywebview Pillow` yourself, then `run.bat` again. |
| Blank question card | Hard-refresh the window (Ctrl+R): the running server may predate the latest frontend. If it persists, the model didn't call the question tool. |
| UI looks broken after update | Ctrl+R. The desktop window caches aggressively. |

## Updating

Replace the install folder with the new package **but keep** your:
`config/auth.json`, `config/opencode.jsonc`, `memory/`, `workspace/`, `.data/`.
`install.bat` (in the package) does this preservation automatically.

## Uninstall

Delete the folder. Optionally remove `%LOCALAPPDATA%\Temp\vexis-test-xdg`
(test leftovers) — nothing else is written outside the folder.
