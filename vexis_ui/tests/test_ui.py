"""Live UI tests: boot server.py on test ports and exercise it like a
browser + the app would (static assets, local API, SSE, full question
round-trip through the proxy). Engine-dependent tests skip cleanly
when the engine cannot start here."""
import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

import pytest

from conftest import TEST_ENGINE_PORT, TEST_UI, TEST_UI_PORT, UI_DIR, wait_http

# Derive from this file (relocatable); WS is the agent workspace sibling of vexis_ui.
WS = os.path.join(os.path.dirname(UI_DIR), "workspace")


_SECRET = {"v": ""}


def _req(method, path, body=None, timeout=30):
    if not _SECRET["v"] and path.startswith("/vexis/"):
        try:
            with urllib.request.urlopen(TEST_UI + "/vexis/bootstrap", timeout=10) as r:
                _SECRET["v"] = json.loads(r.read().decode()).get("secret", "")
        except Exception:
            pass
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if _SECRET["v"] and path.startswith("/vexis/") and method != "GET":
        headers["X-Vexis-Secret"] = _SECRET["v"]
    r = urllib.request.Request(TEST_UI + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            t = resp.read().decode()
            try:
                parsed = json.loads(t) if t.strip() else None
            except ValueError:
                parsed = t  # static assets / HTML are not JSON
            return resp.status, resp.headers, parsed
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode()[:500]


def _pids_on(port):
    try:
        out = subprocess.run(["netstat", "-ano"], capture_output=True,
                             text=True, timeout=10).stdout.splitlines()
    except Exception:
        return set()
    pids = set()
    for line in out:
        p = line.split()
        if len(p) == 5 and p[0].upper() == "TCP" and p[3].upper() == "LISTENING" \
                and p[1] == f"127.0.0.1:{port}":
            try:
                pids.add(int(p[4]))
            except ValueError:
                pass
    return pids


@pytest.fixture(scope="module")
def live():
    # Reused (not fresh) throwaway engine database: never share the live
    # .data DB (concurrent engines on one sqlite file corrupt it), but a
    # warm test DB keeps cold boot + catalog fetch from timing the suite out.
    import tempfile
    xdg = os.path.join(tempfile.gettempdir(), "vexis-test-xdg")
    os.makedirs(xdg, exist_ok=True)
    env = dict(os.environ, OPENCODE_PORT=TEST_ENGINE_PORT,
               VEXIS_UI_PORT=TEST_UI_PORT, XDG_DATA_HOME=xdg)
    proc = subprocess.Popen(["python", os.path.join(UI_DIR, "server.py")],
                            cwd=UI_DIR, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_http("/vexis/info", timeout=60)
        yield proc
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        for _ in range(3):
            pids = _pids_on(int(TEST_ENGINE_PORT)) | _pids_on(int(TEST_UI_PORT))
            if not pids:
                break
            for pid in pids:
                try:
                    subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                                   capture_output=True, timeout=10)
                except Exception:
                    pass
            time.sleep(2)
        # leave no stale test pidfile behind (the app re-creates it on launch)
        try:
            os.remove(os.path.join(UI_DIR, "..", "config",
                                   f"engine-{TEST_ENGINE_PORT}.pid"))
        except OSError:
            pass


def _engine_ok():
    s, _, b = _req("GET", "/vexis/info")
    return isinstance(b, dict) and b.get("engine_ok")


class TestStatic:
    def test_index(self, live):
        s, h, _ = _req("GET", "/")
        assert s == 200 and "text/html" in h.get("Content-Type", "")

    def test_index_has_mounts(self, live):
        _, _, raw = _req("GET", "/", timeout=10)
        with urllib.request.urlopen(TEST_UI + "/", timeout=10) as r:
            html = r.read().decode()
        for i in ("pending-cards", "chat", "composer-wrap", "btn-send"):
            assert f'id="{i}"' in html, f"missing #{i}"

    def test_assets_mime(self, live):
        for path, mime in (("/app.js", "javascript"), ("/styles.css", "css"),
                           ("/i18n.js", "javascript")):
            s, h, _ = _req("GET", path)
            assert s == 200, path
            assert mime in h.get("Content-Type", ""), (path, h.get("Content-Type"))

    def test_spa_fallback(self, live):
        with urllib.request.urlopen(urllib.request.Request(
                TEST_UI + "/nope", headers={"Accept": "text/html"}),
                timeout=10) as r:
            assert r.status == 200

    def test_info(self, live):
        s, _, b = _req("GET", "/vexis/info")
        assert s == 200
        assert b["root"].endswith("vexis_ui")
        assert b["ui_port"] == int(TEST_UI_PORT)
        assert b["runtime"]["exists"] is True
        assert b["app"]["version"]

    def test_bootstrap_and_gate(self, live):
        s, _, b = _req("GET", "/vexis/bootstrap")
        assert s == 200 and b.get("secret") and b.get("app")
        # no secret -> 403
        r = urllib.request.Request(
            TEST_UI + "/vexis/memory", data=b"{}",
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            urllib.request.urlopen(r, timeout=10)
            pytest.fail("expected 403")
        except urllib.error.HTTPError as e:
            assert e.code == 403

    def test_bad_json_is_400(self, live):
        if not _SECRET["v"]:
            _req("GET", "/vexis/info")
        r = urllib.request.Request(
            TEST_UI + "/vexis/config", data=b"{bad", method="POST",
            headers={"Content-Type": "application/json",
                     "X-Vexis-Secret": _SECRET["v"]})
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(r, timeout=10)
        assert e.value.code == 400

    def test_sse_connects(self, live):
        for _ in range(20):
            if _engine_ok():
                break
            time.sleep(3)
        if not _engine_ok():
            pytest.skip("engine down")
        r = urllib.request.Request(TEST_UI + "/event",
                                   headers={"Accept": "text/event-stream"})
        try:
            with urllib.request.urlopen(r, timeout=15) as resp:
                try:
                    chunk = resp.read(4096).decode("utf-8", "replace")
                except TimeoutError:
                    chunk = ""  # open stream, idle engine: headers prove it
                assert resp.status == 200 and ("data:" in chunk or chunk == "")
        except urllib.error.HTTPError as e:
            assert e.code == 502  # engine down: proxy answers clean JSON error


class TestLocalApi:
    def test_memory_crud(self, live):
        name = "pytest-probe.md"
        s, _, b = _req("POST", "/vexis/memory",
                       {"name": name, "content": "hello"})
        assert s == 200 and b.get("ok")
        s, _, b = _req("GET", "/vexis/memory?name=" + name)
        assert s == 200 and "hello" in b.get("content", "")
        s, _, b = _req("DELETE", "/vexis/memory?name=" + name)
        assert s == 200

    def test_memory_rejects_traversal(self, live):
        s, _, _ = _req("POST", "/vexis/memory",
                       {"name": "../evil.md", "content": "x"})
        # basename() neutralises it or it errors - either way no escape
        assert s in (200, 400)
        assert not os.path.isfile(os.path.join(UI_DIR, "..", "evil.md"))

    def test_file_roundtrip(self, live):
        fp = os.path.join(UI_DIR, "tests", "tmp-probe.md")
        s, _, b = _req("POST", "/vexis/file",
                       {"path": fp, "content": "probe-123"})
        assert s == 200, b
        try:
            s, _, b = _req(
                "GET", "/vexis/file?path=" + urllib.parse.quote(fp))
            assert s == 200 and "probe-123" in b.get("content", "")
        finally:
            if os.path.isfile(fp):
                os.remove(fp)

    def test_file_rejects_js(self, live):
        s, _, _ = _req("POST", "/vexis/file",
                       {"path": os.path.join(UI_DIR, "x.js"),
                        "content": "x"})
        assert s == 400

    def test_files_lists_workspace(self, live):
        s, _, b = _req("GET", "/vexis/files?path=" +
                       urllib.parse.quote("workspace"))
        assert s == 200, b
        assert isinstance(b.get("entries"), list)

    def test_files_blocks_escape(self, live):
        s, _, _ = _req("GET", "/vexis/files?path=" +
                       urllib.parse.quote("../../.."))
        assert s == 400

    def test_files_rejects_file(self, live):
        s, _, _ = _req("GET", "/vexis/files?path=" +
                       urllib.parse.quote("vexis_ui/app.js"))
        assert s == 400

    def test_git_shape(self, live):
        s, _, b = _req("GET", "/vexis/git")
        assert s == 200 and "available" in b, b
        if b["available"]:
            assert "files" in b and "log" in b

    def test_open_rejects_non_http(self, live):
        for bad in ("file:///etc/passwd", "javascript:alert(1)", "", "ftp://x"):
            s, _, _ = _req("POST", "/vexis/open", {"url": bad})
            assert s == 400, bad

    def test_term_lifecycle(self, live):
        s, _, b = _req("POST", "/vexis/term", {})
        assert s == 200 and b.get("id"), b
        tid = b["id"]
        try:
            s, _, b = _req("POST", "/vexis/term",
                           {"id": tid, "cmd": "echo live-term-ok", "timeout": 30})
            assert s == 200 and "live-term-ok" in b.get("output", ""), b
        finally:
            s, _, _ = _req("POST", "/vexis/term", {"id": tid, "kill": True})
            assert s == 200

    def test_term_list(self, live):
        s, _, b = _req("POST", "/vexis/term", {"list": True})
        assert s == 200 and isinstance(b.get("terms"), list)

    def test_shot_shape(self, live):
        s, _, b = _req("POST", "/vexis/shot", {}, timeout=60)
        assert s == 200 and b.get("image", "").startswith("data:image/png;base64,"), str(b)[:200]

    def test_verify_targets(self, live):
        s, _, b = _req("POST", "/vexis/verify", {"target": "config"})
        assert s == 200 and b.get("ok"), b
        s, _, _ = _req("POST", "/vexis/verify", {"target": "nuke"})
        assert s == 400

    def test_desktop_rejects(self, live):
        s, _, _ = _req("POST", "/vexis/desktop", {"op": "click", "x": -5, "y": 0})
        assert s == 400

    def test_open_rejects_method(self, live):
        s, _, _ = _req("GET", "/vexis/open")
        assert s in (405, 404)


class TestQuestionFlow:
    """Full question round-trip through the proxy (needs engine + model)."""

    def test_ask_answer(self, live):
        t0 = time.time()
        while time.time() - t0 < 90:
            if _engine_ok():
                break
            time.sleep(3)
        if not _engine_ok():
            pytest.skip("engine did not come up here")
        d = "?directory=" + urllib.parse.quote(WS)
        s, _, ses = _req("POST", "/session" + d, {"title": "pytest-q"})
        assert s == 200, ses
        sid = ses["id"]
        try:
            _req("POST", f"/session/{sid}/prompt_async" + d, {
                "model": {"providerID": "opencode",
                          "modelID": "mimo-v2.6-flash-free"},
                "agent": "build",
                "parts": [{"type": "text",
                           "text": "Call the question tool with one question "
                                   "'Pick color?' header 'Color' options Red/Blue."}]})
            que = None
            for _ in range(75):
                time.sleep(2)
                s, _, b = _req("GET", "/question" + d)
                items = b if isinstance(b, list) else b.get("data", [])
                mine = [q for q in items
                        if isinstance(q, dict) and q.get("sessionID") == sid]
                if mine:
                    que = mine[0]
                    break
            assert que, "no question appeared"
            assert que["id"].startswith("que_")
            assert que["questions"][0]["header"] == "Color"
            assert [o["label"] for o in
                    que["questions"][0]["options"]] == ["Red", "Blue"]
            s, _, b = _req(
                "POST", f"/question/{urllib.parse.quote(que['id'])}/reply" + d,
                {"answers": [["Red"]]})
            assert s == 200, b
            for _ in range(15):
                time.sleep(2)
                s, _, b = _req("GET", "/question" + d)
                items = b if isinstance(b, list) else b.get("data", [])
                if not [q for q in items if q.get("sessionID") == sid]:
                    break
            else:
                pytest.fail("question not cleared after reply")
        finally:
            _req("DELETE", f"/session/{sid}" + d)
