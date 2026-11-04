[CmdletBinding()]
param(
    [ValidateSet('main', 'pr')][string]$Source = 'main',
    [ValidateRange(1, 999999)][int]$PrNumber = 1,
    [Parameter(Mandatory = $true)][string]$ApiPath,
    [Parameter(Mandatory = $true)][string]$SessionDir,
    [switch]$StartDocker
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

New-Item -ItemType Directory -Force -Path $SessionDir | Out-Null
$logPath = Join-Path $SessionDir 'launcher.log'
$statusPath = Join-Path $SessionDir 'status.json'
$script:apiPid = 0
$script:frontPid = 0
$script:workingDir = ''
$script:sha = ''
$script:message = 'Preparando...'

function Write-Log([string]$message) {
    $line = ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $message)
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}
function Save-Status([string]$status, [string]$message) {
    $script:message = $message
    $data = [ordered]@{
        status = $status; message = $message
        apiPid = $script:apiPid; frontPid = $script:frontPid
        frontendDir = $script:workingDir; commit = $script:sha
        url = 'http://127.0.0.1:5173/'
    }
    $json = ConvertTo-Json -InputObject $data -Compress
    $temp = "$statusPath.tmp"
    [System.IO.File]::WriteAllText($temp, $json, (New-Object System.Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $statusPath) {
        [System.IO.File]::Delete($statusPath)
    }
    [System.IO.File]::Move($temp, $statusPath)
}
function Progress([string]$message) {
    Write-Log $message
    Save-Status 'working' $message
}
function Require-Command([string]$command, [string]$description) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$description nao encontrado. Instale e adicione ao PATH: $command"
    }
}
function Exec([string]$program, [string[]]$arguments, [string]$directory) {
    Push-Location -LiteralPath $directory
    try {
        Write-Log ('> {0} {1}' -f $program, ($arguments -join ' '))
        & $program @arguments 2>&1 | ForEach-Object {
            if ($_ -ne $null) {
                Add-Content -LiteralPath $logPath -Value ([string]$_) -Encoding UTF8
            }
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Comando falhou ($LASTEXITCODE): $program"
        }
    } finally {
        Pop-Location
    }
}
function Http-Ready([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -ne 200) { return $false }
        if ($url -like '*/api/health') {
            $body = $response.Content | ConvertFrom-Json
            return ($body.status -eq 'UP')
        }
        return $true
    } catch {
        return $false
    }
}
function Await-Ready([string]$url, [System.Diagnostics.Process]$process, [int]$attempts) {
    for ($i = 0; $i -lt $attempts; $i++) {
        if (Http-Ready $url) { return }
        if ($null -ne $process) {
            $process.Refresh()
            if ($process.HasExited) {
                throw 'O processo terminou antes de responder. Verifique o terminal aberto.'
            }
        }
        Start-Sleep -Seconds 2
    }
    throw "O servico nao respondeu em $url. Confira o terminal e a configuracao local."
}
function Start-Terminal([string]$directory, [string]$command, [string]$title) {
    Write-Log ("Abrindo terminal: " + $title)
    $proc = Start-Process -FilePath $env:ComSpec -WorkingDirectory $directory -ArgumentList @('/k', $command) -PassThru
    return $proc
}

