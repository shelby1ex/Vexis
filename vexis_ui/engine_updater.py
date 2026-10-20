"""engine_updater.py - keep .runtime\\vexis-runtime.exe on the latest opencode release.

Runs in a background thread when the UI server starts (or on demand via
POST /vexis/update/now). Flow: check the GitHub latest release -> if newer than
the installed engine, download the windows-x64 zip into .runtime\\staging\\
(hidden folder), verify the extracted binary actually runs, then swap it in as
vexis-runtime.exe. The swap uses the Windows rename-while-running trick: the
running engine keeps its old image and the new version takes effect on the next
engine start. The previous binary is kept as vexis-runtime.prev.exe and a
rollback runs automatically if the new engine fails its health check.

.env controls:
  VEXIS_AUTO_UPDATE=1|0    default 1 (check + download + swap)
  VEXIS_ENGINE_PIN=x.y.z   never auto-update past this version
Test overrides: VEXIS_ENGINE_DIR, VEXIS_UPDATE_API, VEXIS_ENGINE_HEALTH.
"""
import datetime
import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.environ.get("VEXIS_ENGINE_DIR") or os.path.normpath(os.path.join(HERE, "..", ".runtime"))
ENGINE_EXE = os.path.join(ENGINE_DIR, "vexis-runtime.exe")
PREV_EXE = os.path.join(ENGINE_DIR, "vexis-runtime.prev.exe")
FAILED_EXE = os.path.join(ENGINE_DIR, "vexis-runtime.failed.exe")
STAGING_DIR = os.path.join(ENGINE_DIR, "staging")
STATE_PATH = os.path.join(ENGINE_DIR, "update-state.json")
ENV_PATH = os.environ.get("VEXIS_ENV_FILE") or os.path.normpath(os.path.join(HERE, "..", ".env"))
RELEASE_API = os.environ.get("VEXIS_UPDATE_API") or "https://api.github.com/repos/anomalyco/opencode/releases/latest"


def _hide():
    """subprocess kwargs so helper tools never flash a console window."""
    if os.name == "nt":
        return {"creationflags": 0x08000000}
    return {}


def _health_url():
    if os.environ.get("VEXIS_ENGINE_HEALTH"):
        return os.environ["VEXIS_ENGINE_HEALTH"]
    try:
        port = int(os.environ.get("OPENCODE_PORT", "4001"))
    except (TypeError, ValueError):
        port = 4001
    return f"http://127.0.0.1:{port}/api/health"


def _health_port():
    m = re.search(r":(\d+)(?:/|$)", _health_url())
    try:
        return int(m.group(1)) if m else 4001
    except (TypeError, ValueError):
        return 4001


HEALTH_URL = _health_url()
HEALTH_PORT = _health_port()
UA = {"User-Agent": "vexis-updater", "Accept": "application/json"}

_lock = threading.Lock()
_busy = False
_status = {
    "state": "idle",
    "current": None,
    "latest": None,
    "staged_version": None,
    "message": "",
    "blocked_last": None,
    "bytes_done": 0,
    "bytes_total": 0,
    "at": None,
}


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _set(**kw):
    with _lock:
        _status.update(kw)
        _status["at"] = _now()


def status():
    with _lock:
        return dict(_status)


def read_env():
    out = {}
    try:
        with open(ENV_PATH, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    except OSError:
        pass
    return out


def auto_enabled():
    return read_env().get("VEXIS_AUTO_UPDATE", "1").strip().lower() not in ("0", "false", "no", "off")


def pin():
    return read_env().get("VEXIS_ENGINE_PIN", "").strip()


def parse_version(s):
    if not s:
        return None
    m = re.search(r"v?(\d+(?:\.\d+)+)", str(s))
    if not m:
        return None
    return tuple(int(x) for x in m.group(1).split("."))


def cmp_versions(a, b):
    la, lb = len(a), len(b)
    for i in range(max(la, lb)):
        va = a[i] if i < la else 0
        vb = b[i] if i < lb else 0
        if va != vb:
            return 1 if va > vb else -1
    return 0


def current_version():
    if not os.path.isfile(ENGINE_EXE):
        return None
    try:
        r = subprocess.run([ENGINE_EXE, "--version"], capture_output=True, text=True, timeout=15,
                           **_hide())
        return parse_version((r.stdout or "") + (r.stderr or ""))
    except Exception:
        return None


def latest_release():
    req = urllib.request.Request(RELEASE_API, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    tag = str(data.get("tag_name") or "")
    ver = parse_version(tag)
    if not ver:
        raise ValueError("no version in release tag: " + tag)
    assets = data.get("assets") or []
    url = None
    for a in assets:
        if a.get("name") == "opencode-windows-x64.zip":
            url = a.get("browser_download_url")
            break
    if not url:
        for a in assets:
            n = str(a.get("name") or "")
            if "windows-x64" in n and "desktop" not in n and n.endswith(".zip"):
                url = a.get("browser_download_url")
                break
    if not url:
        raise ValueError("no windows-x64 zip asset in release " + tag)
    return {"tag": tag, "version": ver, "url": url}


def _download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "vexis-updater"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        total = int(resp.headers.get("Content-Length") or 0)
        _set(state="downloading", bytes_total=total, bytes_done=0)
        done = 0
        with open(dest, "wb") as f:
            while True:
                chunk = resp.read(1 << 16)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                _set(bytes_done=done)


def _extract_exe(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".exe") and not n.endswith("/")]
        if not names:
            raise ValueError("no .exe inside downloaded zip")
        pick = None
        for n in names:
            if os.path.basename(n).lower() == "opencode.exe":
                pick = n
                break
        if not pick:
            pick = names[0]
        target = os.path.join(STAGING_DIR, "vexis-runtime.exe")
        if os.path.exists(target):
            os.remove(target)
        with zf.open(pick) as src, open(target, "wb") as dst:
            shutil.copyfileobj(src, dst)
        return target


def verify_exe(path):
    try:
        r = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=20,
                           **_hide())
        if r.returncode != 0:
            return None
        return parse_version((r.stdout or "") + (r.stderr or ""))
    except Exception:
        return None


