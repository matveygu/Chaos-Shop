using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class RoomWindow : Form
{
    private readonly Label status = new Label();
    private readonly TextBox mine = new TextBox(), guest = new TextBox();
    private readonly Button start = new Button(), copyMine = new Button(), copyGuest = new Button();
    private readonly List<Process> children = new List<Process>();
    private readonly System.Windows.Forms.Timer timeout = new System.Windows.Forms.Timer();
    private readonly string directory = AppDomain.CurrentDomain.BaseDirectory;
    private CancellationTokenSource session;
    private IntPtr job;
    private string port, ownerCode, guestCode, health;
    private bool checking;

    [STAThread]
    private static void Main()
    {
        System.Net.ServicePointManager.SecurityProtocol = System.Net.SecurityProtocolType.Tls12;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new RoomWindow());
    }
    public RoomWindow()
    {
        Text = "Chaos Shop · Комната на двоих";
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(570, 295);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        AddLabel("Комната на твоём ПК", 18, true);
        AddLabel("Временная ссылка Cloudflare действует, пока открыто это окно.", 56, false);
        AddRow("Твоя ссылка для входа в магазин", mine, copyMine, 92);
        AddRow("Приглашение для друга", guest, copyGuest, 156);
        start.SetBounds(18, 240, 150, 34);
        start.Text = "Создать комнату";
        start.Click += delegate { if (session == null) StartRoom(); else StopRoom("Комната закрыта."); };
        Controls.Add(start);
        status.SetBounds(180, 236, 374, 52);
        status.TextAlign = ContentAlignment.MiddleLeft;
        Controls.Add(status);
        timeout.Interval = 90000;
        timeout.Tick += delegate { StopRoom("Не удалось открыть временный адрес. Проверь подключение и повтори."); };
        FormClosing += delegate { StopRoom(""); };
    }
    private void AddLabel(string caption, int top, bool title)
    {
        var label = new Label {Text = caption, AutoSize = true, Left = 18, Top = top};
        if (title) label.Font = new Font(Font.FontFamily, 17, FontStyle.Bold);
        Controls.Add(label);
    }
    private void AddRow(string caption, TextBox field, Button copy, int y)
    {
        AddLabel(caption, y, false);
        field.ReadOnly = true;
        field.SetBounds(18, y + 24, 414, 27);
        copy.SetBounds(440, y + 22, 112, 30);
        copy.Text = "Копировать";
        copy.Enabled = false;
        copy.Click += delegate {
            try { Clipboard.SetDataObject(field.Text, true, 3, 50); status.Text = "Ссылка скопирована."; }
            catch (ExternalException) { field.Focus(); field.SelectAll(); status.Text = "Нажми Ctrl+C, чтобы скопировать."; }
        };
        Controls.Add(field);
        Controls.Add(copy);
    }
    private void StartRoom()
    {
        session = new CancellationTokenSource();
        start.Text = "Закрыть комнату";
        status.Text = "Запускаю комнату…";
        timeout.Start();
        try {
            job = ChildJob.Open();
            Run("node.exe", "service/home.mjs", "Сервис комнаты", OnService);
        } catch (Exception e) { StopRoom(e.Message); }
    }
    private void OnService(string line)
    {
        if (line == "CLOSED") { StopRoom("Комната закрыта. Можно создать новую."); return; }
        var match = Regex.Match(line, @"^READY (\d{1,5}) ([A-F0-9]{10}) ([A-F0-9]{10}) ([a-f0-9]{32})$");
        if (!match.Success || port != null) return;
        port = match.Groups[1].Value;
        ownerCode = match.Groups[2].Value;
        guestCode = match.Groups[3].Value;
        health = match.Groups[4].Value;
        status.Text = "Получаю временный адрес…";
        try {
            Run("cloudflared.exe", "tunnel --config runtime/quick.yml --no-autoupdate --metrics 127.0.0.1:0 --url http://127.0.0.1:" + port,
                "Подключение Cloudflare", OnTunnel);
        } catch (Exception e) { StopRoom(e.Message); }
    }
    private void Run(string binary, string args, string label, Action<string> onLine)
    {
        var current = session;
        var info = new ProcessStartInfo(Path.Combine(directory, "runtime", binary), args) {
            WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        var child = new Process {StartInfo = info, EnableRaisingEvents = true};
        Action<Action> dispatch = action => {
            if (IsDisposed || !IsHandleCreated) return;
            try { BeginInvoke((Action)delegate { if (session == current) action(); }); }
            catch (InvalidOperationException) { }
        };
        DataReceivedEventHandler read = (source, data) => {
            if (data.Data != null) dispatch(() => onLine(data.Data));
        };
        child.OutputDataReceived += read;
        child.ErrorDataReceived += read;
        child.Exited += delegate { dispatch(() => StopRoom(label + " завершил работу. Создай комнату ещё раз.")); };
        try {
            child.Start();
            children.Add(child);
            ChildJob.Attach(job, child);
            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
        } catch {
            if (!children.Contains(child)) child.Dispose();
            throw;
        }
    }
    private async void OnTunnel(string line)
    {
        if (checking) return;
        var match = Regex.Match(line, @"https://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com(?=[\s/|]|$)");
        if (!match.Success) return;
        checking = true;
        string origin = match.Value;
        var token = session.Token;
        status.Text = "Проверяю доступность комнаты через интернет…";
        using (var client = new HttpClient(new HttpClientHandler {AllowAutoRedirect = false})) {
            client.Timeout = TimeSpan.FromSeconds(4);
            client.MaxResponseContentBufferSize = 16384;
            try {
                while (!token.IsCancellationRequested) {
                    try {
                        using (var response = await client.GetAsync(origin + "/health", token)) {
                            if (response.IsSuccessStatusCode && await response.Content.ReadAsStringAsync() == health && !token.IsCancellationRequested) {
                                mine.Text = origin + "/#join=" + ownerCode;
                                guest.Text = origin + "/#join=" + guestCode;
                                copyMine.Enabled = copyGuest.Enabled = true;
                                status.Text = "Готово. Вставьте свои ссылки в разделе «Комната на двоих».";
                                timeout.Stop();
                                return;
                            }
                        }
                    } catch (HttpRequestException) { }
                      catch (TaskCanceledException) { if (token.IsCancellationRequested) return; }
                    await Task.Delay(1200, token);
                }
            } catch (OperationCanceledException) { }
        }
    }
    private void StopRoom(string message)
    {
        timeout.Stop();
        if (session != null) { session.Cancel(); session.Dispose(); session = null; }
        if (job != IntPtr.Zero) { ChildJob.Close(job); job = IntPtr.Zero; }
        foreach (var child in children) {
            try { if (!child.HasExited) child.Kill(); } catch (InvalidOperationException) { }
              catch (System.ComponentModel.Win32Exception) { }
            child.Dispose();
        }
        children.Clear();
        port = ownerCode = guestCode = health = null;
        checking = false;
        mine.Clear(); guest.Clear();
        copyMine.Enabled = copyGuest.Enabled = false;
        start.Text = "Создать комнату";
        status.Text = message;
    }
}
