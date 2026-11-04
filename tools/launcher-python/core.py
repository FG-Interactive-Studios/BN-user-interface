"""GitHub PR discovery and isolated local execution for Batalha Naval.

Standard library only. Tkinter lives in gui.py; this module is testable headlessly.
"""
from __future__ import annotations

import collections
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

OWNER = "FG-Interactive-Studios"
REPOSITORIES = {
    "front": f"{OWNER}/BN-user-interface",
    "api": f"{OWNER}/BN-API-Central",
}
GAME_URL = "http://127.0.0.1:5173/"
API_HEALTH_URL = "http://127.0.0.1:8080/api/health"
DEFAULT_ROOT = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".local" / "share") / "BatalhaNavalLauncherPython"


class LauncherError(RuntimeError):
    """Expected, user-visible failure."""


class Cancelled(LauncherError):
    pass


@dataclass(frozen=True)
class Version:
    repo: str
    kind: str  # main or pr
    number: int = 0
    title: str = "main"
    author: str = ""
    draft: bool = False
    from_fork: bool = False

    @property
    def label(self) -> str:
        if self.kind == "main":
            return "main — versão principal"
        suffix = "  [RASCUNHO]" if self.draft else ""
        return f"#{self.number} · {self.title}  (@{self.author}){suffix}"

    @property
    def ref(self) -> str:
        if self.kind == "main":
            return "refs/heads/main"
        if self.kind != "pr" or not (1 <= self.number <= 999999999):
            raise LauncherError("Seleção de PR inválida.")
        return f"refs/pull/{self.number}/head"

    @property
    def slug(self) -> str:
        return "main" if self.kind == "main" else f"pr-{self.number}"


def main_version(repo: str) -> Version:
    return Version(repo=repo, kind="main")


def github_versions(repo: str, opener=urllib.request.urlopen) -> list[Version]:
    """Fetch current open PRs. No PR numbers or branch names are hardcoded."""
    if repo not in REPOSITORIES.values():
        raise LauncherError("Repositório desconhecido.")
    results = [main_version(repo)]
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "BatalhaNaval-Python-GUI-Launcher",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    for page in range(1, 11):
        url = (f"https://api.github.com/repos/{repo}/pulls?state=open"
               f"&sort=updated&direction=desc&per_page=100&page={page}")
        try:
            with opener(urllib.request.Request(url, headers=headers), timeout=15) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 429):
                raise LauncherError("Limite de consultas do GitHub atingido. Tente novamente ou configure GITHUB_TOKEN.") from exc
            raise LauncherError(f"GitHub respondeu HTTP {exc.code}.") from exc
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise LauncherError(f"Não foi possível consultar o GitHub: {exc}") from exc
        if not isinstance(payload, list):
            raise LauncherError("Resposta inesperada na lista de PRs do GitHub.")
        for pr in payload:
            try:
                number = int(pr["number"])
                title = " ".join(str(pr.get("title") or "Sem título").split())[:120]
                author = str((pr.get("user") or {}).get("login") or "desconhecido")
                upstream = ((pr.get("head") or {}).get("repo") or {}).get("full_name")
                results.append(Version(repo, "pr", number, title, author, bool(pr.get("draft")), upstream != repo))
            except (KeyError, TypeError, ValueError):
                continue
        if len(payload) < 100:
            break
    return results


def port_busy(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def api_healthy() -> bool:
    try:
        with urllib.request.urlopen(API_HEALTH_URL, timeout=1.5) as response:
            if response.status != 200:
                return False
            body = json.load(response)
            return isinstance(body, dict) and body.get("status") == "UP"
    except (OSError, ValueError, urllib.error.URLError, TimeoutError):
        return False


def frontend_healthy() -> bool:
    try:
        with urllib.request.urlopen(GAME_URL, timeout=1.5) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError, TimeoutError):
        return False


def terminate_tree(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    if os.name == "nt":
        # On Windows npm.cmd/mvnw.cmd may spawn cmd.exe children.
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                       capture_output=True, timeout=12, check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=3)
        except (ProcessLookupError, PermissionError, subprocess.TimeoutExpired):
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass


