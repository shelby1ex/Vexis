; Vexis installer — Inno Setup 7 (iscc Vexis.iss from the vexis\ folder).
; Payload: run  python package.py  first (builds dist\vexis-<version>\) and
; place redist\python-3.12.10-amd64.exe + redist\webview2boot.exe beside it.
; Keep MyAppVersion in sync with version.json (a test enforces this).
#define MyAppName "Vexis"
#define MyAppVersion "0.9.1"
#define MyAppPublisher "Vertexcorp"
#define Payload "dist\vexis-0.9.0"

[Setup]
AppId={{3F2A9C41-7B1E-4D8A-9E0C-VEXIS09000}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://vertexcorp.example.com
DefaultDirName={localappdata}\Vexis
DisableProgramGroupPage=yes
DisableDirPage=no
OutputDir=dist
OutputBaseFilename=VexisSetup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayName=Vexis
UninstallDisplayIcon={app}\vexis_ui\Vexis.exe
SetupIconFile=logo.ico
ArchitecturesAllowed=x64compatible
MinVersion=10.0

[Tasks]
Name: "desktopicon"; Description: "Desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "startmenu"; Description: "Start Menu folder (Vexis)"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "python"; Description: "Install Python 3.12 + dependencies (for run.bat fallback)"; Flags: checkedonce

[Files]
; Locked while running: restart-replace so updates never fail on a live exe.
Source: "{#Payload}\vexis_ui\Vexis.exe"; DestDir: "{app}\vexis_ui"; Flags: ignoreversion restartreplace
Source: "{#Payload}\.runtime\*.exe"; DestDir: "{app}\.runtime"; Flags: ignoreversion restartreplace
Source: "{#Payload}\*"; DestDir: "{app}"; Excludes: "vexis_ui\Vexis.exe,.runtime\*.exe"; Flags: ignoreversion recursesubdirs
Source: "redist\python-3.12.10-amd64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Tasks: python
Source: "redist\webview2boot.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2

[Icons]
Name: "{autodesktop}\Vexis"; Filename: "{app}\vexis_ui\Vexis.exe"; WorkingDir: "{app}\vexis_ui"; IconFilename: "{app}\vexis_ui\logo.ico"; Tasks: desktopicon
Name: "{autoprograms}\Vexis\Vexis"; Filename: "{app}\vexis_ui\Vexis.exe"; WorkingDir: "{app}\vexis_ui"; IconFilename: "{app}\vexis_ui\logo.ico"; Tasks: startmenu

[Run]
; WebView2 runtime (pywebview needs it). May request admin rights once.
Filename: "{tmp}\webview2boot.exe"; Parameters: "/silent /install"; StatusMsg: "Installing WebView2 runtime..."; Check: NeedsWebView2; Flags: runascurrentuser
; Python per-user, then the run.bat dependencies.
Filename: "{tmp}\python-3.12.10-amd64.exe"; Parameters: "/quiet InstallAllUsers=0 PrependPath=1 Include_test=0 SimpleInstall=1"; StatusMsg: "Installing Python 3.12..."; Tasks: python
Filename: "{localappdata}\Programs\Python\Python312\python.exe"; Parameters: "-m pip install pywebview Pillow pytest"; StatusMsg: "Installing Python packages..."; Tasks: python; Flags: runhidden
Filename: "{app}\vexis_ui\Vexis.exe"; Description: "Launch Vexis now"; Flags: postinstall nowait shellexec skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\.data"
Type: filesandordirs; Name: "{app}\vexis_ui\vexis_logs"

[Code]
{ Default install folder is %USERPROFILE%\Vexis (no built-in constant
  exists). Only overrides the default - an explicit /DIR= is respected. }
procedure InitializeWizard();
var
  Def: String;
begin
  Def := ExpandConstant('{localappdata}\Vexis');
  if WizardForm.DirEdit.Text = Def then
    WizardForm.DirEdit.Text := GetEnv('USERPROFILE') + '\Vexis';
end;
function NeedsWebView2(): Boolean;
var
  FindRec: TFindRec;
begin
  Result := True;
  if FindFirst(ExpandConstant('{pf32}\Microsoft\EdgeWebView\Application\msedgewebview2.exe'), FindRec) then
  begin
    FindClose(FindRec);
    Result := False;
    Exit;
  end;
  if FindFirst(ExpandConstant('{pf}\Microsoft\EdgeWebView\Application\msedgewebview2.exe'), FindRec) then
  begin
    FindClose(FindRec);
    Result := False;
  end;
end;
