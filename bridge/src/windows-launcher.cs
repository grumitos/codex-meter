using System;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Codex Meter")]
[assembly: AssemblyDescription("Codex Meter private LAN controller")]
[assembly: AssemblyCompany("Codex Meter")]
[assembly: AssemblyProduct("Codex Meter")]
[assembly: AssemblyVersion("1.1.3.0")]
[assembly: AssemblyFileVersion("1.1.3.0")]

internal static class Launcher
{
    private const string ControllerResource = "CodexMeter.Controller";
    private const string PairingPage = "http://localhost:4318/";
    private const string SingleInstanceName = "Local\\CodexMeter.Controller";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (Array.IndexOf(args, "--self-test") >= 0)
                return RunSelfTest(args);

            bool ownsInstance;
            using (var singleInstance = new Mutex(true, SingleInstanceName, out ownsInstance))
            {
                if (!ownsInstance)
                {
                    OpenPairingPage();
                    return 0;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (var controller = StartController(args))
                using (var tray = new TrayContext(controller))
                {
                    Application.Run(tray);
                }
                singleInstance.ReleaseMutex();
            }
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Codex Meter needs Node.js 22 or newer and an authenticated Codex CLI.\n\n" + error.Message,
                "Codex Meter",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static int RunSelfTest(string[] args)
    {
        using (var process = StartController(args))
        {
            if (!process.WaitForExit(30000))
            {
                process.Kill();
                throw new TimeoutException("Controller self-test timed out.");
            }
            return process.ExitCode;
        }
    }

    private static Process StartController(string[] args)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "node.exe",
            Arguments = BuildArguments(args),
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        startInfo.EnvironmentVariables["CODEX_METER_RUN"] = "1";
        startInfo.EnvironmentVariables["CODEX_METER_PARENT_PID"] =
            Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture);

        var process = Process.Start(startInfo);
        using (var controller = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream(ControllerResource))
        {
            if (controller == null)
                throw new InvalidOperationException("Missing controller resource.");
            controller.CopyTo(process.StandardInput.BaseStream);
            process.StandardInput.Close();
        }
        return process;
    }

    internal static void OpenPairingPage()
    {
        Process.Start(new ProcessStartInfo(PairingPage) { UseShellExecute = true });
    }

    private static string BuildArguments(string[] args)
    {
        var command = new StringBuilder("-");
        foreach (var argument in args)
            command.Append(' ').Append(Quote(argument));
        return command.ToString();
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}

internal sealed class TrayContext : ApplicationContext, IDisposable
{
    private const string StatusEndpoint = "http://127.0.0.1:4318/status";
    private readonly Process controller;
    private readonly NotifyIcon tray;
    private readonly Control dispatcher;
    private readonly System.Windows.Forms.Timer statusTimer;
    private readonly Icon whiteIcon;
    private readonly Icon blackIcon;
    private readonly TrayText text;
    private bool polling;
    private bool closing;
    private bool disposed;

    internal TrayContext(Process controllerProcess)
    {
        controller = controllerProcess;
        text = TrayText.ForCurrentLanguage();
        dispatcher = new Control();
        var unusedHandle = dispatcher.Handle;
        whiteIcon = LoadIcon("CodexMeter.TrayWhite");
        blackIcon = LoadIcon("CodexMeter.TrayBlack");

        var menu = new ContextMenuStrip();
        menu.Items.Add(text.Exit, null, delegate { Application.ExitThread(); });

        tray = new NotifyIcon
        {
            ContextMenuStrip = menu,
            Text = text.Checking,
            Visible = true,
        };
        ApplyTheme();
        tray.MouseClick += OnTrayClick;
        SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;

        controller.EnableRaisingEvents = true;
        controller.Exited += OnControllerExited;

        statusTimer = new System.Windows.Forms.Timer { Interval = 2000 };
        statusTimer.Tick += PollStatus;
        statusTimer.Start();
    }

