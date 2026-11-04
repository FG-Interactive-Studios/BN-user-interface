#Requires -Version 5.1
# Batalha Naval - local Windows GUI launcher for the frontend's open GitHub PRs.
# Uses only built-in Windows PowerShell 5.1 and Windows Forms.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$repository = 'FG-Interactive-Studios/BN-user-interface'
$script:stateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'BatalhaNavalLauncher'
$script:settingsPath = Join-Path $script:stateRoot 'settings.json'
$script:workerPath = Join-Path $PSScriptRoot 'BN-Launcher.Worker.ps1'
$script:sessionDir = ''
$script:workerProcess = $null
$script:lastLog = ''
$script:openedBrowser = $false
$script:lastStatus = $null

New-Item -Path $script:stateRoot -ItemType Directory -Force | Out-Null
if (-not (Test-Path -LiteralPath $script:workerPath)) {
    [System.Windows.Forms.MessageBox]::Show('Arquivo BN-Launcher.Worker.ps1 nao encontrado.', 'Batalha Naval')
    exit 1
}
function Ui-Font([int]$size, [bool]$bold = $false) {
    $style = [System.Drawing.FontStyle]::Regular
    if ($bold) { $style = [System.Drawing.FontStyle]::Bold }
    return (New-Object -TypeName System.Drawing.Font -ArgumentList @('Segoe UI', $size, $style))
}
function Ui-Label([string]$caption, [int]$x, [int]$y, [int]$w, [int]$h, [int]$size, [bool]$bold = $false) {
    $control = New-Object System.Windows.Forms.Label
    $control.Text = $caption
    $control.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @($x, $y)
    $control.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @($w, $h)
    $control.Font = Ui-Font $size $bold
    $control.ForeColor = [System.Drawing.Color]::FromArgb(220, 231, 238)
    $control.BackColor = [System.Drawing.Color]::Transparent
    return $control
}
function Ui-Button([string]$caption, [int]$x, [int]$y, [int]$w, [int]$h, [bool]$primary = $false) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $caption
    $button.Location = New-Object System.Drawing.Point($x, $y)
    $button.Size = New-Object System.Drawing.Size($w, $h)
    $button.Font = Ui-Font 10 $true
    $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $button.FlatAppearance.BorderSize = 1
    $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(112, 133, 148)
    $button.BackColor = [System.Drawing.Color]::FromArgb(28, 44, 56)
    $button.ForeColor = [System.Drawing.Color]::White
    if ($primary) {
        $button.BackColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
        $button.ForeColor = [System.Drawing.Color]::FromArgb(11, 16, 20)
    }
    return $button
}
function Show-Failure([string]$message) {
    [void][System.Windows.Forms.MessageBox]::Show($message, 'Batalha Naval', 'OK', 'Warning')
}
function Quote-Argument([string]$value) {
    return '"' + $value.Replace('"', '') + '"'
}
function Open-Website([string]$url) {
    [void][System.Diagnostics.Process]::Start($url)
}
function Save-Settings {
    $data = @{ ApiPath = $apiBox.Text; Docker = $dockerBox.Checked; OpenBrowser = $browserBox.Checked }
    [System.IO.File]::WriteAllText($script:settingsPath, ($data | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
}
function Get-Settings {
    if (-not (Test-Path -LiteralPath $script:settingsPath)) { return $null }
    try { return (Get-Content -LiteralPath $script:settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { return $null }
}
function Update-Status([string]$caption, [bool]$errorState = $false) {
    $statusLabel.Text = $caption
    if ($errorState) {
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
    } else {
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
    }
}
function Is-OwnedProcessActive([int]$pidValue) {
    if ($pidValue -le 0) { return $false }
    try { return ($null -ne (Get-Process -Id $pidValue -ErrorAction Stop)) }
    catch { return $false }
}
function Stop-OwnedProcesses {
    if ($null -ne $script:workerProcess) {
        try {
            $script:workerProcess.Refresh()
            if (-not $script:workerProcess.HasExited) {
                & taskkill.exe /PID $script:workerProcess.Id /T /F 2>&1 | Out-Null
            }
        } catch {}
    }
    if ($null -ne $script:lastStatus) {
        foreach ($property in @('frontPid', 'apiPid')) {
            $pidValue = [int]$script:lastStatus.$property
            if (Is-OwnedProcessActive $pidValue) {
                try { & taskkill.exe /PID $pidValue /T /F 2>&1 | Out-Null }
                catch {}
            }
        }
    }
    $script:lastStatus = $null
    $script:workerProcess = $null
    $startButton.Enabled = $true
    $stopButton.Enabled = $false
    $openButton.Enabled = $false
    Update-Status 'Processos do inicializador encerrados. O PostgreSQL foi preservado.'
}
function Refresh-PullRequests {
    $selected = $null
    if ($null -ne $versionBox.SelectedItem) { $selected = $versionBox.SelectedItem.Label }
    $refreshButton.Enabled = $false
    Update-Status 'Consultando as PRs abertas do GitHub...'
    $versionBox.BeginUpdate()
    try {
        $versionBox.Items.Clear()
        $main = [pscustomobject]@{ Label = 'main  |  versao principal'; Source = 'main'; Number = 0; Author = 'FG-Interactive-Studios'; IsExternal = $false }
        [void]$versionBox.Items.Add($main)
        $headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'BN-Windows-PR-Launcher'; 'X-GitHub-Api-Version' = '2022-11-28' }
        if ($env:GITHUB_TOKEN) { $headers.Authorization = 'Bearer ' + $env:GITHUB_TOKEN }
        $pulls = @()
        for ($page = 1; $page -le 10; $page++) {
            $uri = 'https://api.github.com/repos/' + $repository + '/pulls?state=open&sort=updated&direction=desc&per_page=100&page=' + $page
            $batch = @(Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 15)
            if ($batch.Count -eq 0) { break }
            $pulls += $batch
            if ($batch.Count -lt 100) { break }
        }
        foreach ($pr in $pulls) {
            $label = ('#{0} | {1} | @{2}' -f $pr.number, $pr.title, $pr.user.login)
            if ($pr.draft) { $label += ' [RASCUNHO]' }
            $entry = [pscustomobject]@{ Label = $label; Source = 'pr'; Number = [int]$pr.number; Author = [string]$pr.user.login; IsExternal = ($pr.head.repo.full_name -ne $repository) }
            [void]$versionBox.Items.Add($entry)
        }
        $versionBox.DisplayMember = 'Label'
        $versionBox.SelectedIndex = 0
        if ($null -ne $selected) {
            for ($index = 0; $index -lt $versionBox.Items.Count; $index++) {
                if ($versionBox.Items[$index].Label -eq $selected) { $versionBox.SelectedIndex = $index; break }
            }
        }
        Update-Status ('Encontradas {0} PR(s) aberta(s). Selecione uma versao.' -f $pulls.Count)
    } catch {
        if ($versionBox.Items.Count -gt 0) { $versionBox.SelectedIndex = 0 }
        Update-Status 'Nao foi possivel atualizar PRs. Verifique a conexao com GitHub.' $true
        Show-Failure ("Falha na consulta do GitHub: " + $_.Exception.Message)
    } finally {
        $versionBox.EndUpdate()
        $refreshButton.Enabled = $true
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Batalha Naval - Inicializador de PRs'
$form.ClientSize = New-Object -TypeName System.Drawing.Size -ArgumentList @(760, 635)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = [System.Drawing.Color]::FromArgb(11, 16, 20)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = Ui-Font 10 $false

$title = Ui-Label 'Batalha Naval' 24 16 520 41 23 $true
$title.ForeColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
$form.Controls.Add($title)
$form.Controls.Add((Ui-Label 'Teste qualquer PR sem alterar sua branch de desenvolvimento.' 25 61 700 27 10))
$form.Controls.Add((Ui-Label 'Versao do frontend' 24 103 270 25 10 $true))
$versionBox = New-Object System.Windows.Forms.ComboBox
$versionBox.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(24, 133)
$versionBox.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(710, 30)
$versionBox.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
$versionBox.Font = Ui-Font 10 $false
$versionBox.DisplayMember = 'Label'
$form.Controls.Add($versionBox)
$refreshButton = Ui-Button 'Atualizar PRs' 580 177 154 33
$form.Controls.Add($refreshButton)
$link = New-Object System.Windows.Forms.LinkLabel
$link.Text = 'Ver versao no GitHub'
$link.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(25, 182)
$link.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(210, 26)
$link.LinkColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
$link.ActiveLinkColor = [System.Drawing.Color]::White
$form.Controls.Add($link)

$form.Controls.Add((Ui-Label 'Pasta local da API (BN-API-Central)' 24 226 480 26 10 $true))
$apiBox = New-Object System.Windows.Forms.TextBox
$apiBox.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(24, 257)
$apiBox.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(604, 29)
$apiBox.Font = Ui-Font 10 $false
$form.Controls.Add($apiBox)
$browse = Ui-Button 'Procurar...' 639 255 95 31
$form.Controls.Add($browse)

$dockerBox = New-Object System.Windows.Forms.CheckBox
$dockerBox.Text = 'Iniciar PostgreSQL (Docker Compose)'
$dockerBox.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(24, 310)
$dockerBox.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(340, 28)
$dockerBox.Checked = $true
$form.Controls.Add($dockerBox)
$browserBox = New-Object System.Windows.Forms.CheckBox
$browserBox.Text = 'Abrir navegador quando estiver pronto'
$browserBox.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(390, 310)
$browserBox.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(344, 28)
$browserBox.Checked = $true
$form.Controls.Add($browserBox)

$startButton = Ui-Button 'Iniciar esta versao' 24 355 235 43 $true
$stopButton = Ui-Button 'Encerrar processos' 271 355 224 43
$openButton = Ui-Button 'Abrir jogo' 507 355 227 43
$stopButton.Enabled = $false
$openButton.Enabled = $false
$form.Controls.Add($startButton)
$form.Controls.Add($stopButton)
$form.Controls.Add($openButton)

$statusLabel = Ui-Label 'Preparando lista de PRs...' 24 409 710 27 10
$form.Controls.Add($statusLabel)
$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object -TypeName System.Drawing.Point -ArgumentList @(24, 444)
$logBox.Size = New-Object -TypeName System.Drawing.Size -ArgumentList @(710, 146)
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$logBox.BackColor = [System.Drawing.Color]::FromArgb(19, 35, 46)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(220, 231, 238)
$logBox.Font = New-Object -TypeName System.Drawing.Font -ArgumentList @('Consolas', 9)
$form.Controls.Add($logBox)
$form.Controls.Add((Ui-Label 'Cada PR roda em pasta propria. Nao usamos git reset nem apagamos o banco.' 24 599 712 27 9))

$settings = Get-Settings
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$defaultApi = Join-Path (Split-Path -Parent $projectRoot) 'BN-API-Central'
$apiBox.Text = $defaultApi
if ($null -ne $settings) {
    if ($settings.ApiPath) { $apiBox.Text = [string]$settings.ApiPath }
    $dockerBox.Checked = [bool]$settings.Docker
    $browserBox.Checked = [bool]$settings.OpenBrowser
}
$browse.Add_Click({
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Selecione a pasta do repositorio BN-API-Central'
    if (Test-Path -LiteralPath $apiBox.Text) { $picker.SelectedPath = $apiBox.Text }
    if ($picker.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
        $apiBox.Text = $picker.SelectedPath
        Save-Settings
    }
    $picker.Dispose()
})
$refreshButton.Add_Click({ Refresh-PullRequests })
$link.Add_LinkClicked({
    $selection = $versionBox.SelectedItem
    if ($null -eq $selection) { return }
    $url = 'https://github.com/' + $repository
    if ($selection.Source -eq 'pr') { $url += '/pull/' + $selection.Number }
    Open-Website $url
})
$openButton.Add_Click({ Open-Website 'http://127.0.0.1:5173/' })
$startButton.Add_Click({
    $selection = $versionBox.SelectedItem
    if ($null -eq $selection) { Show-Failure 'Selecione uma versao.'; return }
    $apiPath = $apiBox.Text.Trim()
    if (-not (Test-Path -LiteralPath (Join-Path $apiPath 'mvnw.cmd'))) {
        Show-Failure 'Selecione a pasta BN-API-Central, que deve conter mvnw.cmd.'
        return
    }
    if ($selection.Source -eq 'pr' -and $selection.IsExternal) {
        $answer = [System.Windows.Forms.MessageBox]::Show(
            'Esta PR pode incluir codigo de terceiros. npm ci executa scripts do projeto. Prossiga somente se confiar no autor. Continuar?',
            'Confirmar execucao de PR', 'YesNo', 'Warning'
        )
        if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    }
    Save-Settings
    $script:sessionDir = Join-Path $script:stateRoot ('sessions\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $script:sessionDir | Out-Null
    $script:lastLog = ''
    $script:lastStatus = $null
    $script:openedBrowser = $false
    $logBox.Text = ''
    $workerArgs = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', (Quote-Argument $script:workerPath),
        '-Source', [string]$selection.Source,
        '-PrNumber', [string]$selection.Number,
        '-ApiPath', (Quote-Argument $apiPath),
        '-SessionDir', (Quote-Argument $script:sessionDir)
    )
    if ($dockerBox.Checked) { $workerArgs += '-StartDocker' }
    try {
        $script:workerProcess = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList ($workerArgs -join ' ') -WindowStyle Hidden -PassThru
        $startButton.Enabled = $false
        $stopButton.Enabled = $true
        $openButton.Enabled = $false
        Update-Status 'Preparando a versao selecionada...'
    } catch {
        Show-Failure ('Nao foi possivel iniciar: ' + $_.Exception.Message)
    }
})
$stopButton.Add_Click({
    $choice = [System.Windows.Forms.MessageBox]::Show(
        'Encerrar a API e o frontend abertos por este inicializador? O banco de dados sera preservado.',
        'Encerrar servicos', 'YesNo', 'Question'
    )
    if ($choice -eq [System.Windows.Forms.DialogResult]::Yes) { Stop-OwnedProcesses }
})
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 800
$timer.Add_Tick({
    if (-not $script:sessionDir) { return }
    $path = Join-Path $script:sessionDir 'launcher.log'
    try {
        if (Test-Path -LiteralPath $path) {
            $data = Get-Content -LiteralPath $path -Raw -Encoding UTF8
            if ($data -ne $script:lastLog) {
                $script:lastLog = $data
                if ($data.Length -gt 13000) { $data = $data.Substring($data.Length - 13000) }
                $logBox.Text = $data
                $logBox.SelectionStart = $logBox.TextLength
                $logBox.ScrollToCaret()
            }
        }
        $statusPath = Join-Path $script:sessionDir 'status.json'
        if (-not (Test-Path -LiteralPath $statusPath)) { return }
        $status = Get-Content -LiteralPath $statusPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $script:lastStatus = $status
        switch ($status.status) {
            'ready' {
                Update-Status $status.message
                $stopButton.Enabled = $true
                $openButton.Enabled = $true
                if (-not $script:openedBrowser) {
                    $script:openedBrowser = $true
                    if ($browserBox.Checked) { Open-Website $status.url }
                }
            }
            'failed' {
                Update-Status ('Falha: ' + $status.message) $true
                $startButton.Enabled = $true
                $openButton.Enabled = $false
                $stopButton.Enabled = ([int]$status.apiPid -gt 0 -or [int]$status.frontPid -gt 0)
            }
            'working' { Update-Status $status.message }
        }
    } catch {
        # Status files are replaced as the worker progresses; retry on next tick.
    }
})
$form.Add_FormClosing({
    try { Save-Settings } catch {}
    $timer.Stop()
})
$timer.Start()
Refresh-PullRequests
[void][System.Windows.Forms.Application]::Run($form)
