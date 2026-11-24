import {esc} from './board.js';

const formatter = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0});

export function walletAmounts(catalog) {
  const money = value => Number.isSafeInteger(value) && value >= 0 ? formatter.format(value) : '—';
  return {
    free: money(catalog?.credits),
    premium: money(catalog?.premiumCredits),
  };
}

/** Official GD currency art, backed exclusively by the authenticated store snapshot. */
export function walletMarkup(catalog, {compact=false}={}) {
  const amounts=walletAmounts(catalog);
  return `<div class="bn-wallet-pills ${compact?'is-compact':''}" aria-label="Saldos do jogador">
    <div class="bn-wallet-pill is-free" title="Moedas da Marinha gratuitas de teste">
      <span class="bn-gd-wallet-coin is-marine" aria-hidden="true"></span>
      <span><small>Marinha</small><strong>${esc(amounts.free)}</strong></span>
    </div>
    <div class="bn-wallet-pill is-premium" title="Moedas navais de demonstração, sem dinheiro real">
      <span class="bn-gd-wallet-coin is-naval" aria-hidden="true"></span>
      <span><small>Naval</small><strong>${esc(amounts.premium)}</strong></span>
    </div>
  </div>`;
}
