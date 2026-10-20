"""server.py - serve the Vexis UI, proxy engine API calls to the Vexis runtime engine (.runtime\vexis-runtime.exe).

- Local files (index.html, styles.css, app.js, i18n.js) served from this folder.
- Engine routes and fetch calls are forwarded to 127.0.0.1:4001
  (streamed + chunked, SSE-safe, HTTP/1.1 keep-alive).
- Browser navigations (Accept: text/html) fall back to our index.html.
- Ports: engine OPENCODE_PORT (default 4001), UI VEXIS_UI_PORT (default 8001).
"""
import datetime
import http.server
import json
import os
import platform
import queue
import shutil
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.parse

def _port(name, default):
    try:
        p = int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        print(f"[vexis-ui] bad {name}={os.environ.get(name)!r}, using {default}", flush=True)
        return default
    if 1 <= p <= 65535:
        return p
    print(f"[vexis-ui] {name}={p} out of range, using {default}", flush=True)
    return default


ENGINE_PORT = _port("OPENCODE_PORT", 4001)
UI_PORT = _port("VEXIS_UI_PORT", 8001)
ENGINE = f"http://127.0.0.1:{ENGINE_PORT}"
PORT = UI_PORT
MAX_BODY = 10 * 1024 * 1024  # proxy + JSON body cap (DoS guard)
def _hide():
    """subprocess kwargs so helper tools never flash a console window
    (the app itself is windowed - children must stay invisible too)."""
    if os.name == "nt":
        return {"creationflags": 0x08000000}
    return {}


def _init_paths():
    """Resolve static ROOT and user-data VEXIS_DIR.

    Frozen (Vexis.exe, PyInstaller onefile): statics live read-only in
    sys._MEIPASS/vexis_ui, user data lives next to Vexis.exe, which must
    stay inside vexis_ui/. VEXIS_DIR env overrides everything (tests).
    """
    if os.environ.get("VEXIS_DIR"):
        vex = os.path.abspath(os.environ["VEXIS_DIR"])
        return vex, os.path.join(vex, "vexis_ui")
    if bool(getattr(sys, "frozen", False)):
        meipass = sys._MEIPASS
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        return os.path.dirname(exe_dir), os.path.join(meipass, "vexis_ui")
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(here), here


VEXIS_DIR, ROOT = _init_paths()
if bool(getattr(sys, "frozen", False)):
    # updater computes its paths at import time from these
    os.environ.setdefault("VEXIS_ENGINE_DIR", os.path.join(VEXIS_DIR, ".runtime"))
    os.environ.setdefault("VEXIS_ENV_FILE", os.path.join(VEXIS_DIR, ".env"))

try:
    import engine_updater as updater
except Exception as _upd_err:  # updater must never take the UI server down
    updater = None
    print(f"[vexis-ui] engine updater unavailable: {_upd_err}", flush=True)

# Engine config + credential files live INSIDE the vexis folder (user request).
CONFIG_DIR = os.path.join(VEXIS_DIR, "config")
CONFIG_PATH = os.path.join(CONFIG_DIR, "opencode.jsonc")
AUTH_PATH = os.path.join(CONFIG_DIR, "auth.json")
MEMORY_DIR = os.path.join(VEXIS_DIR, "memory")
_OLD_CONFIG = os.path.expanduser("~/.config/opencode/opencode.jsonc")
_OLD_AUTH = os.path.expanduser("~/.local/share/opencode/auth.json")
RUNTIME_EXE = os.path.join(VEXIS_DIR, ".runtime", "vexis-runtime.exe")
VERSION_PATH = os.path.join(VEXIS_DIR, "version.json")
SECRET_PATH = os.path.join(VEXIS_DIR, ".vexis_secret")


def _app_version():
    try:
        with open(VERSION_PATH, encoding="utf-8") as f:
            d = json.load(f)
        return {"version": str(d.get("version") or "0.0.0"),
                "engine": str(d.get("engine") or "?"),
                "date": str(d.get("date") or "")}
    except (OSError, ValueError):
        return {"version": "0.0.0", "engine": "?", "date": ""}


APP_VERSION = _app_version()


def _local_secret():
    try:
        with open(SECRET_PATH, encoding="utf-8") as f:
            s = f.read().strip()
        if s:
            return s
    except OSError:
        pass
    import secrets as _secrets
    s = _secrets.token_hex(32)
    try:
        with open(SECRET_PATH, "w", encoding="utf-8", newline="\n") as f:
            f.write(s)
        try:
            os.chmod(SECRET_PATH, 0o600)
        except OSError:
            pass
    except OSError:
        pass
    return s


APP_SECRET = _local_secret()


def _migrate_config():
    """one-time copy of the opencode config folder + keys into vexis/config."""
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        if not os.path.isfile(CONFIG_PATH) and os.path.isfile(_OLD_CONFIG):
            shutil.copy2(_OLD_CONFIG, CONFIG_PATH)
        if not os.path.isfile(AUTH_PATH) and os.path.isfile(_OLD_AUTH):
            shutil.copy2(_OLD_AUTH, AUTH_PATH)
        old_dir = os.path.dirname(_OLD_CONFIG)
        for name in ("plugins", "package.json", "package-lock.json", ".gitignore"):
            src = os.path.join(old_dir, name)
            dst = os.path.join(CONFIG_DIR, name)
            if os.path.exists(src) and not os.path.exists(dst):
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
    except Exception as e:
        print(f"[vexis-ui] config migration: {e}", flush=True)


