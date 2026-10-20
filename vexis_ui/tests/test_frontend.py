"""Frontend static tests: syntax + contract checks between
app.js / index.html / styles.css / i18n.js. No browser needed.

These guard the exact bug classes from the audit:
- JS referencing DOM ids / CSS classes that do not exist
- question reply shape / endpoint order regressions
- missing XSS guards
"""
import json
import os
import re
import subprocess

import pytest

UI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    with open(os.path.join(UI, name), encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="module")
def js():
    return read("app.js")


@pytest.fixture(scope="module")
def html():
    return read("index.html")


@pytest.fixture(scope="module")
def css():
    return read("styles.css")


def test_js_syntax():
    r = subprocess.run(["node", "--check", "app.js"], cwd=UI,
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr


def test_ids_referenced_exist_in_html(js, html):
    needed = ["pending-cards", "composer-wrap", "chat", "chat-wrap",
              "btn-send", "btn-stop", "model-list", "set-model",
              "rsb", "rsb-body", "rsb-close", "btn-usage", "usage-pop",
              "btn-attach", "file-input", "model-picker-btn", "agent-picker-btn",
              "sideSeg", "themeGallery", "agentSwitch",
              "set-wide", "set-motion"]
    for i in needed:
        assert f'id="{i}"' in html, f"missing #{i} in index.html"
        assert f'$("{i}")' in js or f"('{i}')" in js or f'"{i}"' in js \
            or f'"#{i}' in js, f"#{i} not wired in app.js"


def test_rsb_tabs_present(html, js):
    for tab in ("todo", "files", "browser"):
        assert f'data-rtab="{tab}"' in html, f"missing rsb tab {tab}"
    # removed tabs must be gone from the markup
    for gone in ("context", "diff", "git", "terminal", "verify"):
        assert f'data-rtab="{gone}"' not in html, f"stale rsb tab {gone}"
    for fn in ("renderFilesTab", "previewFile", "renderBrowserTab",
               "brwOpenUrl", "brwActive", "usageRows", "renderUsagePop",
               "renderProjects", "setSideView", "taskPhaseHTML",
               "buildAgentSwitch", "loadAgents", "buildThemeGallery"):
        assert f"function {fn}" in js or f"async function {fn}" in js, \
            f"missing {fn}"


def test_rsb_tab_css(css):
    for cls in (".rsb-tabs", ".rsb-tab", ".file-row", ".file-crumbs",
                ".brw-bar", ".brw-frame", ".brw-tabs", ".brw-tablist",
                ".brw-tab", ".brw-new", ".brw-ic", ".omni", ".brw-page",
                ".brw-home", ".brw-empty", ".brw-recent-h", ".brw-fav",
                ".usage-pop", ".usage-row",
                ".side-seg", ".phase-strip", ".phase-chip",
                ".theme-gallery", ".theme-card", ".agent-switch"):
        assert cls in css, f"missing CSS {cls}"


def test_sidebar_controls_css(css):
    for cls in (".new-chat-btn", ".model-picker", ".icon-btn",
                ".sidebar-search-input", ".user-chip"):
        assert cls in css, f"missing CSS {cls}"


def test_new_i18n_keys_used_defined(js):
    src = read("i18n.js")
    for k in ("tabFiles", "tabBrowser", "tabGit", "todoHint", "brwGo",
              "brwUrl", "brwHint", "filesTitle", "wsFiles", "knFiles",
              "gitTitle", "gitUnavail", "gitBranch", "brwNewTab", "brwBack",
              "brwFwd", "brwReload", "brwOpenExt", "brwCopyLink",
              "brwCloseTab", "brwEmptyT", "brwEmptyS", "brwRecent",
              "tabTerm", "tabVerify", "sideChats", "sideProjects",
              "termNew", "termRun", "termKill", "termStopAll", "termPh",
              "verTests", "verHealth", "verConfig", "phPlan", "phAct",
              "phObserve", "phVerify", "routerTitle", "routerFallback",
              "routerNote", "retryFallback"):
        assert k in src, f"i18n key {k} missing"
    assert "browserRecent" in js


def test_no_dead_set_theme_handler(js, html):
    assert 'id="set-theme"' not in html
    # theme UI moved to #themeSeg: any leftover reference must be null-guarded
    for m in re.finditer(r'\$\("set-theme"\)', js):
        after = js[m.end():m.end() + 120]
        assert re.match(r"\s*\)?\s*;", after) or "if (" in js[max(0, m.start() - 60):m.end() + 40], \
            "unguarded set-theme use"


def test_question_css_classes_exist(js, css):
    for cls in [".quest", ".q-opt", ".q-mark", ".q-radio", ".q-check",
                ".q-body", ".q-tabs", ".q-progress", ".q-nav",
                ".q-hist", ".pending-cards"]:
        assert cls in css, f"missing CSS {cls}"
        assert cls.lstrip(".") in js, f"{cls} unused in app.js?"


def test_step_row_css_exists(css):
    for cls in [".step-row", ".sr-label", ".sr-sum", ".sr-body",
                ".sk-think", ".sk-shell", ".sk-edit", ".sk-quest"]:
        assert cls in css, f"missing CSS {cls}"


def test_question_reply_shape_and_route(js):
    # nested-array payload (engine rejects flat ["A"])
    assert '{ answers: answers }' in js
    # global route FIRST (verified 200), api fallback second (404 on 1.18.35)
    g = js.index('/question/" + encodeURIComponent(id) + "/reply"')
    a = js.index('/api/session/" + encodeURIComponent(sid) + "/question/"')
    assert g < a, "question reply must try global route first"


def test_pending_quests_fallback(js):
    i = js.index("async function pendingQuests")
    block = js[i:i + 900]
    assert "/api/session/" in block and '"/question"' in block, \
        "pendingQuests lost its global /question fallback"


def test_question_asked_event_wired(js):
    assert 'ev.type === "question.asked"' in js
    assert "renderQuestCard(pendingDock()" in js


def test_event_source_scoped_and_reconnecting(js):
    assert '"/event" + qdir()' in js, "EventSource lost ?directory= scope"
    assert "onerror" in js and "backoff" in js, "SSE reconnect missing"


def test_img_scheme_allowlist(js):
    assert "function safeImg" in js
    assert "esc(safeImg(p.url))" in js, "unfiltered esc(p.url) <img> came back"
    assert "esc(p.url)" not in js.replace("esc(safeImg(p.url))", ""), \
        "raw esc(p.url) still used somewhere"


def test_esc_covers_quotes(js):
    start = js.index("const esc = ")
    block = js[start:start + 500]
    assert "&#39;" in block and "&#96;" in block


def test_settings_toggle_single_label(html):
    for key in ("sound", "thinkingShow", "detailsShow"):
        assert html.count(f'data-i18n="{key}"') == 1, \
            f"toggle label {key} rendered twice (overlap bug)"


def test_toggle_switch_css(css):
    assert ".toggle input:checked + .track" in css
    assert ".track::after" in css


def test_arabic_support(js, css):
    assert "function arCls" in js
    assert ".md.ar" in css and "19.5px" in css


def test_quest_card_rounder(css):
    assert "border-radius: 18px" in css and "border-radius: 14px" in css


def test_theme_gallery(js):
    m = re.search(r"const THEMES = (\[.*?\]);", js, re.S)
    assert m, "THEMES array missing"
    themes = json.loads(m.group(1))
    assert len(themes) >= 12, f"want a full theme gallery, got {len(themes)}"
    ids = [t["id"] for t in themes]
    assert len(set(ids)) == len(ids), "duplicate theme ids"
    for t in themes:
        for mode in ("dark", "light"):
            pal = t[mode]
            for k in ("bg", "surface", "accent", "accent2"):
                assert re.fullmatch(r"#[0-9a-f]{6}", pal[k]), (t["id"], mode, k)


def test_accent_var_only_in_css(css):
    # single :root default may keep the old teal hex; nowhere else
    assert css.count("#10a37f") == 1, "hardcoded accent hex outside :root default"
    assert css.count("16,163,127") == 1, "hardcoded accent rgb outside :root default"
    assert "var(--acc)" in css and "var(--acc-rgb)" in css


def test_accent_wiring(js, html, css):
    assert 'id="themeGallery"' in html
    assert "buildThemeGallery" in js and "ensureThemeStyle" in js
    assert 'data-acc="' in js, "per-theme CSS never generated"
    assert ".theme-gallery" in css
    assert 'id="agentSwitch"' in html and "buildAgentSwitch" in js
    for i in ("set-wide", "set-motion"):
        assert f'id="{i}"' in html and f'$("{i}")' in js
    assert 'data-wide="1"' in css and 'data-rm="1"' in css


def test_accent_i18n():
    src = read("i18n.js")
    for k in ("accentTitle", "layoutTitle", "wideChat", "motionTitle",
              "reduceMotion", "themeGallery", "themeGalleryTip", "modeTip",
              "agentSwitch"):
        assert src.count(k + ":") >= 2, f"i18n key {k} missing EN/FR"


def test_exe_freeze_support():
    with open(os.path.join(UI, "server.py"), encoding="utf-8") as f:
        srv = f.read()
    with open(os.path.join(UI, "app_desktop.py"), encoding="utf-8") as f:
        desk = f.read()
    assert "def run():" in srv and 'run()' in srv
    assert "_init_paths" in srv and "VEXIS_DIR" in srv and "_MEIPASS" in srv
    assert '"--server"' in desk and "SERVER_CMD" in desk
    assert "FROZEN" in desk
    assert os.path.isfile(os.path.join(UI, "Vexis.exe")), "Vexis.exe missing"


def test_no_console_flashes():
    """Every child process must carry CREATE_NO_WINDOW/DETACHED (or _hide):
    the windowed exe shows no console, so helpers must not pop one."""
    import ast
    for fn in ("server.py", "app_desktop.py", "engine_updater.py"):
        src = open(os.path.join(UI, fn), encoding="utf-8-sig").read()
        tree = ast.parse(src)
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            name = ""
            if isinstance(f, ast.Attribute):
                v = f.value
                mod = v.id if isinstance(v, ast.Name) else ""
                name = f"{mod}.{f.attr}"
            if name not in ("subprocess.Popen", "subprocess.run", "subprocess.call"):
                continue
            kw = {k.arg for k in node.keywords if k.arg}
            unpack = any(k.arg is None for k in node.keywords)  # **_hide()
            has_star = unpack or any(isinstance(a, ast.Starred) for a in node.args)
            assert "creationflags" in kw or has_star, \
                f"{fn}:{node.lineno} spawns a console-visible child"


def test_secret_and_ocr_wiring(js, html):
    assert "X-Vexis-Secret" in js and "/vexis/bootstrap" in js
    assert "S.secret" in js
    assert "cmdOcr" in js and '"ocr"' in js
    # the composer screenshot button is gone; /screenshot is a palette command
    assert 'id="btn-shot"' not in html
    assert "cmdShot" in js and '"screenshot"' in js and '"shot"' in js
    src = read("i18n.js")
    assert src.count("descOcr:") >= 2 and src.count("ocrEmpty:") >= 2
    assert src.count("descShot:") >= 2 and src.count("shotDone:") >= 2


def test_pending_cards_full_chat_width(css):
    m = re.search(r"\.pending-cards \{\s*display: flex;", css)
    assert m, "base .pending-cards rule missing"
    block = css[m.start():m.start() + 400]
    assert "max-width: 800px" in block, "pending card narrower than chat column"
    assert "width: 100%" in block


def test_rsb_grip_wired(js, html):
    assert 'id="rsb-grip"' in html
    assert '"rsb-grip"' in js and "pointerdown" in js and "rsbW" in js


def test_browser_panel_chrome_style(js, css):
    """The Browser tab must look like a Chrome window: inline SVG icons, a tab
    strip with a new-tab button, and a rounded omnibox -- not HTML button tabs."""
    for icon in ("back", "fwd", "reload", "plus", "close", "copy", "ext",
                 "lock", "globe", "file"):
        assert f"{icon}: '<" in js, f"missing {icon} icon path"
    assert "function brwSvg(" in js
    assert 'className = "omni"' in js
    assert 'className = "brw-tablist"' in js
    assert 'className = "brw-new"' in js
    assert "function brwLikelyUrl" in js
    # the old text-glyph tab strip / nav buttons are gone
    assert "brw-dot" not in js, "old tab strip dot came back"
    assert 'textContent = "←"' not in js and 'textContent = "⟳"' not in js
    # full-bleed panel + a pill omnibox
    assert "rsb-flush" in js and ".rsb-body.rsb-flush" in css
    assert ".omni input" in css and "border-radius: 999px" in css


def test_browser_local_artifact_sandbox(js):
    """AI-authored HTML must run without allow-same-origin (opaque origin),
    while external sites keep it so ordinary sites still work."""
    i = js.index('fr.className = "brw-frame"')
    block = js[i:i + 600]
    assert '"allow-scripts allow-forms"' in block, "local artifact sandbox lost"
    assert "allow-same-origin" in block, "external frames still need same-origin"


def test_artifact_push_wiring(js, css):
    for fn in ("pushArtifact", "loadArtifacts", "connectUiEvents",
               "renderArtifactsList", "brwOpenArtifact", "artAutoPush",
               "artPreviewable", "artExt"):
        assert f"function {fn}" in js or f"async function {fn}" in js, fn
    assert '"/vexis/artifact"' in js and '"/vexis/artifacts"' in js
    assert 'new EventSource("/vexis/events")' in js
    assert 'ev.type === "artifact"' in js
    assert "S.artSeen" in js, "duplicate SSE delivery guard missing"
    assert ".file-row.art-on" in css and ".art-path" in css


def test_artifact_i18n():
    src = read("i18n.js")
    for k in ("artifacts", "artPushed", "artCopyPath", "artNoPreview"):
        assert src.count(k + ":") >= 2, f"i18n key {k} missing EN/FR"


def test_composer_prompt_box(js, html, css):
    """Composer = one wide rounded card: the prompt on top, and a utility tray
    below with [+], the model chip and the agent chip (both dropdowns), plus a
    high-contrast squircle action button on the right."""
    for c in ("composer-left", "composer-right", "agent-picker-btn",
              "agent-picker-label", "agent-list", "chip-ic", "chip-cv"):
        assert c in html, f"missing {c} in index.html"
    assert html.count('class="composer-attach-btn"') == 1
    assert 'id="btn-shot"' not in html
    assert 'id="composer"' in html and 'id="agentSwitch"' in html
    # Build/Plan is a dropdown built by buildAgentSwitch, not a segmented row
    assert 'className = "model-picker-item"' in js
    assert "function closeMenus" in js and "function setMenuOpen(open, which)" in js
    assert 'setMenuOpen($("agent-list").classList.contains("hidden"), "agent")' in js
    assert 'closest(".model-picker-wrap")' in js
    # the model picker moved out of the top bar and into the composer
    assert html.index('id="model-picker"') > html.index('id="composer"')
    assert "vertex-indicator" not in html
    # styling: column card, tray row, light squircle action
    assert "flex-direction: column !important" in css
    assert ".composer-left" in css and ".composer-right" in css
    assert "border-radius: 16px" in css
    assert "#ECECEE" in css and ".stop-btn span { display: none; }" in css


def test_settings_four_grouped_tabs(html, js, css):
    """The modal is regrouped into 4 high-level tabs; each tab hosts one or
    more of the independent section loaders (models/agents/memory/...)."""
    tabs = re.findall(r'class="nav-item settings-nav[^"]*" data-tab="([^"]+)"', html)
    assert tabs == ["general", "ai", "security", "system"], tabs
    panels = re.findall(r'class="ins-panel[^"]*" data-panel="([^"]+)"', html)
    assert panels == ["general", "ai", "security", "system"], panels
    assert "const TAB_SECTIONS" in js and "function ensureSection" in js
    assert "TAB_SECTIONS[tab] || [tab]" in js
    for sec in ("sec-models", "sec-agents", "sec-memory", "sec-perms",
                "sec-mcp", "sec-config", "sec-about"):
        assert f'id="{sec}"' in html, f"missing section body #{sec}"
    # section bodies render inside the panel of their group
    src = read("i18n.js")
    for k in ("navGeneral", "navAi", "navSecurity", "navSystem"):
        assert src.count(k + ":") >= 2, f"i18n key {k} missing EN/FR"


def test_composer_menus_robust(js, css):
    """The model/agent popovers escape the composer and chat view: they are
    re-parented onto <body> and positioned from measured geometry, so no
    ancestor clip/opacity/transform can cut them off or let the page show
    through the panel (text-bleed + vertical-clipping bug class)."""
    assert "function placeMenu" in js
    assert "function menuOrigin" in js and "function uiZoom" in js
    assert "document.body.appendChild(ml)" in js
    for prop in ("visLeft", "visTop", "offsetWidth", "offsetHeight"):
        assert prop in js, f"placeMenu never computes {prop}"
    assert 'closest(".model-picker-menu")' in js
    m = re.search(r"\.model-picker-menu \{(.*?)\}", css, re.S)
    assert m, ".model-picker-menu rule missing"
    block = m.group(1)
    assert "position: fixed" in block
    assert "padding: 12px" in block
    assert "min-width: 260px" in block
    assert "background: #17171a" in block, "menu background must be opaque"
    assert "z-index" in block
    it = re.search(r"\.model-picker-item \{(.*?)\}", css, re.S)
    assert it, ".model-picker-item rule missing"
    assert "white-space: normal" in it.group(1)
    assert "overflow-wrap: anywhere" in it.group(1)
    small = re.search(r"\.model-picker-item small \{(.*?)\}", css, re.S)
    assert small and "white-space: normal" in small.group(1), \
        "menu descriptions must wrap instead of clipping"


def test_theme_gallery_reference_thumbnails(js, css):
    """Gallery cards mirror the reference settings dashboard thumbnail: a mini
    window pinned top-right, two bars, an accent dot bottom-left, then the
    name and an apply action below."""
    assert "function hexA(" in js
    for cls in ("theme-card-preview", "theme-preview-window", "theme-preview-bar",
                "theme-preview-accent", "theme-card-name", "theme-apply-btn"):
        assert cls in js, f"missing .{cls} in the gallery markup"
        assert "." + cls in css, f"missing .{cls} rule"
    assert 'data-i18n="applyTheme"' in js
    assert ".theme-gallery { display: grid" in css
    assert "minmax(120px, 1fr)" in css
    m = re.search(r"\.theme-preview-window \{(.*?)\}", css, re.S)
    assert m, ".theme-preview-window rule missing"
    assert "left: 34%" in m.group(1) and "height: 54%" in m.group(1)
    assert read("i18n.js").count("applyTheme:") >= 2


def test_permissions_grouped_and_provider_status(js, css, html):
    """Permissions are bucketed into categories with a sticky save bar, and
    each provider card carries a key status chip + an add-key shortcut."""
    assert "permCat_" in js, "permissions not bucketed into categories"
    assert ".settings-content .perm-group-h" in css
    assert "sticky-actions" in html
    assert ".settings-content .sticky-actions" in css and "position: sticky" in css
    assert "prov-status" in js and ".settings-content .prov-status" in css
    assert ".prov-status.on" in css
    assert "focusKeyForm" in js and 'T("noKeyLabel")' in js
    src = read("i18n.js")
    for k in ("permCat_files", "permCat_shell", "permCat_web", "permCat_other"):
        assert src.count(k + ":") >= 2, f"i18n key {k} missing EN/FR"
