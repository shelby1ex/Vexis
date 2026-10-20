"""Build a clean portable Vexis release folder.

Usage:  python package.py [--out dist]
Never ships: user keys, .env secrets, databases, logs, caches,
the E: clone, staging leftovers.

Layout: dist/vexis-<version>/  (+ dist/vexis-<version>.zip)
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def main():
    out = sys.argv[sys.argv.index("--out") + 1] \
        if "--out" in sys.argv else os.path.join(ROOT, "dist")
    with open(os.path.join(ROOT, "version.json"), encoding="utf-8") as f:
        ver = json.load(f)
    name = f"vexis-{ver['version']}"
    dest = os.path.join(out, name)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)

    def put(rel, dest_rel=None):
        copy(os.path.join(ROOT, rel), os.path.join(dest, dest_rel or rel))

    # launcher + docs + identity
    for f in ("version.json", "README.md", "INSTALL.md", "PRIVACY.md",
              "CHANGELOG.md", ".env.example", "Vexis.iss", "install.bat",
              "build_exe.bat"):
        p = os.path.join(ROOT, f)
        if os.path.isfile(p):
            put(f)
    ui_bat = os.path.join(ROOT, "vexis_ui", "run.bat")
    os.makedirs(os.path.join(dest, "vexis_ui"), exist_ok=True)
    copy(ui_bat, os.path.join(dest, "vexis_ui", "run.bat"))
    exe = os.path.join(ROOT, "vexis_ui", "Vexis.exe")
    if os.path.isfile(exe):
        copy(exe, os.path.join(dest, "vexis_ui", "Vexis.exe"))

    # frontend (no caches, no test leftovers, no logs, no stray bitmaps)
    SKIP_DIRS = {"__pycache__", ".pytest_cache", "node_modules", "vexis_logs",
                 "build", "dist", ".webview2", "uploads"}
    SKIP_FILES = {"New Bitmap image.bmp", "eror ui.bmp"}
    for base, dirs, files in os.walk(os.path.join(ROOT, "vexis_ui")):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        if os.path.basename(base) in SKIP_DIRS:
            continue
        for fn in files:
            if fn.endswith((".pyc", ".pyo", ".log")) or fn in SKIP_FILES:
                continue
            full = os.path.join(base, fn)
            rel = os.path.relpath(full, ROOT)
            if rel == os.path.join("vexis_ui", "run.bat"):
                continue  # already copied above
            put(rel)

    # engine binaries only - the live engine, never the ~180 MB rollback copy
    # (.prev/.failed) or staging leftovers, and no logs.
    rt = os.path.join(ROOT, ".runtime")
    for fn in sorted(os.listdir(rt)):
        low = fn.lower()
        if low.endswith(".exe") and ".prev." not in low and ".failed." not in low:
            put(os.path.join(".runtime", fn))

    # default config: tightened perms, EMPTY keys (never ship user secrets)
    with open(os.path.join(ROOT, "config", "opencode.jsonc"), encoding="utf-8") as f:
        cfg_text = f.read()
    cfg_dir = os.path.join(dest, "config")
    os.makedirs(os.path.join(cfg_dir, "plugins"), exist_ok=True)
    with open(os.path.join(cfg_dir, "opencode.jsonc"), "w", encoding="utf-8") as f:
        f.write(cfg_text)
    with open(os.path.join(cfg_dir, "auth.json"), "w", encoding="utf-8") as f:
        f.write("{}")
    for fn in ("package.json", ".gitignore"):
        p = os.path.join(ROOT, "config", fn)
        if os.path.isfile(p):
            copy(p, os.path.join(cfg_dir, fn))
    plug = os.path.join(ROOT, "config", "plugins")
    if os.path.isdir(plug):
        for fn in os.listdir(plug):
            copy(os.path.join(plug, fn), os.path.join(cfg_dir, "plugins", fn))

    # empty memory + workspace skeleton
    os.makedirs(os.path.join(dest, "memory"), exist_ok=True)
    with open(os.path.join(dest, "memory", ".keep"), "w") as f:
        f.write("")
    os.makedirs(os.path.join(dest, "workspace"), exist_ok=True)

    # engine version record
    exe = os.path.join(dest, ".runtime", "vexis-runtime.exe")
    try:
        r = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=20)
        engine_ver = (r.stdout or r.stderr or "").strip().splitlines()[0][:40]
    except Exception:
        engine_ver = ver.get("engine", "?")

    # checksums
    sums = []
    for base, dirs, files in os.walk(dest):
        for fn in sorted(files):
            if fn == "checksums.txt":
                continue
            full = os.path.join(base, fn)
            sums.append(f"{sha256(full)}  {os.path.relpath(full, dest)}")
    with open(os.path.join(dest, "checksums.txt"), "w", encoding="utf-8") as f:
        f.write(f"# {name}  engine={engine_ver}\n" + "\n".join(sums) + "\n")

    # zip
    zpath = os.path.join(out, name + ".zip")
    if os.path.isfile(zpath):
        os.remove(zpath)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, dirs, files in os.walk(dest):
            for fn in files:
                full = os.path.join(base, fn)
                zf.write(full, os.path.join(name, os.path.relpath(full, dest)))
    size = os.path.getsize(zpath)
    print(f"packed {zpath} ({size // 1024 // 1024} MB, {len(sums)} files, engine {engine_ver})")


if __name__ == "__main__":
    main()