_migrate_config()
DATA_DIR = os.path.join(VEXIS_DIR, ".data")
# Honor a preset XDG_DATA_HOME (tests use a throwaway dir so they never
# share the live engine database - concurrent engines on one sqlite file
# corrupt it and crash-loop with ServeError).
XDG_DIR = os.environ.get("XDG_DATA_HOME") or DATA_DIR
os.makedirs(XDG_DIR, exist_ok=True)
ENGINE_ENV = dict(os.environ,
                  OPENCODE_CONFIG=CONFIG_PATH,
                  OPENCODE_CONFIG_DIR=CONFIG_DIR,
                  XDG_DATA_HOME=XDG_DIR,
                  OPENCODE_PORT=str(ENGINE_PORT),
                  VEXIS_UI_PORT=str(UI_PORT),
                  # browser-independent CSRF secret for the panel bridge plugin
                  # (config/plugins/vexis-panel.ts pushes artifacts back here)
                  VEXIS_UI_SECRET=APP_SECRET)
# The workspace may have been copied from another Windows account; tell git (in
# the engine's own child processes) to trust it so revert/snapshot features do
# not trip the "dubious ownership" guard. Never clobber a user-set override.
if not ENGINE_ENV.get("GIT_CONFIG_COUNT"):
    ENGINE_ENV.update(GIT_CONFIG_COUNT="1",
                      GIT_CONFIG_KEY_0="safe.directory",
                      GIT_CONFIG_VALUE_0=os.path.join(VEXIS_DIR, "workspace"))

TERMS = {}
TERMS_LOCK = threading.Lock()
TERM_MAX = 4
TERM_SENTINEL = "__VEXIS_END__"

# ---------- artifact panel ----------
# The AI pushes files and websites into the right-hand panel. Two entry points:
#   * the `vexis_show` tool (config/plugins/vexis-panel.ts) -> POST /vexis/artifact
#   * a plain file write, surfaced by the UI from the engine event stream
# Artifacts are in-memory only, newest last, bounded, and mirrored to every
# connected UI through the /vexis/events SSE stream.
ARTIFACTS = []
ART_MAX = 60
ART_LOCK = threading.Lock()
ART_SUBS = []
ART_SUBS_LOCK = threading.Lock()
ART_RAW_MAX = 64 * 1024 * 1024  # cap for /vexis/raw responses

# things the Browser panel can render inline
PREVIEW_EXT = {
    ".html", ".htm", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".pdf", ".txt", ".md", ".json", ".csv", ".xml", ".css", ".js", ".mp4",
    ".webm", ".mp3", ".wav",
}
RAW_MIMES = {
    ".html": "text/html", ".htm": "text/html", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
    ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8",
    ".json": "application/json", ".xml": "application/xml",
    ".css": "text/css", ".js": "text/javascript",
    ".mp4": "video/mp4", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav",
}


def _artifact_file(p):
    """Resolve a panel file. Absolute paths are used as given; relative paths are
    taken from the engine's working directory (the workspace). The file must
    exist. Anything on the local disk is allowed on purpose - the assistant is
    told to build projects outside the app folder (Desktop, ...)."""
    p = str(p or "").strip().strip('"')
    if not p:
        raise ValueError("path required")
    base = os.path.join(VEXIS_DIR, "workspace")
    ap = os.path.abspath(p if os.path.isabs(p) else os.path.join(base, p))
    if not os.path.isfile(ap):
        raise ValueError("file not found: " + p[:200])
    return ap


def _artifact_make(path=None, url=None, title=""):
    if path and not url:
        ap = _artifact_file(path)
        ext = os.path.splitext(ap)[1].lower()
        return {
            "kind": "file",
            "title": str(title or os.path.basename(ap))[:200],
            "path": ap,
            "url": "/vexis/raw?path=" + urllib.parse.quote(ap.replace("\\", "/")),
            "ext": ext,
            "preview": ext in PREVIEW_EXT,
        }
    if url:
        u = str(url).strip()
        if len(u) > 2000 or not u.lower().startswith(("http://", "https://")):
            raise ValueError("only http(s) urls allowed")
        return {"kind": "url", "title": str(title or u)[:200], "url": u,
                "ext": "", "preview": True}
    raise ValueError("path or url required")


def _artifact_publish(ev):
    with ART_SUBS_LOCK:
        subs = list(ART_SUBS)
    for q in subs:
        try:
            q.put_nowait(ev)
        except Exception:
            pass


def _artifact_add(path=None, url=None, title=""):
    art = _artifact_make(path, url, title)
    art["id"] = "a" + str(int(time.time() * 1000))
    art["at"] = datetime.datetime.now().isoformat(timespec="seconds")
    with ART_LOCK:
        ARTIFACTS.append(art)
        del ARTIFACTS[:-ART_MAX]
    _artifact_publish({"type": "artifact", "artifact": art})
    return art