def _cleanup(*paths):
    for p in paths:
        try:
            if os.path.exists(p):
                os.remove(p)
        except OSError:
            pass


def _swap(staged):
    _set(state="swapping")
    if os.path.isfile(PREV_EXE):
        _cleanup(PREV_EXE)
    renamed = False
    if os.path.isfile(ENGINE_EXE):
        os.rename(ENGINE_EXE, PREV_EXE)
        renamed = True
    try:
        shutil.move(staged, ENGINE_EXE)
    except Exception:
        if renamed and os.path.isfile(PREV_EXE) and not os.path.isfile(ENGINE_EXE):
            os.rename(PREV_EXE, ENGINE_EXE)
        raise


def _load_state():
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_state(**kw):
    data = _load_state()
    data.update(kw)
    try:
        with open(STATE_PATH, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def _health_ok():
    try:
        with urllib.request.urlopen(_health_url(), timeout=3) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}").get("healthy") is True
    except Exception:
        return False


def _tcp_open():
    try:
        s = socket.create_connection(("127.0.0.1", _health_port()), timeout=1)
        s.close()
        return True
    except OSError:
        return False


def _rollback(reason):
    state = _load_state()
    blocked = list(state.get("blocked") or [])
    applied = state.get("applied_version")
    try:
        if os.path.isfile(ENGINE_EXE):
            _cleanup(FAILED_EXE)
            os.rename(ENGINE_EXE, FAILED_EXE)
        if not os.path.isfile(PREV_EXE):
            raise ValueError("no previous engine to restore")
        os.rename(PREV_EXE, ENGINE_EXE)
    except Exception as e:
        _set(state="error", message="rollback failed: " + str(e))
        return False
    if applied and str(applied) not in blocked:
        blocked.append(str(applied))
    _save_state(pending=False, rolled_back=applied, blocked=blocked)
    _cleanup(FAILED_EXE)
    _set(state="rolled_back", message=reason, blocked_last=str(applied) if applied else None)
    return True


def verify_pending():
    state = _load_state()
    if not state.get("pending"):
        return
    for _ in range(15):
        if _health_ok():
            _save_state(pending=False, confirmed=state.get("applied_version"))
            return
        time.sleep(1)
    if _tcp_open():
        _rollback("new engine failed its health check")
    else:
        _set(message="engine not running; pending update verified on next start")


def run_check():
    global _busy
    with _lock:
        if _busy:
            return False
        _busy = True
    try:
        if not auto_enabled():
            _set(state="disabled", message="VEXIS_AUTO_UPDATE=0")
            return True
        _set(state="checking", message="", bytes_done=0, bytes_total=0, blocked_last=None)
        cur = current_version()
        _set(current=".".join(str(x) for x in cur) if cur else None)
        rel = latest_release()
        _set(latest=".".join(str(x) for x in rel["version"]))
        state = _load_state()
        blocked = [str(b) for b in (state.get("blocked") or [])]
        if ".".join(str(x) for x in rel["version"]) in blocked:
            _set(state="blocked", message="version blocked after rollback; clear update-state.json to retry")
            return True
        effective = rel["version"]
        p = pin()
        pv = parse_version(p)
        if pv and cmp_versions(effective, pv) > 0:
            effective = pv
            _set(latest=p)
        if cur and cmp_versions(cur, effective) >= 0:
            _cleanup(os.path.join(STAGING_DIR, "opencode-update.zip"), os.path.join(STAGING_DIR, "vexis-runtime.exe"))
            _set(state="uptodate", message="")
            return True
        os.makedirs(STAGING_DIR, exist_ok=True)
        staged = os.path.join(STAGING_DIR, "vexis-runtime.exe")
        staged_ver = verify_exe(staged) if os.path.isfile(staged) else None
        if not staged_ver:
            zip_path = os.path.join(STAGING_DIR, "opencode-update.zip")
            _download(rel["url"], zip_path)
            _set(state="verifying")
            staged = _extract_exe(zip_path)
            staged_ver = verify_exe(staged)
            if not staged_ver:
                _cleanup(zip_path, staged)
                raise ValueError("downloaded engine does not run (--version failed)")
            _set(staged_version=".".join(str(x) for x in staged_ver))
        else:
            _set(staged_version=".".join(str(x) for x in staged_ver), message="reusing staged download")
        _swap(staged)
        _cleanup(os.path.join(STAGING_DIR, "opencode-update.zip"))
        _save_state(
            pending=True,
            applied_version=_status["latest"],
            applied_at=_now(),
            last_check=_now(),
        )
        _set(state="applied", message="new engine staged; activates at next engine start",
             current=_status["latest"])
        return True
    except Exception as e:
        _set(state="error", message=str(e)[:300])
        return False
    finally:
        with _lock:
            _busy = False


def trigger():
    global _busy
    with _lock:
        if _busy:
            return False
    t = threading.Thread(target=run_check, daemon=True)
    t.start()
    return True


def startup():
    def flow():
        try:
            verify_pending()
        except Exception as e:
            _set(state="error", message="pending verify failed: " + str(e)[:200])
        try:
            run_check()
        except Exception:
            pass
    threading.Thread(target=flow, daemon=True).start()
