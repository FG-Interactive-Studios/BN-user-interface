import { pages } from "./pages/index";
import "./styles/index.css";

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Root app element not found");
}

const flowOrder = [
  "auth",
  "lobby",
  "matchmaking",
  "placement",
  "match",
  "result",
] as const;

type FlowStep = (typeof flowOrder)[number];

let currentStep: FlowStep = "auth";

const layout = `
  <div class="shell game-shell">
    <header class="game-header">
      <div class="brand">
        <span class="brand-mark">B</span>
        <div>
          <strong>Battleship</strong>
          <small>multiplayer</small>
        </div>
      </div>

      <div class="game-meta">
        <span class="meta-pill">player_01</span>
        <span class="meta-pill muted">saldo: 120</span>
      </div>
    </header>

    <div class="game-progress" aria-label="Progresso do fluxo">
      ${flowOrder
        .map(
          (step, index) => `
            <span class="progress-step ${step === currentStep ? "is-active" : ""}">
              <em>${index + 1}</em>
              <small>${step}</small>
            </span>
          `
        )
        .join("")}
    </div>

    <main class="main-panel game-panel">
      <div id="page-root"></div>
    </main>
  </div>
`;

app.innerHTML = layout;

const pageRoot = document.querySelector("#page-root");

function renderPage(step: FlowStep) {
  currentStep = step;

  const page = pages.find((item) => item.name === step) ?? pages[0];
  if (pageRoot) pageRoot.innerHTML = page.render();

  const progressNodes = document.querySelectorAll(".progress-step");
  progressNodes.forEach((node) => {
    const label = node.querySelector("small")?.textContent;
    node.classList.toggle("is-active", label === currentStep);
  });

  const actionButtons = pageRoot?.querySelectorAll("[data-action]");
  actionButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      if (!action) return;

      switch (action) {
        case "login":
          renderPage("lobby");
          break;
        case "open-store":
          renderPage("lobby");
          break;
        case "find-match":
          renderPage("matchmaking");
          break;
        case "cancel-match":
          renderPage("lobby");
          break;
        case "match-found":
          renderPage("placement");
          break;
        case "confirm-placement":
          renderPage("match");
          break;
        case "fire-shot":
          renderPage("result");
          break;
        case "play-again":
          renderPage("lobby");
          break;
        case "back-to-lobby":
          renderPage("lobby");
          break;
        default:
          break;
      }
    });
  });
}

renderPage("auth");
