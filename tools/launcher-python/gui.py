"""Windows-friendly Tkinter launcher. No pip install required."""
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from core import (API_HEALTH_URL, DEFAULT_ROOT, GAME_URL, REPOSITORIES,
                  Cancelled, Engine, LauncherError, Version, api_healthy,
                  github_versions, main_version)

BG = "#0b1014"
PANEL = "#15232d"
PANEL_ALT = "#1c303d"
LINE = "#334b58"
YELLOW = "#fbbf24"
TEXT = "#f4f7f9"
MUTED = "#a2b5bf"
GREEN = "#34d399"
RED = "#f87171"
FONT = "Segoe UI"


class LauncherApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Batalha Naval · Inicializador de PRs")
        self.root.configure(bg=BG)
        self.root.geometry("940x745")
        self.root.minsize(825, 680)
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.queue: queue.Queue[tuple] = queue.Queue()
        self.busy = False
        self.engine: Engine | None = None
        self.running = False
        self.worker: threading.Thread | None = None
        self.versions = {kind: [main_version(repo)] for kind, repo in REPOSITORIES.items()}
        self.settings_file = DEFAULT_ROOT / "settings.json"
        self.settings = self.load_settings()
        self.ui()
        self.root.after(100, self.drain_queue)
        self.refresh_versions()

    def load_settings(self) -> dict:
        try:
            return json.loads(self.settings_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def save_settings(self) -> None:
        data = {
            "workspace": self.workspace_var.get(),
            "docker": bool(self.docker_var.get()),
            "browser": bool(self.browser_var.get()),
            "reuse_api": bool(self.reuse_var.get()),
            "front": self.selected_version("front").slug,
            "api": self.selected_version("api").slug,
        }
        self.settings_file.parent.mkdir(parents=True, exist_ok=True)
        self.settings_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def ui(self) -> None:
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure("BN.TCombobox", fieldbackground=PANEL_ALT, background=PANEL_ALT,
                        foreground=TEXT, bordercolor=LINE, arrowcolor=YELLOW, padding=9,
                        selectbackground=PANEL_ALT, selectforeground=TEXT,
                        font=(FONT, 11))
        style.map("BN.TCombobox", fieldbackground=[("readonly", PANEL_ALT)],
                  foreground=[("readonly", TEXT)])
        style.configure("BN.TCheckbutton", background=PANEL, foreground=TEXT,
                        font=(FONT, 10), indicatorcolor=BG, padding=1)
        style.map("BN.TCheckbutton", background=[("active", PANEL)],
                  foreground=[("active", TEXT)])

        shell = tk.Frame(self.root, bg=BG, padx=26, pady=20)
        shell.pack(fill="both", expand=True)
        shell.grid_columnconfigure(0, weight=1)
        shell.grid_rowconfigure(5, weight=1)

        header = tk.Frame(shell, bg=BG)
        header.grid(row=0, column=0, sticky="ew", pady=(0, 16))
        icon = tk.Canvas(header, bg=BG, width=54, height=54, borderwidth=0, highlightthickness=0)
        icon.pack(side="left", padx=(0, 14))
        icon.create_oval(3, 3, 51, 51, outline=YELLOW, width=2)
        icon.create_oval(11, 11, 43, 43, outline="#6a571c", width=1)
        icon.create_line(27, 12, 27, 43, fill=YELLOW, width=3)
        icon.create_arc(15, 24, 39, 45, start=185, extent=170, outline=YELLOW, width=3, style="arc")
        icon.create_oval(23, 14, 31, 22, outline=YELLOW, width=2)
        text = tk.Frame(header, bg=BG)
        text.pack(side="left", fill="x", expand=True)
        tk.Label(text, text="BATALHA NAVAL", bg=BG, fg=YELLOW,
                 font=(FONT, 22, "bold")).pack(anchor="w")
        tk.Label(text, text="Inicializador de desenvolvimento  ·  Frontend + API  ·  PRs do GitHub",
                 bg=BG, fg=MUTED, font=(FONT, 10)).pack(anchor="w", pady=(1, 0))
        tk.Button(header, text="GitHub ↗", command=lambda: webbrowser.open(
            "https://github.com/FG-Interactive-Studios/BN-user-interface/pulls"),
                  bg=PANEL, fg=YELLOW, activebackground=PANEL_ALT, activeforeground=YELLOW,
                  relief="flat", padx=14, pady=8, cursor="hand2").pack(side="right")

        selections = tk.Frame(shell, bg=PANEL, padx=18, pady=14,
                              highlightbackground=LINE, highlightthickness=1)
        selections.grid(row=1, column=0, sticky="ew")
        selections.grid_columnconfigure(0, weight=1)
        selections.grid_columnconfigure(1, weight=1)
        self.combo = {}
        for col, (key, caption) in enumerate((("front", "INTERFACE  ·  BN-user-interface"),
                                               ("api", "BACKEND  ·  BN-API-Central"))):
            group = tk.Frame(selections, bg=PANEL)
            group.grid(row=0, column=col, sticky="ew", padx=(0, 9) if col == 0 else (9, 0))
            tk.Label(group, text=caption, bg=PANEL, fg=MUTED,
                     font=(FONT, 9, "bold")).pack(anchor="w", pady=(0, 7))
            combo = ttk.Combobox(group, state="readonly", style="BN.TCombobox")
            combo["values"] = [main_version(REPOSITORIES[key]).label]
            combo.current(0)
            combo.pack(fill="x")
            self.combo[key] = combo
        foot = tk.Frame(selections, bg=PANEL)
        foot.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(15, 0))
        self.btn_refresh = self.make_button(foot, "↻  Atualizar PRs", self.refresh_versions,
                                            primary=False, width=19)
        self.btn_refresh.pack(side="left")
        tk.Label(foot, text="Inclui PRs em rascunho. A seleção sempre busca o commit mais recente.",
                 bg=PANEL, fg=MUTED, font=(FONT, 9)).pack(side="left", padx=12)

        settings_panel = tk.Frame(shell, bg=PANEL, padx=18, pady=14,
                                  highlightbackground=LINE, highlightthickness=1)
        settings_panel.grid(row=2, column=0, sticky="ew", pady=12)
        settings_panel.grid_columnconfigure(0, weight=1)
        tk.Label(settings_panel, text="PASTA DE DOWNLOADS E EXECUÇÃO", bg=PANEL,
                 fg=MUTED, font=(FONT, 9, "bold")).grid(row=0, column=0, sticky="w", pady=(0, 7))
        self.workspace_var = tk.StringVar(value=self.settings.get("workspace", str(DEFAULT_ROOT / "workspace")))
        entry = tk.Entry(settings_panel, textvariable=self.workspace_var, bg=PANEL_ALT, fg=TEXT,
                         insertbackground=TEXT, font=(FONT, 10), relief="flat", bd=0)
        entry.grid(row=1, column=0, sticky="ew", ipady=8)
        browse = self.make_button(settings_panel, "Procurar…", self.browse, width=13)
        browse.grid(row=1, column=1, padx=(9, 0))
        flags = tk.Frame(settings_panel, bg=PANEL)
        flags.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(15, 0))
        self.docker_var = tk.BooleanVar(value=self.settings.get("docker", True))
        self.browser_var = tk.BooleanVar(value=self.settings.get("browser", True))
        self.reuse_var = tk.BooleanVar(value=self.settings.get("reuse_api", False))
        for col, (caption, variable) in enumerate((
            ("Iniciar PostgreSQL (Docker)", self.docker_var),
            ("Abrir jogo no navegador", self.browser_var),
            ("Reutilizar API já ativa", self.reuse_var),
        )):
            ttk.Checkbutton(flags, text=caption, variable=variable,
                            style="BN.TCheckbutton").grid(row=0, column=col,
                                                           sticky="w", padx=(0 if col == 0 else 12, 0))

        bar = tk.Frame(shell, bg=BG)
        bar.grid(row=3, column=0, sticky="ew", pady=(5, 10))
        self.btn_download = self.make_button(bar, "↓  Baixar versões", self.download_only, width=23)
        self.btn_download.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.btn_start = self.make_button(bar, "▶  Baixar e iniciar", self.start, primary=True, width=23)
        self.btn_start.pack(side="left", fill="x", expand=True, padx=8)
        self.btn_stop = self.make_button(bar, "■  Encerrar", self.stop, width=19)
        self.btn_stop.pack(side="left", fill="x", expand=True, padx=(8, 0))
        self.btn_stop.configure(state="disabled")

        status = tk.Frame(shell, bg=BG)
        status.grid(row=4, column=0, sticky="ew", pady=(0, 8))
        self.status_label = tk.Label(status, text="●  Preparando lista de PRs…", bg=BG,
                                     fg=MUTED, font=(FONT, 10, "bold"), anchor="w")
        self.status_label.pack(side="left", fill="x", expand=True)
        self.btn_browser = self.make_button(status, "Abrir jogo ↗", lambda: webbrowser.open(GAME_URL))
        self.btn_browser.pack(side="right")
        self.btn_browser.configure(state="disabled")

        log_panel = tk.Frame(shell, bg=PANEL, highlightbackground=LINE, highlightthickness=1,
                             padx=12, pady=10)
        log_panel.grid(row=5, column=0, sticky="nsew")
        log_panel.grid_columnconfigure(0, weight=1)
        log_panel.grid_rowconfigure(1, weight=1)
        tk.Label(log_panel, text="LOGS DE EXECUÇÃO", bg=PANEL, fg=MUTED,
                 font=(FONT, 9, "bold")).grid(row=0, column=0, sticky="w", pady=(0, 7))
        self.log_widget = tk.Text(log_panel, bg="#101e27", fg="#d4e4ed", insertbackground=TEXT,
                                  font=("Consolas", 9), borderwidth=0, wrap="word",
                                  highlightthickness=0, state="disabled")
        self.log_widget.grid(row=1, column=0, sticky="nsew")
        scroll = tk.Scrollbar(log_panel, command=self.log_widget.yview)
        scroll.grid(row=1, column=1, sticky="ns")
        self.log_widget.configure(yscrollcommand=scroll.set)
        tk.Label(shell, text="Sem reset de branches, sem apagar volumes. Execute PRs somente de autores em quem confia.",
                 bg=BG, fg=MUTED, font=(FONT, 9)).grid(row=6, column=0, sticky="w", pady=(9, 0))

    def make_button(self, parent, label, callback, primary=False, width=15):
        return tk.Button(parent, text=label, command=callback, width=width,
                         bg=YELLOW if primary else PANEL_ALT, fg=BG if primary else TEXT,
                         activebackground="#ffd76a" if primary else LINE,
                         activeforeground=BG if primary else TEXT,
                         font=(FONT, 10, "bold"), relief="flat", bd=0,
                         padx=13, pady=9, cursor="hand2")

    def browse(self) -> None:
        folder = filedialog.askdirectory(title="Escolha a pasta de downloads")
        if folder:
            self.workspace_var.set(folder)
            self.save_settings()

    def selected_version(self, key: str) -> Version:
        idx = self.combo[key].current()
        values = self.versions[key]
        return values[idx] if 0 <= idx < len(values) else values[0]

    def refresh_versions(self) -> None:
        if self.busy:
            return
        self.btn_refresh.configure(state="disabled")
        self.set_status("Consultando PRs abertas de ambos os repositórios…")
        before = {key: self.selected_version(key).slug for key in REPOSITORIES}
        def task() -> None:
            found = {}
            errors = []
            for key, repo in REPOSITORIES.items():
                try:
                    found[key] = github_versions(repo)
                except LauncherError as exc:
                    errors.append(f"{key}: {exc}")
            self.queue.put(("versions", found, before, errors))
        threading.Thread(target=task, daemon=True).start()

    def set_status(self, content: str, color: str = MUTED) -> None:
        self.status_label.configure(text="●  " + content, fg=color)

    def add_log(self, line: str) -> None:
        self.log_widget.configure(state="normal")
        self.log_widget.insert("end", line + "\n")
        if int(self.log_widget.index("end-1c").split(".")[0]) > 1300:
            self.log_widget.delete("1.0", "300.0")
        self.log_widget.see("end")
        self.log_widget.configure(state="disabled")

    def confirm_versions(self) -> bool:
        selected = [self.selected_version(key) for key in ("front", "api")]
        prs = [ver for ver in selected if ver.kind == "pr"]
        if not prs:
            return True
        display = "\n".join(f"• {ver.repo}: #{ver.number} ({ver.author})" for ver in prs)
        message = ("Esta operação baixará e executará código de PRs, inclusive scripts npm/Maven.\n"
                   "PRs da API também podem aplicar migrações Flyway ao banco local.\n\n"
                   + display + "\n\nUse apenas PRs confiáveis. Deseja continuar?")
        return messagebox.askyesno("Confirmar execução de PRs", message, parent=self.root)

    def set_busy(self, value: bool) -> None:
        self.busy = value
        self.btn_download.configure(state="disabled" if value or self.running else "normal")
        self.btn_start.configure(state="disabled" if value or self.running else "normal")
        self.btn_refresh.configure(state="disabled" if value else "normal")
        for box in self.combo.values():
            box.configure(state="disabled" if value or self.running else "readonly")
        self.btn_stop.configure(state="normal" if value or self.running else "disabled")

    def begin(self, launch: bool) -> None:
        if self.busy or self.running:
            return
        workspace = Path(self.workspace_var.get().strip()).expanduser()
        if not str(workspace).strip() or workspace == Path("."):
            messagebox.showerror("Pasta inválida", "Escolha uma pasta para os repositórios.")
            return
        if not self.confirm_versions():
            return
        try:
            self.save_settings()
            self.engine = Engine(workspace, emit=lambda msg: self.queue.put(("log", msg)))
        except OSError as exc:
            messagebox.showerror("Erro de pasta", str(exc))
            return
        self.set_busy(True)
        self.set_status("Preparando o download…", YELLOW)
        self.add_log("─" * 65)
        front = self.selected_version("front")
        api = self.selected_version("api")
        docker = bool(self.docker_var.get())
        reuse_api = bool(self.reuse_var.get())
        engine = self.engine
        def task() -> None:
            try:
                front_path, api_path = engine.download(front, api)
                if launch:
                    engine.launch(front_path, api_path, docker=docker, reuse_api=reuse_api)
                    self.queue.put(("ready",))
                else:
                    self.queue.put(("downloaded", str(front_path), str(api_path)))
            except Cancelled as exc:
                self.queue.put(("cancelled", str(exc)))
            except Exception as exc:
                self.queue.put(("error", str(exc)))
        self.worker = threading.Thread(target=task, name="bn-launcher-worker", daemon=True)
        self.worker.start()

    def download_only(self) -> None:
        self.begin(False)

    def start(self) -> None:
        self.begin(True)

    def stop(self) -> None:
        if self.engine is None:
            return
        self.set_status("Encerrando processos do launcher…", YELLOW)
        # terminations can block; run off Tk thread
        engine = self.engine
        def task() -> None:
            try:
                engine.stop()
            finally:
                self.queue.put(("stopped",))
        threading.Thread(target=task, daemon=True).start()

    def drain_queue(self) -> None:
        try:
            while True:
                event, *details = self.queue.get_nowait()
                if event == "log":
                    self.add_log(details[0])
                    if self.busy:
                        self.set_status(details[0][-115:], YELLOW)
                elif event == "versions":
                    found, before, errors = details
                    for key, versions in found.items():
                        self.versions[key] = versions
                        self.combo[key]["values"] = [v.label for v in versions]
                        index = next((i for i, v in enumerate(versions) if v.slug == before[key]), 0)
                        self.combo[key].current(index)
                    self.btn_refresh.configure(state="normal")
                    if errors:
                        self.set_status("Atualização parcial. Veja os logs.", RED)
                        for item in errors:
                            self.add_log(item)
                    else:
                        count = sum(len(v) - 1 for v in self.versions.values())
                        self.set_status(f"{count} PR(s) disponíveis. Escolha versões e inicie.", GREEN)
                elif event == "ready":
                    if self.engine is not None and self.engine.cancel.is_set():
                        continue
                    self.running = True
                    self.set_busy(False)
                    self.btn_browser.configure(state="normal")
                    self.set_status("API e jogo prontos — http://127.0.0.1:5173", GREEN)
                    if self.browser_var.get():
                        webbrowser.open(GAME_URL)
                elif event == "downloaded":
                    self.set_busy(False)
                    self.set_status("Frontend e backend disponíveis no cache local.", GREEN)
                    self.add_log("Frontend: " + details[0])
                    self.add_log("Backend: " + details[1])
                elif event == "error":
                    if self.engine is not None:
                        self.engine.stop()
                    self.running = False
                    self.set_busy(False)
                    self.btn_browser.configure(state="disabled")
                    self.set_status("Falha na inicialização. Verifique o log.", RED)
                    self.add_log("ERRO: " + details[0])
                    messagebox.showerror("Falha no inicializador", details[0][:1100], parent=self.root)
                elif event in ("cancelled", "stopped"):
                    self.running = False
                    self.set_busy(False)
                    self.btn_browser.configure(state="disabled")
                    self.set_status("Execução encerrada. Banco de dados preservado.", MUTED)
        except queue.Empty:
            pass
        self.root.after(110, self.drain_queue)

    def close(self) -> None:
        if self.busy or self.running:
            if not messagebox.askyesno("Sair", "Encerrar os processos iniciados pelo launcher e sair?\n(O banco não será apagado.)"):
                return
            if self.engine is not None:
                self.engine.stop()
        try:
            self.save_settings()
        except OSError:
            pass
        self.root.destroy()


def main() -> None:
    if sys.version_info < (3, 10):
        raise SystemExit("Python 3.10 ou superior é necessário.")
    root = tk.Tk()
    LauncherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()