class Engine:
    def __init__(self, root: Path, emit: Callable[[str], None] = print):
        self.root = Path(root).expanduser().resolve()
        self.emit = emit
        self.cancel = threading.Event()
        self.processes: dict[str, subprocess.Popen] = {}
        self.reused_api = False
        self.lock = threading.RLock()
        self.root.mkdir(parents=True, exist_ok=True)
        self.log_path = self.root / "launcher.log"

    def log(self, message: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {message}"
        with self.lock:
            with self.log_path.open("a", encoding="utf-8") as stream:
                stream.write(line + "\n")
        self.emit(line)

    def check_cancel(self) -> None:
        if self.cancel.is_set():
            raise Cancelled("Operação cancelada pelo usuário.")

    def require(self, tool: str, label: str) -> str:
        path = shutil.which(tool)
        if not path:
            raise LauncherError(f"{label} não encontrado. Instale e adicione ao PATH: {tool}")
        return path

    @staticmethod
    def spawn(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> subprocess.Popen:
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        # Windows automatically dispatches .cmd/.bat files through cmd.exe.
        # Do not wrap an already-quoted list2cmdline() string inside /c:
        # it becomes \\"C:\\path with spaces\\mvnw.cmd\\" and fails to execute.
        # Passing the argument list directly keeps one round of Windows quoting
        # and lets taskkill /T terminate the resulting subprocess tree.
        return subprocess.Popen(command, cwd=str(cwd), env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                encoding="utf-8", errors="replace", bufsize=1,
                                creationflags=flags,
                                start_new_session=(os.name != "nt"))

    def pipe_logs(self, proc: subprocess.Popen, prefix: str,
                  recent: collections.deque | None = None) -> None:
        def collect() -> None:
            assert proc.stdout is not None
            try:
                for line in proc.stdout:
                    message = line.rstrip("\r\n")
                    if recent is not None:
                        recent.append(message)
                    self.log(f"[{prefix}] {message}")
            finally:
                proc.stdout.close()
        threading.Thread(target=collect, name=f"logs-{prefix}", daemon=True).start()

    def command(self, args: list[str], cwd: Path, label: str,
                timeout: int = 240) -> str:
        self.check_cancel()
        self.log(f"{label}: iniciando comando...")
        recent: collections.deque[str] = collections.deque(maxlen=15)
        proc = self.spawn(args, cwd)
        self.pipe_logs(proc, label, recent)
        start = time.monotonic()
        try:
            while proc.poll() is None:
                self.check_cancel()
                if time.monotonic() - start > timeout:
                    raise LauncherError(f"{label} excedeu o tempo permitido. Veja os logs.")
                time.sleep(0.12)
            if proc.returncode != 0:
                tail = "\n".join(list(recent)[-5:])
                raise LauncherError(f"{label} falhou (código {proc.returncode}).\n{tail}")
            return "\n".join(recent)
        except (Cancelled, LauncherError):
            terminate_tree(proc)
            raise

    def version_directory(self, key: str, version: Version) -> Path:
        if key not in REPOSITORIES or version.repo != REPOSITORIES[key]:
            raise LauncherError("Versão e repositório não correspondem.")
        git = self.require("git", "Git")
        bare = self.root / "git-cache" / f"{key}.git"
        bare.parent.mkdir(parents=True, exist_ok=True)
        if not (bare / "HEAD").is_file():
            if bare.exists():
                raise LauncherError(f"Cache de Git incompleto: {bare}. Não sobrescrevi seus arquivos.")
            self.log(f"Baixando {version.repo} (primeira utilização)...")
            self.command([git, "clone", "--bare", f"https://github.com/{version.repo}.git", str(bare)],
                         self.root, "git clone", timeout=480)
        self.log(f"Consultando {version.ref} em {version.repo}...")
        self.command([git, "--git-dir", str(bare), "fetch", "--no-tags", "origin", version.ref],
                     self.root, "git fetch", timeout=180)
        sha = subprocess.run([git, "--git-dir", str(bare), "rev-parse", "FETCH_HEAD"],
                             cwd=self.root, capture_output=True, text=True, timeout=15, check=True).stdout.strip()
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            raise LauncherError("O Git retornou um commit inválido.")
        target = self.root / "versions" / key / f"{version.slug}-{sha[:12]}"
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            head = subprocess.run([git, "-C", str(target), "rev-parse", "HEAD"],
                                  capture_output=True, text=True, timeout=15, check=False)
            if head.returncode != 0 or head.stdout.strip() != sha:
                raise LauncherError(f"Pasta de versão já existe com outro conteúdo: {target}")
        else:
            self.command([git, "--git-dir", str(bare), "worktree", "add", "--detach", str(target), sha],
                         self.root, "git worktree", timeout=120)
        self.log(f"{version.repo}: {version.slug} @ {sha[:12]}")
        return target

    def download(self, front: Version, api: Version) -> tuple[Path, Path]:
        self.require("git", "Git")
        front_path = self.version_directory("front", front)
        self.check_cancel()
        api_path = self.version_directory("api", api)
        return front_path, api_path

    def node_check(self) -> str:
        node = self.require("node", "Node.js 22+")
        npm = self.require("npm.cmd" if os.name == "nt" else "npm", "npm")
        version = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=12, check=True).stdout.strip()
        match = re.match(r"v(\d+)", version)
        if match is None or int(match.group(1)) < 22:
            raise LauncherError(f"É necessário Node.js 22 ou superior. Encontrado: {version}")
        return npm

    @staticmethod
    def docker_engine_mode(docker_bin: str) -> str | None:
        """Return the engine OS only when the Docker daemon is reachable."""
        try:
            result = subprocess.run(
                [docker_bin, "info", "--format", "{{.OSType}}"],
                capture_output=True, text=True, timeout=8, check=False,
            )
            if result.returncode == 0:
                mode = result.stdout.strip().lower()
                return mode if mode in ("linux", "windows") else None
        except (OSError, subprocess.TimeoutExpired):
            pass
        return None

    @staticmethod
    def docker_desktop_executable() -> Path | None:
        """Find Docker Desktop without modifying PATH, contexts or Windows services."""
        if os.name != "nt":
            return None
        roots = [os.environ.get("ProgramFiles"), os.environ.get("ProgramW6432"),
                 os.environ.get("LOCALAPPDATA")]
        paths = [Path(p) / "Docker" / "Docker" / "Docker Desktop.exe"
                 for p in roots[:2] if p]
        if roots[2]:
            paths += [
                Path(roots[2]) / "Programs" / "DockerDesktop" / "Docker Desktop.exe",
                Path(roots[2]) / "Docker" / "Docker Desktop.exe",
            ]
        return next((path for path in paths if path.is_file()), None)

    def ensure_docker_engine(self, docker_bin: str, timeout: int = 180) -> None:
        """Start Docker Desktop on Windows if needed, then wait for Linux containers."""
        mode = self.docker_engine_mode(docker_bin)
        if mode == "linux":
            self.log("Docker Engine Linux já está disponível.")
            return
        if mode == "windows":
            raise LauncherError(
                "O Docker está em modo Windows Containers. Abra o Docker Desktop, "
                "escolha 'Switch to Linux containers' e tente novamente."
            )
        if os.name != "nt":
            raise LauncherError(
                "Docker Engine não está respondendo. Inicie o daemon Docker "
                "e confirme com 'docker info' antes de executar o jogo."
            )
        executable = self.docker_desktop_executable()
        if executable is None:
            raise LauncherError(
                "Docker Engine não está disponível e o aplicativo Docker Desktop "
                "não foi encontrado nos locais habituais. Abra o Docker Desktop "
                "manualmente, aguarde o Engine iniciar e tente novamente. "
                "Para diagnosticar: docker info"
            )
        self.log("Docker Engine indisponível. Abrindo Docker Desktop automaticamente...")
        try:
            subprocess.Popen([str(executable)], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
        except OSError as exc:
            raise LauncherError(
                "Não foi possível abrir o Docker Desktop automaticamente. "
                "Abra-o pelo menu Iniciar e tente novamente."
            ) from exc
        self.log("Aguardando Docker Desktop e o Engine Linux ficarem prontos...")
        started = time.monotonic()
        last_update = started
        while time.monotonic() - started < timeout:
            self.check_cancel()
            mode = self.docker_engine_mode(docker_bin)
            if mode == "linux":
                self.log("Docker Engine Linux pronto.")
                return
            if mode == "windows":
                raise LauncherError(
                    "Docker Desktop iniciou em modo Windows Containers. "
                    "No menu do Docker Desktop escolha 'Switch to Linux containers' "
                    "e tente novamente."
                )
            if time.monotonic() - last_update >= 20:
                self.log("Docker Desktop ainda inicializando. Aguarde o Engine Linux...")
                last_update = time.monotonic()
            time.sleep(2)
        raise LauncherError(
            "Docker Desktop foi aberto, mas o Engine Linux não ficou pronto. "
            "Verifique se o Docker Desktop mostra 'Engine running' e está usando "
            "Linux Containers (WSL 2). Depois execute 'docker info' no terminal "
            "e tente novamente."
        )

    def java_check(self) -> None:
        java = self.require("java", "Java 21")
        response = subprocess.run([java, "-version"], capture_output=True, text=True, timeout=12, check=True)
        version = response.stderr + response.stdout
        match = re.search(r'(?:version\s+")?(\d+)(?:[.\s"]|$)', version)
        if not match or int(match.group(1)) != 21:
            raise LauncherError(f"A API exige Java 21. Encontrado: {version.splitlines()[0] if version else 'desconhecido'}")

    def wait(self, condition: Callable[[], bool], seconds: int, label: str,
             process: subprocess.Popen | None = None) -> None:
        started = time.monotonic()
        while time.monotonic() - started < seconds:
            self.check_cancel()
            if condition():
                self.log(f"{label}: pronto.")
                return
            if process is not None and process.poll() is not None:
                raise LauncherError(f"{label} terminou antes de ficar pronto. Confira os logs.")
            time.sleep(1)
        raise LauncherError(f"{label} não respondeu no tempo esperado. Confira os logs.")

    @staticmethod
    def inspect_existing_postgres(docker_bin: str) -> dict | None:
        """Inspect the fixed-name container without touching its data or state."""
        try:
            result = subprocess.run(
                [docker_bin, "container", "inspect", "batalha-naval-postgres"],
                capture_output=True, text=True, timeout=12, check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise LauncherError(
                "Não foi possível consultar o container PostgreSQL existente."
            ) from exc
        if result.returncode != 0:
            if "no such" in result.stderr.lower():
                return None
            raise LauncherError(
                "Docker não conseguiu verificar o container batalha-naval-postgres. "
                "Confira 'docker ps -a' antes de continuar."
            )
        try:
            payload = json.loads(result.stdout)
            if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
                raise ValueError("Resposta inesperada")
            return payload[0]
        except ValueError as exc:
            raise LauncherError("Docker retornou dados inválidos ao inspecionar o PostgreSQL.") from exc

    @staticmethod
    def check_existing_postgres_compatibility(info: dict) -> None:
        """Refuse to run the game against an unrelated or wrongly mapped DB."""
        config = info.get("Config") or {}
        image = str(config.get("Image") or "")
        env = {str(item) for item in (config.get("Env") or [])}
        ports = (info.get("HostConfig") or {}).get("PortBindings") or {}
        exposed = ports.get("5432/tcp") or []
        host_ports = {str(item.get("HostPort")) for item in exposed if isinstance(item, dict)}
        if not (image == "postgres:17"
                and "POSTGRES_DB=battleship" in env
                and "POSTGRES_USER=postgres" in env
                and "5432" in host_ports):
            raise LauncherError(
                "Já existe um container chamado batalha-naval-postgres, mas sua "
                "imagem, banco, usuário ou porta não corresponde ao ambiente "
                "esperado (postgres:17, battleship, postgres, 5432). "
                "Ele não será modificado. Verifique as configurações com "
                "'docker inspect batalha-naval-postgres'."
            )

    def start_postgres(self, docker_bin: str, api_path: Path) -> None:
        """Reuse an existing compatible named DB, avoiding Compose name collisions."""
        existing = self.inspect_existing_postgres(docker_bin)
        if existing is None:
            self.log("Nenhum container batalha-naval-postgres existente. Iniciando Compose...")
            self.command([docker_bin, "compose", "up", "-d"],
                         api_path, "Docker PostgreSQL", timeout=160)
            self.wait(lambda: self.postgres_ready(docker_bin, api_path), 90, "PostgreSQL")
            return
        self.check_existing_postgres_compatibility(existing)
        self.log(
            "Container batalha-naval-postgres já existe. "
            "Reutilizando o banco sem recriar, remover volumes ou executar compose up."
        )
        if not bool((existing.get("State") or {}).get("Running")):
            self.log("Container PostgreSQL estava parado; iniciando o existente...")
            self.command([docker_bin, "start", "batalha-naval-postgres"],
                         api_path, "Docker PostgreSQL existente", timeout=90)
        self.wait(lambda: self.postgres_ready(
            docker_bin, api_path, container_name="batalha-naval-postgres"
        ), 90, "PostgreSQL existente")
        self.log(
            "PostgreSQL existente está pronto. A API usará os dados atuais; "
            "o inicializador não fará reset do banco."
        )

    def launch(self, front_path: Path, api_path: Path, *, docker: bool,
               reuse_api: bool) -> None:
        self.check_cancel()
        npm = self.node_check()
        if port_busy(5173):
            raise LauncherError("Porta 5173 ocupada: encerre o frontend anterior antes de testar outra PR.")
        already_healthy = api_healthy()
        if already_healthy:
            if not reuse_api:
                raise LauncherError("Uma API já responde em :8080. Marque 'Reutilizar API ativa' ou encerre-a.")
            self.reused_api = True
            self.log("Reutilizando API na porta 8080. Atenção: não foi possível confirmar qual branch ela usa.")
        else:
            if port_busy(8080):
                raise LauncherError("Porta 8080 ocupada por serviço que não responde a /api/health.")
            if docker:
                docker_bin = self.require("docker", "Docker Desktop")
                self.ensure_docker_engine(docker_bin)
                self.start_postgres(docker_bin, api_path)
            self.java_check()
            mvnw = api_path / ("mvnw.cmd" if os.name == "nt" else "mvnw")
            if not mvnw.is_file():
                raise LauncherError("O wrapper Maven não existe no backend selecionado.")
            env = os.environ.copy()
            env["SPRING_PROFILES_ACTIVE"] = "local"
            env["REALTIME_ALLOWED_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
            # Use the inherited environment instead of a -Dname=value batch argument.
            # CMD may split unquoted arguments containing "=" when running .cmd files.
            cmd = [str(mvnw), "spring-boot:run"]
            if os.name != "nt":
                cmd = ["sh", *cmd]
            self.log("Iniciando API Java com banco local...")
            proc = self.spawn(cmd, api_path, env)
            self.processes["api"] = proc
            self.pipe_logs(proc, "API")
            self.wait(api_healthy, 240, "API", proc)
        if not (front_path / "package-lock.json").is_file():
            raise LauncherError("Frontend sem package-lock.json. Não executarei instalação não reproduzível.")
        if not (front_path / "node_modules").is_dir():
            self.command([npm, "ci", "--no-audit", "--no-fund"], front_path, "npm ci", timeout=420)
        self.check_cancel()
        env = os.environ.copy()
        env["VITE_API_URL"] = "/api"
        env["VITE_WS_URL"] = "ws://127.0.0.1:5173/ws"
        self.log("Iniciando frontend Vite em http://127.0.0.1:5173...")
        proc = self.spawn([npm, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], front_path, env)
        self.processes["front"] = proc
        self.pipe_logs(proc, "FRONT")
        self.wait(frontend_healthy, 75, "Frontend", proc)

    @staticmethod
    def postgres_ready(docker: str, api_path: Path, *, container_name: str | None = None) -> bool:
        """Check that the expected battleship DB accepts a real SQL query."""
        target = ([docker, "exec", container_name] if container_name else
                  [docker, "compose", "exec", "-T", "postgres"])
        try:
            ret = subprocess.run(
                [*target, "psql", "-U", "postgres", "-d", "battleship", "-Atqc", "SELECT 1"],
                cwd=api_path, capture_output=True, text=True, timeout=6, check=False
            )
            return ret.returncode == 0 and ret.stdout.strip() == "1"
        except (OSError, subprocess.TimeoutExpired):
            return False

    def stop(self) -> None:
        self.cancel.set()
        for key in ("front", "api"):
            process = self.processes.pop(key, None)
            if process is not None:
                self.log(f"Encerrando {key} iniciado por este launcher...")
                terminate_tree(process)
        if self.reused_api:
            self.log("API externa mantida em execução.")
        self.log("Processos do launcher encerrados; banco PostgreSQL preservado.")