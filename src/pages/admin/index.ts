import { ApiError } from "../../services/api";
import {
  changeModeAvailability,
  getAdminModes,
  signInAdmin,
  signOutAdmin,
} from "../../services/admin-api";
import type { AdminMode } from "../../services/admin-api";
import "../../styles/admin.css";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sessão expirada ou credenciais inválidas. Entre novamente.";
    if (error.status === 403) return "Acesso restrito: esta conta não é administradora.";
    if (error.status === 409) return "Ao menos um tabuleiro precisa permanecer habilitado.";
    return `Não foi possível concluir a operação (HTTP ${error.status}).`;
  }
  return "Não foi possível conectar à API. Verifique se o servidor está acessível.";
}

function label(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

export function renderAdminPage(root: HTMLElement): void {
  root.className = "admin-app";

  function showLogin(feedback = ""): void {
    root.innerHTML = `
      <main class="admin-container">
        <nav><a href="/">← Voltar ao jogo</a></nav>
        <section class="admin-card">
          <h1>Gerenciar tabuleiros</h1>
          <p>Entre com uma conta administradora.</p>
          <form id="admin-login">
            <label>E-mail <input name="email" type="email" autocomplete="username" required /></label>
            <label>Senha <input name="password" type="password" autocomplete="current-password" required /></label>
            <button type="submit">Entrar</button>
          </form>
          <p role="alert" id="admin-error"></p>
        </section>
      </main>`;
    const form = root.querySelector<HTMLFormElement>("#admin-login");
    const errorBox = root.querySelector<HTMLElement>("#admin-error");
    if (!form || !errorBox) return;
    errorBox.textContent = feedback;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
      const email = form.querySelector<HTMLInputElement>("input[name=email]");
      const password = form.querySelector<HTMLInputElement>("input[name=password]");
      if (!email || !password || !submit) return;
      submit.disabled = true;
      errorBox.textContent = "Conectando...";
      try {
        const modes = await signInAdmin(email.value.trim(), password.value);
        password.value = "";
        showModes(modes);
      } catch (error) {
        password.value = "";
        errorBox.textContent = messageFor(error);
        submit.disabled = false;
      }
    });
  }

  function showModes(modes: AdminMode[], feedback = ""): void {
    root.innerHTML = `
      <main class="admin-container">
        <nav><a href="/">← Voltar ao jogo</a></nav>
        <section class="admin-card">
          <div class="admin-heading">
            <div>
              <h1>Tabuleiros</h1>
              <p>Controle quais modos aparecem para novas salas.</p>
            </div>
            <button id="admin-logout" type="button" class="admin-secondary">Sair</button>
          </div>
          <p class="admin-message" role="status" id="admin-feedback"></p>
          <div id="admin-mode-list" class="admin-list"></div>
          <p class="admin-help">Desativar um tabuleiro não encerra partidas já iniciadas.</p>
        </section>
      </main>`;
    const list = root.querySelector<HTMLElement>("#admin-mode-list");
    const feedbackNode = root.querySelector<HTMLElement>("#admin-feedback");
    if (!list || !feedbackNode) return;
    feedbackNode.textContent = feedback;
    root.querySelector<HTMLButtonElement>("#admin-logout")?.addEventListener("click", async () => {
      await signOutAdmin();
      showLogin();
    });

    for (const entry of modes) {
      const card = document.createElement("article");
      card.className = "admin-mode";
      const content = document.createElement("div");
      content.append(
        label("h2", entry.mode.name),
        label("p", `${entry.mode.geometry.kind} · ${entry.mode.geometry.cells.length} casas · ${entry.mode.fleet.length} navios`),
        label("small", entry.updatedAt
          ? `Última alteração: ${new Date(entry.updatedAt).toLocaleString("pt-BR")}`
          : "Sem alteração administrativa anterior"),
      );
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = entry.enabled ? "admin-enabled" : "admin-disabled";
      toggle.textContent = entry.enabled ? "Habilitado" : "Desabilitado";
      toggle.setAttribute("aria-label", `${entry.enabled ? "Desabilitar" : "Habilitar"} ${entry.mode.name}`);
      toggle.addEventListener("click", async () => {
        if (entry.enabled && !window.confirm(
          `Desabilitar ${entry.mode.name} para novas salas? Partidas existentes continuarão.`
        )) return;
        toggle.disabled = true;
        feedbackNode.textContent = "Salvando...";
        try {
          await changeModeAvailability(entry.mode.id, !entry.enabled);
          showModes(await getAdminModes(), `Disponibilidade de ${entry.mode.name} atualizada.`);
        } catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            await signOutAdmin();
            showLogin(messageFor(error));
            return;
          }
          toggle.disabled = false;
          feedbackNode.textContent = messageFor(error);
        }
      });
      card.append(content, toggle);
      list.append(card);
    }
  }

  // Access tokens and refresh tokens are memory-only, not localStorage.
  // Reloading the page requires a fresh login.
  showLogin();
}
