export function StatusBadge(label: string, tone: "primary" | "success" | "warning" | "danger" = "primary") {
  return `<span class="badge badge-${tone}">${label}</span>`;
}

export function Button(label: string, variant: "primary" | "secondary" = "primary") {
  return `<button class="button button-${variant}">${label}</button>`;
}

export function Panel(title: string, subtitle?: string, content?: string) {
  return `
    <section class="panel">
      <header class="panel-header">
        <div>
          <h3>${title}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ""}
        </div>
      </header>
      <div class="panel-body">${content ?? ""}</div>
    </section>
  `;
}

export function BoardGrid(size = 10) {
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size) + 1;
    const col = (index % size) + 1;
    const accent = [0, 3, 8, 12, 19, 27, 34, 39].includes(index) ? "is-hit" : "";
    return `<span class="board-cell ${accent}" title="${row},${col}"></span>`;
  }).join("");

  return `<div class="board-grid" style="--board-size:${size}">${cells}</div>`;
}
