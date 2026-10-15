const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Root app element not found");

// Isolate the existing administrative UI from TidePoint's game styles.
if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
  Promise.all([import("./styles/index.css"), import("./pages/admin/index")])
    .then(([, { renderAdminPage }]) => renderAdminPage(root))
    .catch(error => { console.error(error); root.textContent = "Não foi possível carregar o painel."; });
} else {
  Promise.all([import("./prototype/tidepoint-entry.css"), import("./prototype/app.js")])
    .then(([, { startTidepoint }]) => startTidepoint(root))
    .catch(error => { console.error(error); root.textContent = "Não foi possível carregar o TidePoint."; });
}
