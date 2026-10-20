"""Backend unit tests: port parsing, JSONC, path guard, body limits,
auth persistence, artifact panel. No network needed."""
import io
import json
import os
import queue
import re
import sys
import urllib.parse

import pytest

sys.path.insert(0, os.path.dirname(__file__))
from conftest import UI_DIR, load_server

mod = load_server()


class TestPortParsing:
    def test_defaults(self):
        for k in ("OPENCODE_PORT", "VEXIS_UI_PORT"):
            os.environ.pop(k, None)
        assert mod._port("OPENCODE_PORT", 4001) == 4001
        assert mod._port("VEXIS_UI_PORT", 8001) == 8001

    def test_valid_custom(self):
        os.environ["OPENCODE_PORT"] = "5001"
        try:
            assert mod._port("OPENCODE_PORT", 4001) == 5001
        finally:
            del os.environ["OPENCODE_PORT"]

    def test_junk_falls_back(self):
        os.environ["OPENCODE_PORT"] = "junk"
        try:
            assert mod._port("OPENCODE_PORT", 4001) == 4001
        finally:
            del os.environ["OPENCODE_PORT"]

    def test_out_of_range_falls_back(self):
        for bad in ("0", "-1", "99999"):
            os.environ["VEXIS_UI_PORT"] = bad
            try:
                assert mod._port("VEXIS_UI_PORT", 8001) == 8001
            finally:
                del os.environ["VEXIS_UI_PORT"]


class TestJsonc:
    def test_comments_and_trailing_commas(self):
        text = '{\n// line\n"a": 1, /* block */\n"list": [1, 2,],\n}'
        assert mod.jsonc_loads(text) == {"a": 1, "list": [1, 2]}

    def test_bom_stripped(self):
        assert mod.jsonc_loads('﻿{"a": 1}') == {"a": 1}

    def test_comment_between_comma_and_brace(self):
        assert mod.jsonc_loads('{"a": 1, /* x */}') == {"a": 1}

    def test_slashes_inside_strings_kept(self):
        assert mod.jsonc_loads('{"u": "http://x/y"}') == {"u": "http://x/y"}

    def test_invalid_raises(self):
        with pytest.raises(Exception):
            mod.jsonc_loads('{"a": }')


class TestSafeFile:
    def test_allows_vexis_md(self):
        p = os.path.join(UI_DIR, "..", "memory", "note.md")
        assert mod._safe_file(p).lower().endswith("note.md")

    def test_blocks_js(self):
        with pytest.raises(ValueError):
            mod._safe_file(os.path.join(UI_DIR, "app.js"))

    def test_blocks_outside_roots(self):
        with pytest.raises(ValueError):
            mod._safe_file(r"C:\Windows\Temp\evil.md")

    def test_files_endpoint_lists_workspace(self):
        assert os.path.isdir(os.path.join(UI_DIR, "..", "workspace"))

    def test_blocks_empty(self):
        with pytest.raises(ValueError):
            mod._safe_file("")


class TestBodyJson:
    def _handler(self, body: bytes):
        h = mod.H.__new__(mod.H)
        import io

        h.headers = {"Content-Length": str(len(body))}
        h.rfile = io.BytesIO(body)
        return h

    def test_valid(self):
        assert self._handler(b'{"a": 1}')._body_json() == {"a": 1}

    def test_empty_is_empty_object(self):
        h = mod.H.__new__(mod.H)
        import io

        h.headers = {}
        h.rfile = io.BytesIO(b"")
        assert h._body_json() == {}

    def test_bad_json_raises_valueerror(self):
        with pytest.raises(ValueError):
            self._handler(b"{not json")._body_json()

    def test_oversize_raises_valueerror(self):
        h = mod.H.__new__(mod.H)
        import io

        h.headers = {"Content-Length": str(mod.MAX_BODY + 1)}
        h.rfile = io.BytesIO(b"{}")
        with pytest.raises(ValueError):
            h._body_json()