def _term_spawn():
    with TERMS_LOCK:
        live = [i for i, t in TERMS.items() if t["proc"].poll() is None]
        for i in list(TERMS):
            if i not in live:
                TERMS.pop(i, None)
        if len(live) >= TERM_MAX:
            raise ValueError(f"too many terminals ({TERM_MAX}) - kill one first")
        proc = subprocess.Popen(
            ["powershell", "-NoProfile", "-NoLogo", "-NonInteractive", "-Command", "-"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1, creationflags=0x08000000,
        )
        tid = f"t{int(time.time() * 1000) % 1000000:06d}"
        TERMS[tid] = {"proc": proc, "buf": "", "lock": threading.Lock()}
        threading.Thread(target=_term_drain, args=(tid,), daemon=True).start()
        return tid


def _term_drain(tid):
    try:
        t = TERMS.get(tid)
        if not t:
            return
        for line in t["proc"].stdout:
            with t["lock"]:
                t["buf"] += line
                if len(t["buf"]) > 500000:
                    t["buf"] = t["buf"][-500000:]
    except Exception:
        pass


def _term_handle(body):
    if body.get("list"):
        with TERMS_LOCK:
            alive = [i for i, t in TERMS.items() if t["proc"].poll() is None]
            for i in list(TERMS):
                if i not in alive:
                    TERMS.pop(i, None)
        return {"ok": True, "terms": alive}
    tid = str(body.get("id") or "")
    if body.get("kill"):
        with TERMS_LOCK:
            t = TERMS.pop(tid, None)
        if not t:
            raise ValueError("unknown terminal")
        try:
            t["proc"].kill()
        except Exception:
            pass
        return {"ok": True, "id": tid}
    if not tid:
        return {"ok": True, "id": _term_spawn()}
    t = TERMS.get(tid)
    if not t or t["proc"].poll() is not None:
        raise ValueError("terminal is dead - open a new one")
    cmd = str(body.get("cmd") or "")
    if not cmd.strip():
        raise ValueError("cmd required")
    if len(cmd) > 20000:
        raise ValueError("cmd too long")
    try:
        timeout = min(max(int(body.get("timeout") or 60), 1), 300)
    except (TypeError, ValueError):
        raise ValueError("bad timeout")
    marker = f"{TERM_SENTINEL}{time.time_ns()}"
    with t["lock"]:
        start = len(t["buf"])
    try:
        t["proc"].stdin.write(cmd + '\nif ($?) { $__vrc = 0 } else { $__vrc = 1 }; echo "' +
                              marker + ' $__vrc"\n')
        t["proc"].stdin.flush()
    except Exception:
        raise ValueError("terminal is dead - open a new one")
    t0 = time.time()
    out = ""
    rc = None
    while time.time() - t0 < timeout:
        time.sleep(0.2)
        with t["lock"]:
            chunk = t["buf"][start:start + 200000]
        i = chunk.find(marker)
        if i >= 0:
            out = chunk[:i]
            tail = chunk[i + len(marker):].strip().split()
            try:
                rc = int(tail[0]) if tail else None
            except ValueError:
                rc = None
            break
    else:
        with t["lock"]:
            out = t["buf"][start:start + 200000]
    # strip the echoed command line itself
    lines = out.splitlines(keepends=True)
    if lines and lines[0].strip() == cmd.strip().splitlines()[0].strip():
        lines = lines[1:]
    return {"ok": True, "id": tid, "output": "".join(lines)[-100000:],
            "rc": rc, "done": rc is not None}


# Windows.Media.Ocr helper. The WinRT extension methods (.AsRandomAccessStream,
# .AsTask) are NOT discoverable from a plain `powershell -Command` on every
# Windows build, so this uses explicit type projections + a reflection-based
# Await. Verified on Windows 10/11 PowerShell 5.1. $args[0] = PNG path.
_OCR_PS = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) {
    $m = $asTask.MakeGenericMethod($type)
    $t = $m.Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
}
$bytes = [IO.File]::ReadAllBytes($args[0])
$ms = [IO.MemoryStream]::new($bytes)
$ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
$dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $eng) { throw 'no OCR language installed' }
$res = Await ($eng.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
$res.Text
"""


def _ocr(image):
    """OCR via Windows.Media.Ocr (inbox on Win10+, nothing to install)."""
    if platform.system() != "Windows":
        raise ValueError("OCR is Windows-only")
    import base64
    import tempfile
    if not image:
        shot = _screenshot()
        image = shot["image"]
    try:
        b64 = image.split(",", 1)[1] if "," in image else image
        raw = base64.b64decode(b64)
    except Exception:
        raise ValueError("bad image data")
    if len(raw) > 8000000:
        raise ValueError("image too large")
    fd, png = tempfile.mkstemp(prefix="vexis-ocr-", suffix=".png")
    fd_ps, ps_path = tempfile.mkstemp(prefix="vexis-ocr-", suffix=".ps1")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        with os.fdopen(fd_ps, "w", encoding="utf-8") as f:
            f.write(_OCR_PS)
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive",
             "-ExecutionPolicy", "Bypass", "-File", ps_path, png],
            capture_output=True, text=True, timeout=90,
            creationflags=0x08000000)
        if r.returncode != 0:
            raise ValueError("OCR failed: " + (r.stderr.strip() or r.stdout.strip())[:200])
        text = r.stdout.strip()
        return {"ok": True, "text": text, "chars": len(text)}
    finally:
        for p in (png, ps_path):
            try:
                os.remove(p)
            except OSError:
                pass


def _screenshot():
    try:
        from PIL import ImageGrab
    except ImportError:
        raise ValueError("screenshots unavailable (PIL missing)")
    import base64
    import io
    img = ImageGrab.grab()
    img.thumbnail((1280, 1280))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "PNG")
    data = base64.b64encode(buf.getvalue()).decode()
    return {"ok": True, "image": "data:image/png;base64," + data,
            "size": img.size}


def _verify(target):
    if target == "health":
        try:
            with urllib.request.urlopen(ENGINE + "/api/health", timeout=10) as r:
                return {"ok": True, "health": json.loads(r.read().decode() or "{}")}
        except Exception as e:
            return {"ok": False, "error": str(e)[:300]}
    if target == "config":
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg = jsonc_loads(f.read())
            return {"ok": True, "keys": sorted(cfg.keys()) if isinstance(cfg, dict) else []}
        except Exception as e:
            return {"ok": False, "error": str(e)[:300]}
    if target == "tests":
        import sys as _sys
        try:
            r = subprocess.run(
                [_sys.executable, "-m", "pytest", "tests/test_backend.py",
                 "tests/test_frontend.py", "-q"],
                cwd=ROOT, capture_output=True, text=True, timeout=180,
                **_hide())
            tail = (r.stdout + r.stderr)[-8000:]
            return {"ok": r.returncode == 0, "rc": r.returncode, "output": tail}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "tests timed out"}
        except Exception as e:
            return {"ok": False, "error": str(e)[:300]}
    raise ValueError("unknown target (tests|health|config)")


def _desktop(op):
    """minimal mouse/keyboard via ctypes (Windows only, no dependencies).
    Validated strictly; this endpoint exists for future agent use."""
    if platform.system() != "Windows":
        raise ValueError("desktop control is Windows-only")
    import ctypes
    name = str(op.get("op") or "")
    try:
        user32 = ctypes.windll.user32
    except Exception:
        raise ValueError("desktop control unavailable")
    if name == "move":
        x, y = int(op.get("x", -1)), int(op.get("y", -1))
        if not (0 <= x <= 10000 and 0 <= y <= 10000):
            raise ValueError("x/y out of range")
        if not user32.SetCursorPos(x, y):
            raise ValueError("move failed")
        return {"ok": True}
    if name == "click":
        x, y = int(op.get("x", -1)), int(op.get("y", -1))
        if not (0 <= x <= 10000 and 0 <= y <= 10000):
            raise ValueError("x/y out of range")
        btn = str(op.get("button") or "left").lower()
        if btn not in ("left", "right", "middle"):
            raise ValueError("bad button")
        downs = {"left": 0x0002, "right": 0x0008, "middle": 0x0020}
        ups = {"left": 0x0004, "right": 0x0010, "middle": 0x0040}
        user32.SetCursorPos(x, y)
        user32.mouse_event(downs[btn], 0, 0, 0, 0)
        user32.mouse_event(ups[btn], 0, 0, 0, 0)
        return {"ok": True}
    if name == "type":
        text = str(op.get("text") or "")
        if not text or len(text) > 500:
            raise ValueError("text required (<=500 chars)")
        for ch in text:
            vk = user32.VkKeyScanW(ord(ch))
            if vk == -1:
                continue
            user32.keybd_event(vk & 0xFF, 0, 0, 0)
            user32.keybd_event(vk & 0xFF, 0, 2, 0)
        return {"ok": True, "typed": len(text)}
    if name == "key":
        allow = {"enter": 0x0D, "tab": 0x09, "esc": 0x1B, "space": 0x20,
                 "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
                 "backspace": 0x08, "delete": 0x2E}
        vk = allow.get(str(op.get("key") or "").lower())
        if not vk:
            raise ValueError("key not allowed")
        user32.keybd_event(vk, 0, 0, 0)
        user32.keybd_event(vk, 0, 2, 0)
        return {"ok": True}
    raise ValueError("unknown op (move|click|type|key)")

MIMES = {
    ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
    ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
    ".ttf": "font/ttf", ".png": "image/png", ".ico": "image/x-icon",
    ".json": "application/json", ".map": "application/json",
}

API_FIRST = {
    "api", "agent", "auth", "command", "config", "event", "experimental",
    "session", "project", "instance", "signal", "doc", "pty", "permission",
    "question", "location", "model", "provider", "skill", "reference", "fs",
    "integration", "credential", "file", "find", "lsp", "mcp", "path",
    "vcs", "global",
}

HOP = {"host", "connection", "keep-alive", "transfer-encoding", "upgrade"}


def jsonc_loads(text):
    """Parse JSONC: strips // and /* */ comments and trailing commas outside strings.

    Two passes on purpose: a comment can sit between a trailing comma and its
    closer (`, /* x */ }`), so comments must be removed before the comma pass.
    """
    if text.startswith("\ufeff"):
        text = text[1:]
    return json.loads(_strip_trailing_commas(_strip_comments(text)))


def _strip_comments(text):
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] not in "\r\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _strip_trailing_commas(text):
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == ",":
            j = i + 1
            while j < n and text[j] in " \t\r\n":
                j += 1
            if j < n and text[j] in "}]":
                i += 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


def _safe_file(p):
    """Path must live inside the vexis folder or the opencode config dir (text types only)."""
    if not p:
        raise ValueError("path required")
    ap = os.path.abspath(p)
    home = os.path.expanduser("~")
    roots = [VEXIS_DIR, os.path.join(home, ".config", "opencode")]
    ok = False
    for r in roots:
        rl = os.path.abspath(r).lower()
        if ap.lower() == rl or ap.lower().startswith(rl + os.sep):
            ok = True
            break
    if not ok:
        raise ValueError("path not allowed")
    if not ap.lower().endswith((".md", ".txt", ".json", ".jsonc")):
        raise ValueError("file type not allowed")
    return ap


def file_info(path):
    try:
        st = os.stat(path)
        return {
            "path": path, "exists": True, "size": st.st_size,
            "mtime": datetime.datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
        }
    except OSError:
        return {"path": path, "exists": False}


class H(http.server.BaseHTTPRequestHandler):
    server_version = "VexisUI/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if self.path.split("?")[0] in ("/api/health",):
            return
        print(f"[vexis-ui] {self.command} {self.path[:110]}")

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def _local(self, rel):
        p = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")))
        root = os.path.abspath(ROOT)
        # normcase + trailing sep: block sibling-folder escapes like
        # ROOT_sibling\... which a bare startswith(ROOT) would allow
        if not (os.path.normcase(p).startswith(os.path.normcase(root) + os.sep)
                and os.path.isfile(p)):
            return False
        ext = os.path.splitext(p)[1].lower()
        with open(p, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIMES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        return True

    def _proxy(self):
        url = ENGINE + self.path
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            length = 0
        if length > MAX_BODY:
            self._json_out({"error": f"request body too large ({length} > {MAX_BODY})"}, 413)
            return
        body = self.rfile.read(length) if length > 0 else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            up = urllib.request.urlopen(req, timeout=300)
            code, rheaders, stream = up.status, up.headers, up
        except urllib.error.HTTPError as e:
            code, rheaders, stream = e.code, e.headers, e
        except Exception as e:  # engine down / connection reset -> clean 502
            try:
                self._json_out({"error": "engine unreachable: " + str(e)[:180],
                                "hint": "Vexis is restarting the runtime engine"}, 502)
            except Exception:
                pass
            return
        self.send_response(code)
        for k, v in (rheaders.items() if rheaders else []):
            kl = k.lower()
            if kl in HOP or kl in ("content-security-policy", "content-length",
                                   "transfer-encoding", "connection", "keep-alive"):
                continue
            self.send_header(k, v)
        # NOTE: 1xx/204/304 must not carry Transfer-Encoding or a body
        no_body = (100 <= code < 200) or code in (204, 304)
        if not no_body:
            self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command == "HEAD" or no_body:
            stream.close()
            return
        # read1() returns as soon as ANY bytes arrive - plain read(65536)
        # would block until the buffer fills, which stalls SSE (/event)
        # until 64KB of events accumulate.
        reader = getattr(stream, "read1", None) or stream.read
        while True:
            chunk = reader(65536)
            if not chunk:
                break
            try:
                self.wfile.write(f"{len(chunk):X}\r\n".encode() + chunk + b"\r\n")
                self.wfile.flush()
            except (ConnectionResetError, BrokenPipeError):
                break
        try:
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (ConnectionResetError, BrokenPipeError):
            pass
        stream.close()

    def _json_out(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _sse_chunk(self, text):
        """Write one chunked frame. The event stream uses Transfer-Encoding:
        chunked so the connection stays open under HTTP/1.1."""
        data = text.encode("utf-8")
        self.wfile.write(("%X\r\n" % len(data)).encode("ascii") + data + b"\r\n")
        self.wfile.flush()

    def _events_stream(self):
        """SSE feed the UI subscribes to for panel pushes (artifacts)."""
        q = queue.Queue(maxsize=64)
        with ART_SUBS_LOCK:
            ART_SUBS.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            self._sse_chunk(": connected\n\n")
            while True:
                try:
                    ev = q.get(timeout=15)
                    self._sse_chunk("data: " + json.dumps(ev, ensure_ascii=False) + "\n\n")
                except queue.Empty:
                    self._sse_chunk(": ping\n\n")
        except (ConnectionResetError, BrokenPipeError, OSError, ValueError):
            pass
        finally:
            with ART_SUBS_LOCK:
                try:
                    ART_SUBS.remove(q)
                except ValueError:
                    pass
            try:
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
            except Exception:
                pass

    def _drain_body(self):
        """Consume a request body we are not going to read.

        HTTP/1.1 keep-alive: a handler that answers without reading the body
        (403/405/...) leaves those bytes in the socket, where the next request
        on the same connection parses them as a request line. Read and drop
        them, or tell the server to close the connection if they are huge.
        """
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            return
        if length > MAX_BODY:
            self.close_connection = True
            return
        try:
            self.rfile.read(length)
        except Exception:
            self.close_connection = True

    def _body_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            length = 0
        if length > MAX_BODY:
            raise ValueError(f"request body too large ({length} > {MAX_BODY})")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("body is not valid utf-8")
        try:
            return json.loads(text or "{}")
        except ValueError:
            raise ValueError("body is not valid JSON")

    def _read_auth(self):
        if not os.path.isfile(AUTH_PATH):
            return {}
        with open(AUTH_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}

    def _write_auth(self, auth):
        os.makedirs(os.path.dirname(AUTH_PATH), exist_ok=True)
        tmp = AUTH_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8", newline="\n") as f:
            json.dump(auth, f, ensure_ascii=False, indent=2)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, AUTH_PATH)

    def _vexis(self):
        """Local settings endpoints: engine config file, auth keys, info."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/vexis/bootstrap" and self.command == "GET":
                # same-origin readable only (no CORS headers): hands the UI
                # its per-install CSRF secret for state-changing /vexis/* calls
                self._json_out({"secret": APP_SECRET, "app": APP_VERSION})
                return
            if self.command in ("POST", "PUT", "PATCH", "DELETE"):
                if self.headers.get("X-Vexis-Secret") != APP_SECRET:
                    self._drain_body()
                    self._json_out({"error": "forbidden (bad local secret)"}, 403)
                    return
            if path == "/vexis/config":
                if self.command == "GET":
                    content = ""
                    if os.path.isfile(CONFIG_PATH):
                        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                            content = f.read()
                    self._json_out({"path": CONFIG_PATH, "exists": os.path.isfile(CONFIG_PATH),
                                    "content": content})
                elif self.command == "POST":
                    body = self._body_json()
                    content = body.get("content")
                    if not isinstance(content, str):
                        raise ValueError("content (string) required")
                    jsonc_loads(content)  # validate before touching disk
                    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
                    with open(CONFIG_PATH, "w", encoding="utf-8", newline="\n") as f:
                        f.write(content)
                    self._json_out({"ok": True, "path": CONFIG_PATH})
                else:
                    self._json_out({"error": "method not allowed"}, 405)
                return

            if path == "/vexis/toast" and self.command == "POST":
                body = self._body_json()
                title = str(body.get("title") or "Vexis")[:80]
                message = str(body.get("message") or "")[:240]
                script = os.path.join(ROOT, "toast.ps1")
                if os.path.isfile(script):
                    try:
                        subprocess.Popen(
                            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                             "-WindowStyle", "Hidden", "-File", script, title, message],
                            creationflags=0x08000000,  # CREATE_NO_WINDOW
                        )
                    except Exception as exc:
                        self._json_out({"ok": False, "error": str(exc)})
                        return
                self._json_out({"ok": True})
                return

            if path == "/vexis/auth":
                if self.command == "GET":
                    entries = []
                    for prov, val in self._read_auth().items():
                        key = str(val.get("key") or "") if isinstance(val, dict) else ""
                        masked = (key[:4] + "\u2026") if len(key) > 4 else ("****" if key else "")
                        entries.append({
                            "provider": prov,
                            "type": str(val.get("type") or "") if isinstance(val, dict) else "",
                            "masked": masked,
                            "chars": len(key),
                        })
                    self._json_out({"path": AUTH_PATH, "entries": entries})
                elif self.command == "POST":
                    body = self._body_json()
                    prov = str(body.get("provider") or "").strip()
                    key = str(body.get("key") or "").strip()
                    if not prov or not key:
                        raise ValueError("provider + key required")
                    auth = self._read_auth()
                    entry = auth.get(prov)
                    if not isinstance(entry, dict):
                        entry = {}
                    entry["type"] = entry.get("type") or "api"
                    entry["key"] = key
                    auth[prov] = entry
                    self._write_auth(auth)
                    self._json_out({"ok": True, "provider": prov})
                elif self.command == "DELETE":
                    qs = urllib.parse.parse_qs(parsed.query)
                    prov = (qs.get("provider") or [""])[0].strip()
                    if not prov:
                        raise ValueError("provider required")
                    auth = self._read_auth()
                    auth.pop(prov, None)
                    self._write_auth(auth)
                    self._json_out({"ok": True, "provider": prov})
                else:
                    self._json_out({"error": "method not allowed"}, 405)
                return

            if path == "/vexis/update" and self.command == "GET":
                if updater:
                    self._json_out(updater.status())
                else:
                    self._json_out({"state": "unavailable"})
                return

            if path == "/vexis/update/now" and self.command == "POST":
                started = bool(updater and updater.trigger())
                self._json_out({"ok": started, "state": updater.status() if updater else "unavailable"})
                return

            if path == "/vexis/info" and self.command == "GET":
                health = {"healthy": False}
                ms = -1
                t0 = datetime.datetime.now()
                try:
                    up = urllib.request.urlopen(ENGINE + "/api/health", timeout=3)
                    health = json.loads(up.read().decode("utf-8") or "{}")
                    ms = int((datetime.datetime.now() - t0).total_seconds() * 1000)
                except Exception:
                    pass
                auth_info = file_info(AUTH_PATH)
                try:
                    auth_info["count"] = len(self._read_auth())
                except Exception:
                    auth_info["count"] = 0
                self._json_out({
                    "root": ROOT,
                    "app": APP_VERSION,
                    "python": platform.python_version(),
                    "ui_port": PORT,
                    "engine": ENGINE,
                    "engine_ok": bool(health.get("healthy")),
                    "engine_ms": ms,
                    "config": file_info(CONFIG_PATH),
                    "auth": auth_info,
                    "runtime": file_info(RUNTIME_EXE),
                })
                return

            if path == "/vexis/memory":
                os.makedirs(MEMORY_DIR, exist_ok=True)
                if self.command == "GET":
                    qs = urllib.parse.parse_qs(parsed.query)
                    name = (qs.get("name") or [""])[0]
                    if name:
                        safe = os.path.basename(name)
                        fp = os.path.join(MEMORY_DIR, safe)
                        if not os.path.isfile(fp):
                            raise ValueError("not found")
                        with open(fp, "r", encoding="utf-8", errors="replace") as f:
                            self._json_out({"name": safe, "content": f.read()})
                        return
                    files = []
                    for fn in sorted(os.listdir(MEMORY_DIR)):
                        fp = os.path.join(MEMORY_DIR, fn)
                        if not os.path.isfile(fp) or not fn.lower().endswith((".md", ".txt")):
                            continue
                        with open(fp, "r", encoding="utf-8", errors="replace") as f:
                            c = f.read()
                        files.append({"name": fn, "size": os.path.getsize(fp), "content": c[:20000]})
                    home = os.path.expanduser("~")
                    cands = [
                        ("project AGENTS.md", os.path.join(VEXIS_DIR, "workspace", "AGENTS.md")),
                        ("global AGENTS.md", os.path.join(home, ".config", "opencode", "AGENTS.md")),
                        ("global AGENTS.local.md", os.path.join(home, ".config", "opencode", "AGENTS.local.md")),
                    ]
                    agents = [{"label": lbl + " \u2014 " + p, "path": p}
                              for lbl, p in cands if os.path.isfile(p)]
                    if not agents:
                        agents = [{"label": cands[0][0] + " (create)", "path": cands[0][1]}]
                    self._json_out({"files": files, "agents": agents, "dir": MEMORY_DIR})
                elif self.command == "POST":
                    body = self._body_json()
                    name = os.path.basename(str(body.get("name") or "")).strip()
                    if not name:
                        raise ValueError("name required")
                    if not name.lower().endswith((".md", ".txt")):
                        raise ValueError("only .md / .txt files allowed")
                    with open(os.path.join(MEMORY_DIR, name), "w",
                              encoding="utf-8", newline="\n") as f:
                        f.write(str(body.get("content") or ""))
                    self._json_out({"ok": True, "name": name})
                elif self.command == "DELETE":
                    qs = urllib.parse.parse_qs(parsed.query)
                    name = os.path.basename((qs.get("name") or [""])[0])
                    fp = os.path.join(MEMORY_DIR, name)
                    if os.path.isfile(fp):
                        os.remove(fp)
                    self._json_out({"ok": True, "name": name})
                else:
                    self._json_out({"error": "method not allowed"}, 405)
                return

            if path == "/vexis/file":
                if self.command == "GET":
                    qs = urllib.parse.parse_qs(parsed.query)
                    fp = _safe_file((qs.get("path") or [""])[0])
                    content = ""
                    if os.path.isfile(fp):
                        with open(fp, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read(400000)
                    self._json_out({"path": fp, "content": content})
                elif self.command == "POST":
                    body = self._body_json()
                    fp = _safe_file(str(body.get("path") or ""))
                    os.makedirs(os.path.dirname(fp), exist_ok=True)
                    with open(fp, "w", encoding="utf-8", newline="\n") as f:
                        f.write(str(body.get("content") or ""))
                    self._json_out({"ok": True, "path": fp})
                else:
                    self._json_out({"error": "method not allowed"}, 405)
                return

            if path == "/vexis/files":
                if self.command != "GET":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                qs = urllib.parse.parse_qs(parsed.query)
                rel = (qs.get("path") or [""])[0]
                base = os.path.realpath(VEXIS_DIR)
                target = os.path.realpath(os.path.join(base, rel.lstrip("/\\")))
                if target != base and not target.startswith(base + os.sep):
                    raise ValueError("path not allowed")
                if not os.path.isdir(target):
                    raise ValueError("not a directory")
                entries = []
                for fn in sorted(os.listdir(target)):
                    fp = os.path.join(target, fn)
                    try:
                        isdir = os.path.isdir(fp)
                        entries.append({
                            "name": fn, "dir": isdir,
                            "hidden": fn.startswith("."),
                            "size": 0 if isdir else os.path.getsize(fp),
                            "mtime": datetime.datetime.fromtimestamp(
                                os.path.getmtime(fp)).isoformat(timespec="seconds"),
                        })
                    except OSError:
                        continue
                    if len(entries) >= 500:
                        break
                self._json_out({"path": target,
                                "rel": os.path.relpath(target, base),
                                "entries": entries})
                return

            if path == "/vexis/git":
                if self.command != "GET":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                ws = os.path.join(VEXIS_DIR, "workspace")
                git = shutil.which("git")
                if not git or not os.path.isdir(os.path.join(ws, ".git")):
                    self._json_out({"available": False, "dir": ws})
                    return
                def run(args):
                    # -c safe.directory: the workspace may have been copied from
                    # another Windows account, which trips git's "dubious
                    # ownership" guard and blanks branch/status/log entirely.
                    r = subprocess.run([git, "-c", "safe.directory=" + ws] + args,
                                       cwd=ws, capture_output=True,
                                       text=True, timeout=15, **_hide())
                    return r.stdout.strip() if r.returncode == 0 else ""
                branch = run(["branch", "--show-current"]) or run(
                    ["rev-parse", "--short", "HEAD"])
                files = []
                for line in run(["status", "--porcelain=v1"]).splitlines()[:100]:
                    line = line.rstrip()
                    if len(line) > 3:
                        files.append({"st": line[:2].strip(), "path": line[3:]})
                log = []
                for line in run(["log", "--oneline", "-12"]).splitlines():
                    if line.strip():
                        log.append(line.strip())
                self._json_out({"available": True, "dir": ws, "branch": branch,
                                "files": files, "log": log})
                return

            if path == "/vexis/open":
                # open a URL in the system browser (Browser tab "open outside").
                # http(s) only: never hand file:// or app schemes to the OS.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                body = self._body_json()
                url = str(body.get("url") or "").strip()
                if len(url) > 2000 or not url.lower().startswith(("http://", "https://")):
                    raise ValueError("only http(s) URLs allowed")
                import webbrowser
                webbrowser.open(url)
                self._json_out({"ok": True})
                return

            if path == "/vexis/term":
                # persistent shell per terminal (powershell stdin/stdout).
                # POST {} -> {id}; POST {id, cmd, timeout?} runs until a
                # sentinel echo or timeout; POST {id, kill:true} destroys it.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                body = self._body_json()
                self._json_out(_term_handle(body))
                return

            if path == "/vexis/shot":
                # screenshot -> PNG data URL (PIL). Powershell fallback n/a:
                # PIL is installed; multi-monitor grab, downscaled to <=1280w.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                self._json_out(_screenshot())
                return

            if path == "/vexis/ocr":
                # text-from-image via the built-in Windows OCR engine
                # (Windows.Media.Ocr, no downloads). Accepts {"image": dataURL}
                # or screenshots when omitted.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                body = self._body_json()
                self._json_out(_ocr(str(body.get("image") or "")))
                return

            if path == "/vexis/verify":
                # hardcoded diagnostics only - never runs caller-supplied commands.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                body = self._body_json()
                self._json_out(_verify(str(body.get("target") or "")))
                return

            if path == "/vexis/desktop":
                # minimal desktop control for future agent use (ctypes, no deps).
                # op: move/click/type/key. Validated before touching the OS.
                if self.command != "POST":
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                body = self._body_json()
                self._json_out(_desktop(dict(body)))
                return

            if path == "/vexis/artifacts" and self.command == "GET":
                # newest first, so a reloaded UI can restore the panel
                with ART_LOCK:
                    items = list(ARTIFACTS)
                items.reverse()
                self._json_out({"artifacts": items})
                return

            if path == "/vexis/artifact" and self.command == "POST":
                # the panel bridge: the vexis_show tool posts here
                body = self._body_json()
                art = _artifact_add(path=body.get("path"), url=body.get("url"),
                                    title=str(body.get("title") or ""))
                self._json_out({"ok": True, "artifact": art})
                return

            if path == "/vexis/events" and self.command == "GET":
                self._events_stream()
                return

            if path == "/vexis/raw":
                # serve one file to the Browser panel (iframe src)
                if self.command not in ("GET", "HEAD"):
                    self._json_out({"error": "method not allowed"}, 405)
                    return
                qs = urllib.parse.parse_qs(parsed.query)
                fp = _artifact_file((qs.get("path") or [""])[0])
                if os.path.getsize(fp) > ART_RAW_MAX:
                    raise ValueError("file too large to preview")
                with open(fp, "rb") as f:
                    data = f.read()
                ext = os.path.splitext(fp)[1].lower()
                self.send_response(200)
                self.send_header("Content-Type", RAW_MIMES.get(ext, "application/octet-stream"))
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-cache")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(data)
                return

            self._json_out({"error": "not found"}, 404)
        except ValueError as e:
            self._json_out({"error": str(e)}, 400)
        except Exception as e:
            self._json_out({"error": str(e)}, 500)

    def _route(self):
        raw = self.path.split("?", 1)[0]
        if raw == "/" or raw.lower() == "/index.html":
            self._local("/index.html")
            return
        if raw.startswith("/vexis/"):
            self._vexis()
            return
        if self._local(raw):
            return
        first = raw.strip("/").split("/", 1)[0]
        accept = self.headers.get("Accept", "")
        if first in API_FIRST or "text/html" not in accept:
            self._proxy()
            return
        self._local("/index.html")

    do_GET = _route
    do_HEAD = _route

    def do_POST(self):
        self._route()

    def do_PUT(self):
        self._route()

    def do_PATCH(self):
        self._route()

    def do_DELETE(self):
        self._route()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.end_headers()


def _engine_alive():
    try:
        urllib.request.urlopen(ENGINE + "/api/health", timeout=3).read()
        return True
    except Exception:
        return False


def _rotate_log(path, max_bytes=5 * 1024 * 1024):
    try:
        if os.path.isfile(path) and os.path.getsize(path) > max_bytes:
            bak = path + ".1"
            try:
                if os.path.isfile(bak):
                    os.remove(bak)
            except OSError:
                pass
            os.replace(path, bak)
    except OSError:
        pass


def _engine_pidfile():
    return os.path.join(CONFIG_DIR, f"engine-{ENGINE_PORT}.pid")


def _pid_alive(pid):
    """cross-platform existence check (os.kill(pid, 0) is POSIX-only;
    on Windows it raises WinError 87 even for live processes)."""
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        pass  # Windows -> verify via tasklist below
    except Exception:
        return False
    try:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                             capture_output=True, text=True, timeout=10,
                             **_hide()).stdout
        for line in out.splitlines():
            cells = [c.strip().strip('"') for c in line.split(",")]
            if len(cells) >= 2 and cells[1] == str(pid):
                return True
        return False
    except Exception:
        return False


