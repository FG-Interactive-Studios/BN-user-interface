import {esc} from './board.js';
const freeCoin=new URL('../assets/figma/gold-coin.png',import.meta.url).href;
const paidCoin=new URL('../assets/figma/blue-coin.png',import.meta.url).href;

const formatter = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0});

export function walletAmounts(catalog) {
  const money = value => Number.isSafeInteger(value) && value >= 0 ? formatter.format(value) : '—';
  return {
    free: money(catalog?.credits),
    premium: money(catalog?.premiumCredits),
  };
}

/** Approved Figma currency art, backed exclusively by the authenticated store snapshot. */
export function walletMarkup(catalog, {compact=false}={}) {
  const amounts=walletAmounts(catalog);
  return `<div class="bn-wallet-pills ${compact?'is-compact':''}" aria-label="Saldos do jogador">
    <div class="bn-wallet-pill is-free" title="Moedas gratuitas de teste">
      <img src="${freeCoin}" alt="" width="33" height="33" />
      <span><small>Moedas</small><strong>${esc(amounts.free)}</strong></span>
    </div>
    <div class="bn-wallet-pill is-premium" title="Moedas premium — compras indisponíveis">
      <img src="${paidCoin}" alt="" width="33" height="33" />
      <span><small>Premium</small><strong>${esc(amounts.premium)}</strong></span>
    </div>
  </div>`;
}