class TestAuthWrite:
    def test_roundtrip_atomic(self, tmp_path, monkeypatch):
        target = tmp_path / "auth.json"
        monkeypatch.setattr(mod, "AUTH_PATH", str(target))
        h = mod.H.__new__(mod.H)
        h._write_auth({"prov": {"type": "api", "key": "k"}})
        assert not os.path.exists(str(target) + ".tmp"), "tmp file leaked"
        with open(target, encoding="utf-8") as f:
            assert json.load(f)["prov"]["key"] == "k"
        assert h._read_auth()["prov"]["key"] == "k"


class TestPidGuard:
    """os.kill(pid, 0) raises WinError 87 on Windows even for live
    processes - the guard must use a Windows-safe check instead."""

    def test_self_is_alive(self):
        assert mod._pid_alive(os.getpid()) is True

    def test_dead_pid_is_not_alive(self):
        assert mod._pid_alive(99999) is False

    def test_spawn_alive_roundtrip(self, tmp_path, monkeypatch):
        # own python pid is alive but NOT vexis-runtime.exe -> must not defer
        monkeypatch.setattr(mod, "CONFIG_DIR", str(tmp_path))
        with open(mod._engine_pidfile(), "w") as f:
            f.write(str(os.getpid()))
        assert mod._engine_spawn_alive() is None

    def test_spawn_dead_pid_is_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr(mod, "CONFIG_DIR", str(tmp_path))
        with open(mod._engine_pidfile(), "w") as f:
            f.write("99999")
        assert mod._engine_spawn_alive() is None

    def test_spawn_missing_file_is_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr(mod, "CONFIG_DIR", str(tmp_path))
        assert mod._engine_spawn_alive() is None


class TestTerminals:
    def test_lifecycle(self):
        tid = mod._term_handle({})["id"]
        try:
            r = mod._term_handle({"id": tid, "cmd": "echo vexis-term-ok", "timeout": 30})
            assert r["ok"] and r["done"] and "vexis-term-ok" in r["output"]
            assert r["rc"] == 0
        finally:
            assert mod._term_handle({"id": tid, "kill": True})["ok"]

    def test_rejects(self):
        with pytest.raises(ValueError):
            mod._term_handle({"id": "nope", "cmd": "echo x"})
        with pytest.raises(ValueError):
            mod._term_handle({"id": "nope", "kill": True})

    def test_list(self):
        assert mod._term_handle({"list": True})["terms"] == []


class TestScreenshot:
    def test_shape(self):
        r = mod._screenshot()
        assert r["ok"] and r["image"].startswith("data:image/png;base64,")
        assert len(r["image"]) > 1000


class TestVerify:
    def test_unknown_target(self):
        with pytest.raises(ValueError):
            mod._verify("rm-rf-everything")

    def test_config(self):
        r = mod._verify("config")
        assert r["ok"] and isinstance(r["keys"], list)

    def test_health_shape(self):
        r = mod._verify("health")
        assert "ok" in r


class TestDesktop:
    @pytest.mark.skipif(os.name != "nt", reason="Windows only")
    def test_rejects(self):
        for bad in ({}, {"op": "rm"}, {"op": "click", "x": -1, "y": 0},
                    {"op": "click", "x": 0, "y": 0, "button": "side"},
                    {"op": "type", "text": ""}, {"op": "type", "text": "x" * 501},
                    {"op": "key", "key": "F13"}):
            with pytest.raises(ValueError):
                mod._desktop(dict(bad))


