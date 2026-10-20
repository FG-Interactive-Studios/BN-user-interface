import { esc } from './board.js';
export function avatarSymbol(id) { const icons={captain:'🧑‍✈️',submarine:'⚓',destroyer:'🛥️',carrier:'🚢'}; return icons[String(id||'').toLowerCase()] || '👤'; }
export function roomPlayerCard(p,{isSelf=false,role='Convidado'}={}) {
 if(!p) return '<div class="tp-player-slot tp-seat-empty"><span class="tp-room-avatar tp-avatar-empty" aria-hidden="true">＋</span><div class="tp-room-identity"><span class="tp-room-role">Convidado</span><strong>Vaga disponível</strong><span class="tp-seat-placeholder">Aguardando jogador…</span></div></div>';
 const online=Boolean(p.connected),presence=online?'Online':'Offline';
 return `<div class="tp-player-slot"><span class="tp-room-avatar" aria-hidden="true">${avatarSymbol(p.avatarId)}</span><div class="tp-room-identity"><span class="tp-room-role">${esc(role)}${isSelf?' · Você':''}</span><div class="tp-room-name"><span class="tp-presence-dot ${online?'is-online':'is-offline'}" role="img" aria-label="${presence}" title="${presence}"></span><strong>${esc(p.nickname||'Jogador')}</strong></div></div><span class="tp-ready-chip ${p.ready?'is-ready':'is-waiting'}">${p.ready?'Pronto':'Aguardando'}</span></div>`;
}
export function compactEnemyContacts(fleet,sunkShots) {
 const known=new Set(sunkShots.map(s=>s.sunkShip));const sunk=fleet.filter(s=>known.has(s.id)).length;
 const dots=fleet.map((ship,i)=>`<span class="tp-contact-dot ${known.has(ship.id)?'is-sunk':''}" title="${known.has(ship.id)?'Navio afundado':'Contato não identificado'} ${i+1}" aria-hidden="true"></span>`).join('');
 const rows=fleet.map((ship,i)=>`<div><span>Contato ${i+1}</span><b>${known.has(ship.id)?'Afundado':'Não identificado'}</b></div>`).join('');
 return `<details class="tp-mobile-intel"><summary><span><b>Contatos inimigos</b><small>${sunk} / ${fleet.length} afundados</small></span><span class="tp-intel-counter">${dots}</span><span class="tp-intel-expand" aria-hidden="true">⌄</span></summary><div class="tp-mobile-intel-list">${rows}</div></details>`;
}