def _engine_spawn_alive():
    try:
        with open(_engine_pidfile(), encoding="utf-8") as f:
            pid = int(f.read().strip())
    except (OSError, ValueError):
        return None
    if not _pid_alive(pid):
        return None
    # PID numbers get recycled: only defer if it is really our engine
    try:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                             capture_output=True, text=True, timeout=10,
                             **_hide()).stdout
        cells = [c.strip().strip('"') for c in out.strip().split(",")]
        if not cells or cells[0].lower() != "vexis-runtime.exe":
            return None
    except Exception:
        return None
    return pid


def _start_engine():
    ws = os.path.join(VEXIS_DIR, "workspace")
    log = os.path.join(CONFIG_DIR, "engine.log")
    os.makedirs(CONFIG_DIR, exist_ok=True)
    _rotate_log(log)
    if not os.path.isfile(RUNTIME_EXE):
        print(f"[vexis-ui] engine start failed: missing {RUNTIME_EXE}", flush=True)
        return False
    alive = _engine_spawn_alive()
    if alive:
        print(f"[vexis-ui] engine start already in progress (pid {alive}), skipping", flush=True)
        return True
    try:
        out = open(log, "ab", buffering=0)
        proc = subprocess.Popen(
            [RUNTIME_EXE, "serve", "--port", str(ENGINE_PORT), "--hostname", "127.0.0.1"],
            cwd=ws if os.path.isdir(ws) else ROOT,
            env=ENGINE_ENV, stdout=out, stderr=out,
            creationflags=0x08000000,  # CREATE_NO_WINDOW - no taskbar entry
        )
        try:
            with open(_engine_pidfile(), "w", encoding="utf-8") as f:
                f.write(str(proc.pid))
        except OSError:
            pass
        print(f"[vexis-ui] engine started (hidden) :{ENGINE_PORT} pid {proc.pid}", flush=True)
        return True
    except Exception as e:
        print(f"[vexis-ui] engine start failed: {e}", flush=True)
        return False


