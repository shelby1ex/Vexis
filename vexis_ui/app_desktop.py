"""app_desktop.py - Vexis chat UI in a native desktop window (no browser tab)."""
import datetime
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

HOST = "127.0.0.1"
FROZEN = bool(getattr(sys, "frozen", False))


def _hide():
    """subprocess kwargs so helper tools never flash a console window."""
    if os.name == "nt":
        return {"creationflags": 0x08000000}
    return {}


def _port(name, default):
    try:
        p = int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        return default
    return p if 1 <= p <= 65535 else default


ENGINE_PORT = _port("OPENCODE_PORT", 4001)
UI_PORT = _port("VEXIS_UI_PORT", 8001)
if FROZEN:
    # Vexis.exe (PyInstaller onefile) must stay inside vexis_ui/:
    # logs/profile next to the exe, user data in the parent vexis/ folder.
    EXE_DIR = os.path.dirname(os.path.abspath(sys.executable))
    BASE_DIR = EXE_DIR
    ENGINE_DIR = os.environ.get("VEXIS_DIR") or os.path.dirname(EXE_DIR)
    SERVER_CMD = [sys.executable, "--server"]
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    ENGINE_DIR = os.environ.get("VEXIS_DIR") or os.path.dirname(BASE_DIR)
    SERVER_CMD = [sys.executable, os.path.join(BASE_DIR, "server.py")]
WORKSPACE = os.path.join(ENGINE_DIR, "workspace")
LOGDIR = os.path.join(BASE_DIR, "vexis_logs")
LOG = os.path.join(LOGDIR, "vexis_ui.log")
# Isolated engine database: the shared ~/.local/share/opencode/opencode.db
# is migrated by newer opencode builds (session_v2, no `session` table) which
# makes vexis-runtime 1.18.35 abort with "Database is not empty and has no
# session table". Pointing XDG_DATA_HOME inside the vexis folder gives this
# copy its own fresh DB and it never fights other installs.
DATA_DIR = os.path.join(ENGINE_DIR, ".data")


def _log(msg):
    line = f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S} [vexis-ui] {msg}"
    print(line, flush=True)
    try:
        os.makedirs(LOGDIR, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def _up(port):
    try:
        s = socket.create_connection((HOST, port), timeout=1)
        s.close()
        return True
    except OSError:
        return False


def _wait(port, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if _up(port):
            return True
        time.sleep(0.4)
    return False


def _ui_root():
    """Ask the running UI server which folder it serves (None if unreachable)."""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{UI_PORT}/vexis/info", timeout=3) as r:
            data = json.loads(r.read().decode("utf-8") or "{}")
            return data.get("root")
    except Exception:
        return None


_SAFE_IMAGES = {"python.exe", "pythonw.exe", "vexis-runtime.exe", "opencode.exe", "bun.exe"}


def _image_of(pid):
    try:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                             capture_output=True, text=True, timeout=10,
                             **_hide()).stdout
        parts = [p.strip().strip('"') for p in out.strip().split(",")]
        return (parts[0].lower() if parts else "")
    except Exception:
        return ""


def _kill_port_owner(port):
    """Kill the process listening on 127.0.0.1:port (stale copy from another folder)."""
    try:
        out = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, timeout=10,
            **_hide()
        ).stdout.splitlines()
        pids = set()
        for line in out:
            parts = line.split()
            # e.g. TCP 127.0.0.1:8001 0.0.0.0:0 LISTENING 1234
            if len(parts) == 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
                local = parts[1]
                if local == f"{HOST}:{port}":
                    try:
                        pids.add(int(parts[4]))
                    except ValueError:
                        pass
        for pid in pids:
            if pid != os.getpid():
                img = _image_of(pid)
                if img not in _SAFE_IMAGES:
                    _log(f"not killing :{port} owner pid {pid} ({img or 'unknown'} - not a Vexis process)")
                    continue
                _log(f"killing stale process on :{port} (pid {pid} {img})")
                subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                               capture_output=True, timeout=10, **_hide())
        return bool(pids)
    except Exception as e:
        _log(f"could not kill stale :{port} owner: {e}")
        return False


def _pidfile(cfg):
    return os.path.join(cfg, f"engine-{ENGINE_PORT}.pid")


def _spawn_alive(cfg):
    try:
        with open(_pidfile(cfg), encoding="utf-8") as f:
            pid = int(f.read().strip())
    except (OSError, ValueError):
        return None
    if not _pid_alive(pid):
        return None
    # PID numbers get recycled: only defer if it is really our engine
    if _image_of(pid) != "vexis-runtime.exe":
        return None
    return pid


def _clear_pidfile(cfg):
    try:
        os.remove(_pidfile(cfg))
    except OSError:
        pass


