param([string]$Title = "Vexis", [string]$Message = "")

$ErrorActionPreference = "SilentlyContinue"
$aumid = "Vexis.App"
$lnk = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Vexis.lnk"

$cs = @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class VexisLnk {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    class ShellLink { }

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLinkW {
        void GetPath(StringBuilder f, int c, IntPtr fd, uint fl);
        void GetIDList(out IntPtr p);
        void SetIDList(IntPtr p);
        void GetDescription(StringBuilder s, int c);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetWorkingDirectory(StringBuilder s, int c);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetArguments(StringBuilder s, int c);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetHotkey(out ushort h);
        void SetHotkey(ushort h);
        void GetShowCmd(out int c);
        void SetShowCmd(int c);
        void GetIconLocation(StringBuilder s, int c, out int i);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string s, int i);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string s, IntPtr r);
        void Resolve(IntPtr w, uint f);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string s);
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        void GetCount(out uint c);
        void GetAt(uint i, out IntPtr k);
        void GetValue(ref PropertyKey k, out PropVariant v);
        void SetValue(ref PropertyKey k, ref PropVariant v);
        void Commit();
    }

    [ComImport, Guid("0000010B-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPersistFile {
        void GetClassID(out Guid clsid);
        void IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string f, uint mode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string f, [MarshalAs(UnmanagedType.Bool)] bool remember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string f);
        void GetCurFile(out IntPtr f);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid fmtid; public uint pid; }

    [StructLayout(LayoutKind.Sequential)]
    struct PropVariant { public ushort vt; public ushort a, b, c; public IntPtr p; public IntPtr p2; }

    public static void Create(string lnkPath, string target, string workDir, string icon, string aumid) {
        object o = new ShellLink();
        try {
            IShellLinkW link = (IShellLinkW)o;
            link.SetPath(target);
            link.SetArguments("");
            link.SetWorkingDirectory(workDir);
            link.SetDescription("Vexis - AI workspace");
            if (icon != null && icon.Length > 0) link.SetIconLocation(icon, 0);
            IPropertyStore store = (IPropertyStore)o;
            PropertyKey key = new PropertyKey();
            key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
            key.pid = 5;
            PropVariant pv = new PropVariant();
            pv.vt = 31; // VT_LPWSTR
            pv.p = Marshal.StringToCoTaskMemUni(aumid);
            store.SetValue(ref key, ref pv);
            store.Commit();
            Marshal.FreeCoTaskMem(pv.p);
            IPersistFile file = (IPersistFile)o;
            file.Save(lnkPath, true);
        } finally {
            Marshal.ReleaseComObject(o);
        }
    }
}
"@

# one-time: Start Menu shortcut with our AppUserModelID (toasts show "Vexis")
$stamp = Join-Path $env:LOCALAPPDATA "Vexis\aumid.v2.ok"
$need = -not ((Test-Path $lnk) -and (Test-Path $stamp))
if ($need) {
    Remove-Item $lnk -Force -ErrorAction SilentlyContinue
    try {
        Add-Type -TypeDefinition $cs -ErrorAction Stop
        $icon = Join-Path $PSScriptRoot "vendor\vertex\images\vertex-darkmode.png"
        [VexisLnk]::Create($lnk, (Join-Path $PSScriptRoot "run.bat"), $PSScriptRoot, $icon, $aumid)
        New-Item -ItemType File -Path $stamp -Force | Out-Null
        Start-Sleep -Milliseconds 800
        $need = $false
    } catch {}
}

try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $t = [System.Security.SecurityElement]::Escape($Title)
    $m = [System.Security.SecurityElement]::Escape($Message)
    $xmlText = "<toast><visual><binding template=`"ToastGeneric`"><text>$t</text><text>$m</text></binding></visual><audio src=`"ms-winsoundevent:Notification.Default`"/></toast>"
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($xmlText)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    if (-not $need) {
        try {
            $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($aumid)
            $notifier.Show($toast)
            exit 0
        } catch {}
    }
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier()
    $notifier.Show($toast)
} catch {}
