const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Root app element not found");

// /admin is a backwards-compatible entry point, not a separate login app.
// In-app navigation uses #admin and keeps the game's memory-only JWT session.
if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
  window.history.replaceState(null, "", "/#admin");
}

Promise.all([import("./prototype/tidepoint-entry.css"), import("./prototype/app.js")])
  .then(([, { startTidepoint }]) => startTidepoint(root))
  .catch(error => { console.error(error); root.textContent = "Não foi possível carregar o jogo."; });