def _pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        pass  # Windows WinError 87: verify via tasklist below
    except Exception:
        return False
    return _image_of(pid) != ""


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    xdg = os.environ.get("XDG_DATA_HOME") or DATA_DIR
    os.makedirs(xdg, exist_ok=True)
    exe = os.path.join(ENGINE_DIR, ".runtime", "vexis-runtime.exe")
    cfg = os.path.join(ENGINE_DIR, "config")
    os.makedirs(cfg, exist_ok=True)
    for _attempt in range(3):
        if _up(ENGINE_PORT):
            _log(f"engine already running :{ENGINE_PORT}")
            break
        pid = _spawn_alive(cfg)
        if pid:
            _log(f"engine start already in progress (pid {pid}), waiting")
            _wait(ENGINE_PORT, timeout=30)
            continue
        _clear_pidfile(cfg)  # stale pidfile: spawn fresh instead of waiting on a ghost
        _log(f"starting engine :{ENGINE_PORT} (cwd=workspace, hidden, config={cfg})")
        env = dict(
            os.environ,
            OPENCODE_CONFIG=os.path.join(cfg, "opencode.jsonc"),
            OPENCODE_CONFIG_DIR=cfg,
            OPENCODE_PORT=str(ENGINE_PORT),
            VEXIS_UI_PORT=str(UI_PORT),
            XDG_DATA_HOME=xdg,
        )
        # workspace copied from another Windows account -> trust it for git
        if not env.get("GIT_CONFIG_COUNT"):
            env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="safe.directory",
                       GIT_CONFIG_VALUE_0=WORKSPACE)
        if not os.path.isfile(exe):
            _log(f"engine binary missing: {exe}")
            break
        try:
            logf = open(os.path.join(cfg, "engine.log"), "ab", buffering=0)
        except OSError:
            logf = subprocess.DEVNULL
        try:
            proc = subprocess.Popen(
                [exe, "serve", "--port", str(ENGINE_PORT), "--hostname", HOST],
                cwd=WORKSPACE if os.path.isdir(WORKSPACE) else BASE_DIR,
                env=env, stdout=logf, stderr=logf,
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
            )
            try:
                with open(_pidfile(cfg), "w", encoding="utf-8") as f:
                    f.write(str(proc.pid))
            except OSError:
                pass
        except OSError as e:
            _log(f"engine start failed: {e}")
            break
        _wait(ENGINE_PORT, timeout=60)
    else:
        _log(f"engine on :{ENGINE_PORT} did not come up after retries")
    if _up(UI_PORT):
        root = _ui_root()
        # normcase: a server from another copy (e.g. E:\offline_ai\vexis)
        # holds the port but serves the wrong files -> restart it.
        if root and os.path.normcase(os.path.abspath(root)) != os.path.normcase(os.path.abspath(BASE_DIR)):
            _log(f"UI server on :{UI_PORT} serves {root} (want {BASE_DIR}) - restarting")
            _kill_port_owner(UI_PORT)
            for _ in range(25):
                if not _up(UI_PORT):
                    break
                time.sleep(0.4)
    if not _up(UI_PORT):
        _log(f"starting UI server :{UI_PORT}")
        subprocess.Popen(
            SERVER_CMD,
            cwd=BASE_DIR,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
        )
    else:
        _log(f"UI server already running :{UI_PORT}")
    if not _wait(UI_PORT):
        _log("UI server did not come up")
        input("Press Enter...")
        sys.exit(1)
    _log(f"opening Vexis window on http://{HOST}:{UI_PORT}/")
    try:
        import webview
    except ImportError:
        _log("pywebview missing; install: python -m pip install pywebview")
        input("Press Enter...")
        sys.exit(1)
    window = webview.create_window(
        "Vexis", f"http://{HOST}:{UI_PORT}/",
        width=1280, height=820, min_size=(900, 600),
    )
    # persistent WebView2 profile: a temp profile is wiped on exit and crashes
    # with WinError 32 when WebView2 still holds file locks (shared_proto_db).
    profile = os.path.join(ENGINE_DIR, ".webview2")
    os.makedirs(profile, exist_ok=True)
    try:
        # storage_path is the kwarg in pywebview 6.x; plain start is the fallback
        webview.start(storage_path=profile, private_mode=False)
    except TypeError:
        # older pywebview build without storage_path support
        try:
            webview.start()
        except Exception as e:
            _log(f"webview failed: {e}")
            input("Press Enter...")
            sys.exit(1)
    except Exception as e:
        _log(f"webview failed: {e}")
        input("Press Enter...")
        sys.exit(1)


if __name__ == "__main__":
    if "--server" in sys.argv[1:]:
        from server import run as _run_server
        _run_server()
    else:
        main()