try {
    Progress 'Verificando ferramentas e diretorios...'
    Require-Command 'git.exe' 'Git'
    Require-Command 'node.exe' 'Node.js 22+'
    Require-Command 'npm.cmd' 'npm'
    $nodeVersion = (& node.exe --version).TrimStart('v')
    if ([int]($nodeVersion.Split('.')[0]) -lt 22) {
        throw 'Este frontend requer Node.js 22 ou superior.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $ApiPath 'mvnw.cmd'))) {
        throw 'A pasta informada nao contem mvnw.cmd. Selecione a pasta BN-API-Central.'
    }

    $cacheRoot = Join-Path (Split-Path -Parent $SessionDir) '..\cache'
    $cacheRoot = [System.IO.Path]::GetFullPath($cacheRoot)
    $mirror = Join-Path $cacheRoot 'BN-user-interface.git'
    $versions = Join-Path $cacheRoot 'versions'
    New-Item -ItemType Directory -Path $cacheRoot, $versions -Force | Out-Null

    if (-not (Test-Path -LiteralPath (Join-Path $mirror 'HEAD'))) {
        Progress 'Clonando o repositorio do frontend no cache local...'
        Exec 'git.exe' @('clone', '--bare', 'https://github.com/FG-Interactive-Studios/BN-user-interface.git', $mirror) $cacheRoot
    }

    $ref = 'refs/heads/main'
    $label = 'main'
    if ($Source -eq 'pr') {
        $ref = "refs/pull/$PrNumber/head"
        $label = "pr-$PrNumber"
    }
    Progress "Buscando a versao atual de $label no GitHub..."
    Exec 'git.exe' @('--git-dir', $mirror, 'fetch', '--no-tags', 'origin', $ref) $cacheRoot
    $script:sha = (& git.exe --git-dir $mirror rev-parse 'FETCH_HEAD').Trim()
    if ($LASTEXITCODE -ne 0 -or $script:sha -notmatch '^[a-f0-9]{40}$') {
        throw 'Nao foi possivel identificar o commit da versao.'
    }
    $shortSha = $script:sha.Substring(0, 10)
    $script:workingDir = Join-Path $versions "$label-$shortSha"
    if (-not (Test-Path -LiteralPath $script:workingDir)) {
        Progress "Preparando uma pasta separada para $label ($shortSha)..."
        Exec 'git.exe' @('--git-dir', $mirror, 'worktree', 'add', '--detach', $script:workingDir, $script:sha) $cacheRoot
    } else {
        $currentSha = (& git.exe -C $script:workingDir rev-parse 'HEAD').Trim()
        if ($LASTEXITCODE -ne 0 -or $currentSha -ne $script:sha) {
            throw 'A pasta da versao ja existe com outro commit. Nao sera sobrescrita.'
        }
    }
    Save-Status 'working' 'Versao preparada'

    $apiHealthy = Http-Ready 'http://127.0.0.1:8080/api/health'
    if ($apiHealthy) {
        Write-Log 'API local ja esta disponivel em 8080. Nao sera reiniciada.'
    } else {
        if ($StartDocker) {
            Require-Command 'docker.exe' 'Docker Desktop'
            Progress 'Iniciando o PostgreSQL com docker compose up -d (sem apagar dados)...'
            Exec 'docker.exe' @('compose', 'up', '-d') $ApiPath
        }
        Require-Command 'java.exe' 'Java 21'
        $javaInfo = (& java.exe --version | Out-String)
        if ($javaInfo -notmatch '(?m)^(openjdk|java) 21([.\s]|$)') {
            throw 'A API requer Java 21 no PATH.'
        }
        $env:REALTIME_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
        Progress 'Iniciando a API Java no perfil local...'
        $apiProcess = Start-Terminal $ApiPath 'call ".\mvnw.cmd" spring-boot:run -Dspring-boot.run.profiles=local' 'API'
        $script:apiPid = $apiProcess.Id
        Save-Status 'working' 'Aguardando API'
        Await-Ready 'http://127.0.0.1:8080/api/health' $apiProcess 150
        Write-Log 'API pronta em http://127.0.0.1:8080'
    }

    if (Http-Ready 'http://127.0.0.1:5173/') {
        throw 'A porta 5173 ja esta ocupada por um frontend. Feche a instancia anterior antes de trocar de PR.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $script:workingDir 'node_modules'))) {
        Progress 'Instalando as dependencias da versao selecionada com npm ci...'
        Exec 'npm.cmd' @('ci', '--no-audit', '--no-fund') $script:workingDir
    }
    $env:VITE_API_URL = '/api'
    $env:VITE_WS_URL = 'ws://127.0.0.1:5173/ws'
    Progress 'Iniciando a interface web...'
    $frontProcess = Start-Terminal $script:workingDir 'call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort' 'Frontend'
    $script:frontPid = $frontProcess.Id
    Save-Status 'working' 'Aguardando interface web'
    Await-Ready 'http://127.0.0.1:5173/' $frontProcess 60
    Write-Log "Pronto: $label, commit $shortSha"
    Save-Status 'ready' "Pronto para testar $label ($shortSha)"
} catch {
    Write-Log ("ERRO: " + $_.Exception.Message)
    Save-Status 'failed' $_.Exception.Message
    exit 1
}