class TestRelease:
    def _handler(self, method, path, headers=None, body=b""):
        h = mod.H.__new__(mod.H)
        h.command = method
        h.path = path
        h.headers = headers or {}
        import io
        h.rfile = io.BytesIO(body)
        h._captured = None

        def cap(self, obj, code=200):
            h._captured = (code, obj)
        h._json_out = cap.__get__(h, mod.H)
        return h

    def test_bootstrap_shape(self):
        h = self._handler("GET", "/vexis/bootstrap")
        h._vexis()
        code, obj = h._captured
        assert code == 200 and obj["secret"] == mod.APP_SECRET
        assert obj["app"]["version"]

    def test_secret_gate_blocks(self):
        body = json.dumps({"content": "# hi"}).encode()
        h = self._handler("POST", "/vexis/memory", {}, body)
        h._vexis()
        assert h._captured[0] == 403

    def test_secret_gate_allows(self):
        h = self._handler("POST", "/vexis/memory",
                          {"Content-Length": "2",
                           "X-Vexis-Secret": mod.APP_SECRET}, b"{}")
        h._vexis()
        assert h._captured[0] != 403  # {} -> 400 missing name, but not 403

    def test_version_file(self):
        with open(os.path.join(UI_DIR, "..", "version.json"), encoding="utf-8") as f:
            v = json.load(f)
        assert re.fullmatch(r"\d+\.\d+\.\d+", v["version"])
        assert v["engine"]

    def test_ocr_rejects_garbage(self):
        with pytest.raises(ValueError):
            mod._ocr("not-an-image")

    @pytest.mark.skipif(os.name != "nt", reason="Windows OCR")
    def test_ocr_reads_text(self):
        """Regression: the WinRT calls used to throw MethodNotFound, so
        /vexis/ocr failed on real images (only the garbage path was tested)."""
        try:
            import base64
            import io

            from PIL import Image, ImageDraw
        except ImportError:
            pytest.skip("PIL missing")
        img = Image.new("RGB", (420, 90), "white")
        ImageDraw.Draw(img).text((12, 35), "VEXIS OCR 12345", fill="black")
        img = img.resize((img.width * 3, img.height * 3))  # help the OCR engine
        buf = io.BytesIO()
        img.save(buf, "PNG")
        data = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        try:
            r = mod._ocr(data)
        except ValueError as e:
            pytest.skip("OCR engine unavailable here: " + str(e)[:120])
        assert r["ok"]
        assert "12345" in r["text"].replace(" ", ""), r["text"]

    def test_package_files_exist(self):
        root = os.path.join(UI_DIR, "..")
        for f in ("package.py", "install.bat", "build_exe.bat", "Vexis.iss",
                  "logo.ico", "README.md", "INSTALL.md", "PRIVACY.md",
                  "CHANGELOG.md", "version.json", "vexis_ui/Vexis.exe"):
            assert os.path.isfile(os.path.join(root, *f.split("/"))), f

    def test_iss_matches_version(self):
        import json as _json
        root = os.path.join(UI_DIR, "..")
        with open(os.path.join(root, "version.json"), encoding="utf-8") as f:
            ver = _json.load(f)["version"]
        with open(os.path.join(root, "Vexis.iss"), encoding="utf-8") as f:
            iss = f.read()
        assert f'#define MyAppVersion "{ver}"' in iss
        assert "restartreplace" in iss
        assert "NeedsWebView2" in iss
        assert "webview2boot" in iss and "python-3.12" in iss
        assert "desktopicon" in iss and "startmenu" in iss


def _art_handler(method, path, headers=None, body=b""):
    """A request handler with the socket bits stubbed out, so the /vexis/*
    routes can be driven in-process (no network)."""
    h = mod.H.__new__(mod.H)
    h.command = method
    h.path = path
    h.headers = headers or {}
    h.rfile = io.BytesIO(body)
    h.wfile = io.BytesIO()
    h.close_connection = False
    h._captured = None
    h.send_response = lambda code, *a, **k: None
    h.send_header = lambda k, v: None
    h.end_headers = lambda: None

    def cap(self, obj, code=200):
        h._captured = (code, obj)
    h._json_out = cap.__get__(h, mod.H)
    return h