    private static Icon LoadIcon(string resourceName)
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
        {
            if (stream == null)
                throw new InvalidOperationException("Missing tray icon resource.");
            using (var source = new Icon(stream, SystemInformation.SmallIconSize))
                return (Icon)source.Clone();
        }
    }

    private void OnTrayClick(object sender, MouseEventArgs eventArgs)
    {
        if (eventArgs.Button == MouseButtons.Left)
            Launcher.OpenPairingPage();
    }

    private async void PollStatus(object sender, EventArgs eventArgs)
    {
        if (polling || closing) return;
        polling = true;
        try
        {
            var connected = await Task.Run(new Func<bool?>(ReadConnectionStatus));
            if (connected.HasValue && !closing)
                tray.Text = connected.Value ? text.Connected : text.Disconnected;
        }
        finally
        {
            polling = false;
        }
    }

    private static bool? ReadConnectionStatus()
    {
        try
        {
            var request = WebRequest.CreateHttp(StatusEndpoint);
            request.Proxy = null;
            request.KeepAlive = false;
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                if (response.StatusCode != HttpStatusCode.OK) return null;
                return reader.ReadToEnd().IndexOf("\"connected\":true", StringComparison.Ordinal) >= 0;
            }
        }
        catch
        {
            return null;
        }
    }

    private void OnUserPreferenceChanged(object sender, UserPreferenceChangedEventArgs eventArgs)
    {
        if (!closing && !dispatcher.IsDisposed)
            dispatcher.BeginInvoke(new MethodInvoker(ApplyTheme));
    }

    private void ApplyTheme()
    {
        tray.Icon = UsesLightSystemTheme() ? blackIcon : whiteIcon;
    }

    private static bool UsesLightSystemTheme()
    {
        using (var key = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
        {
            return Convert.ToInt32(key == null ? 0 : key.GetValue("SystemUsesLightTheme", 0)) != 0;
        }
    }

    private void OnControllerExited(object sender, EventArgs eventArgs)
    {
        if (!closing && !dispatcher.IsDisposed)
            dispatcher.BeginInvoke(new MethodInvoker(Application.ExitThread));
    }

    protected override void ExitThreadCore()
    {
        closing = true;
        statusTimer.Stop();
        tray.Visible = false;
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !disposed)
        {
            disposed = true;
            SystemEvents.UserPreferenceChanged -= OnUserPreferenceChanged;
            controller.Exited -= OnControllerExited;
            statusTimer.Dispose();
            tray.Dispose();
            whiteIcon.Dispose();
            blackIcon.Dispose();
            dispatcher.Dispose();
        }
        base.Dispose(disposing);
    }
}

internal sealed class TrayText
{
    internal readonly string Checking;
    internal readonly string Connected;
    internal readonly string Disconnected;
    internal readonly string Exit;

    private TrayText(string checking, string connected, string disconnected, string exit)
    {
        Checking = "Codex Meter · " + checking;
        Connected = "Codex Meter · " + connected;
        Disconnected = "Codex Meter · " + disconnected;
        Exit = exit;
    }

    internal static TrayText ForCurrentLanguage()
    {
        switch (CultureInfo.CurrentUICulture.TwoLetterISOLanguageName)
        {
            case "es": return new TrayText("Comprobando conexión", "Conectado", "Desconectado", "Salir");
            case "pt": return new TrayText("Verificando conexão", "Conectado", "Desconectado", "Sair");
            case "fr": return new TrayText("Vérification", "Connecté", "Déconnecté", "Quitter");
            case "de": return new TrayText("Verbindung wird geprüft", "Verbunden", "Getrennt", "Beenden");
            case "ja": return new TrayText("接続を確認中", "接続済み", "未接続", "終了");
            case "ko": return new TrayText("연결 확인 중", "연결됨", "연결 안 됨", "종료");
            case "zh": return new TrayText("正在检查连接", "已连接", "未连接", "退出");
            default: return new TrayText("Checking connection", "Connected", "Disconnected", "Exit");
        }
    }
}
