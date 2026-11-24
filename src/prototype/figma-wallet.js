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
      <button type="button" class="bn-wallet-add" data-action="open-wallet" data-item-id="free" aria-label="Como obter moedas Marinha" aria-haspopup="dialog" title="Como obter moedas Marinha">+</button>
    </div>
    <div class="bn-wallet-pill is-premium" title="Moedas navais de demonstração, sem dinheiro real">
      <span class="bn-gd-wallet-coin is-naval" aria-hidden="true"></span>
      <span><small>Naval</small><strong>${esc(amounts.premium)}</strong></span>
      <button type="button" class="bn-wallet-add" data-action="open-wallet" data-item-id="premium" aria-label="Adicionar moedas Naval" aria-haspopup="dialog" title="Adicionar moedas Naval">+</button>
    </div>
  </div>`;
}

/** Top-ups are simulated, server-priced and restricted to Naval currency. */
export function walletDialogMarkup(catalog,{currency='premium',loading=false,notice='',error=false}={}){
 const amounts=walletAmounts(catalog),free=currency==='free';
 return `<dialog id="bn-wallet-dialog" class="bn-wallet-dialog" aria-labelledby="bn-wallet-title">
 <div class="bn-wallet-dialog-head"><h2 id="bn-wallet-title">Moedas</h2><button type="button" class="bn-wallet-close" data-action="close-wallet" aria-label="Fechar moedas">×</button></div>
 <div class="bn-wallet-tabs" aria-label="Tipo de moeda">
 <button type="button" data-action="wallet-currency" data-item-id="free" aria-pressed="${free}">Marinha · ${esc(amounts.free)}</button>
 <button type="button" data-action="wallet-currency" data-item-id="premium" aria-pressed="${!free}">Naval · ${esc(amounts.premium)}</button></div>
 ${free?`<section class="bn-wallet-info"><h3>Ganhe moedas Marinha</h3><p>Conclua partidas para receber moedas gratuitas de teste. As recompensas são creditadas pelo servidor.</p></section>`:catalog?.demoPremiumEnabled===true?`<section class="bn-wallet-info"><h3>Adicionar moedas Naval</h3><p>Simule uma compra. Nenhum dinheiro real será cobrado e não solicitamos dados financeiros.</p><div class="bn-wallet-packs">${[100,300,700].map(amount=>`<button type="button" class="btn btn-primary" data-action="store-demo-topup" data-item-id="demo_${amount}" ${loading?'disabled':''}><span class="bn-gd-wallet-coin is-naval" aria-hidden="true"></span><strong>+ ${amount} Naval</strong><small>Simular compra</small></button>`).join('')}</div></section>`:`<section class="bn-wallet-info"><h3>Moedas Naval</h3><p>${loading?'Carregando opções…':'A aquisição de moedas de demonstração está indisponível.'}</p></section>`}
 ${notice?`<p class="bn-wallet-feedback ${error?'is-error':''}" role="status">${esc(notice)}</p>`:''}
 </dialog>`;
}