def _warmup():
    """run one invisible turn so plugin/catalog loading happens NOW, not on the
    user's first message (this was the 40-65s 'thinking' delay)."""
    try:
        d = urllib.parse.quote(os.path.join(VEXIS_DIR, "workspace"))

        def jreq(method, path, body=None):
            data = json.dumps(body).encode() if body is not None else None
            r = urllib.request.Request(ENGINE + path, data=data, method=method,
                                       headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(r, timeout=30) as resp:
                s = resp.read().decode("utf-8", "replace")
                return json.loads(s) if s.strip() else None

        ses = jreq("POST", "/session?directory=" + d, {"title": "warmup"})
        sid = (ses or {}).get("id")
        if not sid:
            return
        jreq("POST", "/session/" + sid + "/prompt_async?directory=" + d,
             {"parts": [{"type": "text", "text": "ping"}]})
        for _ in range(150):
            time.sleep(1)
            try:
                ms = jreq("GET", "/session/" + sid + "/message?directory=" + d + "&limit=5")
            except Exception:
                continue
            arr = ms if isinstance(ms, list) else ((ms or {}).get("data") or [])
            if not arr:
                continue
            last = arr[-1]
            info = last.get("info") or {}
            if info.get("role") == "assistant" and (info.get("time") or {}).get("completed"):
                break
        try:
            jreq("DELETE", "/session/" + sid + "?directory=" + d)
        except Exception:
            pass
        print("[vexis-ui] engine warmed up", flush=True)
    except Exception as e:
        print(f"[vexis-ui] warmup: {e}", flush=True)


_starting = threading.Lock()


def _engine_watch():
    """health watchdog + cold-start warmup (re-warms after every restart)."""
    warmed = False
    while True:
        time.sleep(10)
        if not _engine_alive():
            warmed = False
            if _starting.locked():
                continue
            with _starting:
                print("[vexis-ui] engine down - restarting", flush=True)
                _start_engine()
                for _ in range(30):
                    time.sleep(2)
                    if _engine_alive():
                        break
        if _engine_alive() and not warmed:
            warmed = True
            _warmup()


def run():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.request_queue_size = 256

    class Server(socketserver.ThreadingTCPServer):
        daemon_threads = True

    if updater:
        try:
            updater.startup()
        except Exception as e:
            print(f"[vexis-ui] updater start failed: {e}", flush=True)

    threading.Thread(target=_engine_watch, daemon=True).start()

    try:
        srv = Server(("127.0.0.1", PORT), H)
    except OSError as e:
        print(f"[vexis-ui] port {PORT} busy ({e}); kill the stale UI server or set VEXIS_UI_PORT", flush=True)
        raise SystemExit(1)
    with srv:
        print(f"[vexis-ui] Vexis UI on http://127.0.0.1:{PORT}/  (engine {ENGINE})", flush=True)
        srv.serve_forever()


if __name__ == "__main__":
    run()