class TestArtifacts:
    """The AI -> right-hand-panel bridge: POST /vexis/artifact, the in-memory
    store, GET /vexis/artifacts, the SSE fan-out and GET /vexis/raw."""

    def _post(self, payload, secret=True):
        raw = json.dumps(payload).encode()
        hdr = {"Content-Length": str(len(raw))}
        if secret:
            hdr["X-Vexis-Secret"] = mod.APP_SECRET
        h = _art_handler("POST", "/vexis/artifact", hdr, raw)
        h._vexis()
        return h._captured

    def _isolate(self, monkeypatch):
        monkeypatch.setattr(mod, "ARTIFACTS", [])
        monkeypatch.setattr(mod, "ART_SUBS", [])

    def test_post_requires_secret(self, tmp_path):
        f = tmp_path / "a.html"
        f.write_text("<h1>hi</h1>", encoding="utf-8")
        code, _ = self._post({"path": str(f)}, secret=False)
        assert code == 403

    def test_post_file_artifact(self, tmp_path, monkeypatch):
        self._isolate(monkeypatch)
        f = tmp_path / "a.html"
        f.write_text("<h1>hi</h1>", encoding="utf-8")
        code, obj = self._post({"path": str(f), "title": "Demo"})
        assert code == 200 and obj["ok"]
        art = obj["artifact"]
        assert art["kind"] == "file" and art["title"] == "Demo"
        assert art["ext"] == ".html" and art["preview"] is True
        assert art["url"].startswith("/vexis/raw?path=")
        assert art["id"] and art["at"]
        assert mod.ARTIFACTS[-1]["id"] == art["id"]

    def test_post_url_artifact(self, monkeypatch):
        self._isolate(monkeypatch)
        code, obj = self._post({"url": "https://example.com"})
        assert code == 200
        assert obj["artifact"]["kind"] == "url"
        assert obj["artifact"]["preview"] is True
        assert obj["artifact"]["url"] == "https://example.com"

    def test_post_rejects_bad_input(self):
        assert self._post({})[0] == 400                    # neither path nor url
        assert self._post({"url": "ftp://x"})[0] == 400    # not http(s)
        assert self._post({"path": "no-such-file.html"})[0] == 400

    def test_non_previewable_extension(self, tmp_path, monkeypatch):
        self._isolate(monkeypatch)
        f = tmp_path / "bundle.zip"
        f.write_bytes(b"PK\x03\x04")
        code, obj = self._post({"path": str(f)})
        assert code == 200
        assert obj["artifact"]["preview"] is False

    def test_list_newest_first(self, monkeypatch):
        monkeypatch.setattr(mod, "ARTIFACTS", [{"id": "1"}, {"id": "2"}])
        h = _art_handler("GET", "/vexis/artifacts")
        h._vexis()
        code, obj = h._captured
        assert code == 200
        assert [a["id"] for a in obj["artifacts"]] == ["2", "1"]

    def test_store_is_bounded(self, tmp_path, monkeypatch):
        self._isolate(monkeypatch)
        monkeypatch.setattr(mod, "ART_MAX", 3)
        f = tmp_path / "x.md"
        f.write_text("hi", encoding="utf-8")
        for _ in range(5):
            mod._artifact_add(path=str(f))
        assert len(mod.ARTIFACTS) == 3

    def test_publish_reaches_subscribers(self, monkeypatch):
        q = queue.Queue()
        monkeypatch.setattr(mod, "ART_SUBS", [q])
        ev = {"type": "artifact", "artifact": {"id": "z"}}
        mod._artifact_publish(ev)
        assert q.get_nowait() == ev

    def test_add_publishes_event(self, tmp_path, monkeypatch):
        q = queue.Queue()
        monkeypatch.setattr(mod, "ART_SUBS", [q])
        monkeypatch.setattr(mod, "ARTIFACTS", [])
        f = tmp_path / "t.md"
        f.write_text("x", encoding="utf-8")
        art = mod._artifact_add(path=str(f))
        ev = q.get_nowait()
        assert ev["type"] == "artifact"
        assert ev["artifact"]["id"] == art["id"]

    def test_raw_serves_file_with_mime(self, tmp_path):
        f = tmp_path / "page.html"
        f.write_text("<h1>raw</h1>", encoding="utf-8")
        h = _art_handler("GET", "/vexis/raw?path=" + urllib.parse.quote(str(f)))
        sent = []
        h.send_header = lambda k, v: sent.append((k, v))
        h._vexis()
        assert h.wfile.getvalue() == b"<h1>raw</h1>"
        hdrs = dict(sent)
        assert hdrs["Content-Type"] == "text/html"
        assert hdrs["X-Content-Type-Options"] == "nosniff"

    def test_raw_head_has_no_body(self, tmp_path):
        f = tmp_path / "page.md"
        f.write_text("hello", encoding="utf-8")
        h = _art_handler("HEAD", "/vexis/raw?path=" + urllib.parse.quote(str(f)))
        h._vexis()
        assert h.wfile.getvalue() == b""

    def test_raw_missing_file_is_400(self):
        h = _art_handler("GET", "/vexis/raw?path=nope-nope-nope.html")
        h._vexis()
        assert h._captured[0] == 400

    def test_raw_rejects_post(self):
        h = _art_handler("POST", "/vexis/raw",
                         {"Content-Length": "2",
                          "X-Vexis-Secret": mod.APP_SECRET}, b"{}")
        h._vexis()
        assert h._captured[0] == 405


