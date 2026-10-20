# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app_desktop.py'],
    pathex=[],
    binaries=[],
    datas=[('index.html', 'vexis_ui'), ('styles.css', 'vexis_ui'), ('app.js', 'vexis_ui'), ('i18n.js', 'vexis_ui'), ('vendor', 'vexis_ui/vendor'), ('toast.ps1', 'vexis_ui'), ('logo.ico', 'vexis_ui')],
    hiddenimports=['engine_updater', 'server'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Vexis',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['logo.ico'],
)
