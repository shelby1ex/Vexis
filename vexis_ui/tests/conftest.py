"""Shared fixtures for the Vexis test-suite (pytest).

- UI_BASE: vexis_ui dir
- server_mod: imports server.py without starting it
- live_server: boots server.py on TEST ports (4031/8031) for HTTP/SSE tests
"""
import importlib.util
import json
import os
import subprocess
import sys
import time
import urllib.request

# Derive paths from this file so the suite works wherever Vexis is unpacked
# (no hardcoded drive/folder - the app is relocatable).
UI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_ENGINE_PORT = "4031"
TEST_UI_PORT = "8031"
TEST_UI = f"http://127.0.0.1:{TEST_UI_PORT}"


def load_server():
    spec = importlib.util.spec_from_file_location(
        "vexis_server_under_test", os.path.join(UI_DIR, "server.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def wait_http(path, timeout=60):
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(TEST_UI + path, timeout=5) as r:
                return r.status, r.read()
        except Exception as e:
            last = e
            time.sleep(1)
    raise AssertionError(f"server not up after {timeout}s: {last}")