class TestKeepAlive:
    """Regression: a handler that answered without reading the request body
    (403/405) left those bytes in the socket, so the *next* keep-alive request
    parsed them as a request line and got a 501."""

    def test_drain_consumes_leftover_body(self):
        h = _art_handler("POST", "/vexis/artifact",
                         {"Content-Length": "5"}, b"helloNEXT")
        h._drain_body()
        assert h.rfile.read() == b"NEXT"

    def test_drain_huge_body_closes_connection(self):
        h = _art_handler("POST", "/vexis/artifact",
                         {"Content-Length": str(mod.MAX_BODY + 1)}, b"")
        h._drain_body()
        assert h.close_connection is True

    def test_forbidden_post_drains_body(self):
        h = _art_handler("POST", "/vexis/artifact",
                         {"Content-Length": "5"}, b"helloTAIL")
        h._vexis()
        assert h._captured[0] == 403
        assert h.rfile.read() == b"TAIL"


class TestPanelPlugin:
    """config/plugins/vexis-panel.ts gives the model a `vexis_show` tool that
    pushes into the panel; the @opencode-ai/plugin import must stay optional so
    the plugin still loads on a machine that never ran `bun install`."""

    def _src(self):
        p = os.path.join(UI_DIR, "..", "config", "plugins", "vexis-panel.ts")
        with open(p, encoding="utf-8") as f:
            return f.read()

    def test_registers_vexis_show(self):
        src = self._src()
        assert "export const VexisPanelPlugin" in src
        assert "vexis_show: tool(" in src
        for arg in ("path:", "url:", "title:"):
            assert arg in src, f"vexis_show lost its {arg} argument"

    def test_dependency_import_is_guarded(self):
        src = self._src()
        i = src.index('await import("@opencode-ai/plugin")')
        assert "try {" in src[:i], "dynamic import must be inside a try"
        assert "catch" in src[i:i + 120], "dynamic import must have a fallback"

    def test_pushes_to_the_panel_endpoint(self):
        src = self._src()
        assert "/vexis/artifact" in src
        assert "X-Vexis-Secret" in src and "VEXIS_UI_SECRET" in src
        assert "VEXIS_UI_PORT" in src

    def test_plugin_folder_is_packaged(self):
        with open(os.path.join(UI_DIR, "..", "package.py"), encoding="utf-8") as f:
            pkg = f.read()
        assert '"config"' in pkg and '"plugins"' in pkg, \
            "package.py stopped shipping config/plugins"
