/** Legacy page boundary kept for compatibility with older imports.
 * The actual authenticated, API-driven store is rendered by
 * src/prototype/store-ui.js inside src/prototype/app.js.
 *
 * Do not reintroduce mock credits, game boosts or purchases here.
 */
export function renderStorePage() {
  return `
    <section class="tp-content" aria-label="Loja TidePoint">
      <h1>Loja TidePoint</h1>
      <p>Abra a loja integrada ao jogo para consultar o catálogo e seus créditos de teste.</p>
      <a href="/#store">Ir para o Arsenal</a>
    </section>
  `;
}
