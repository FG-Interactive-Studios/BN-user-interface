// Use the same markup on initial render and WebSocket state changes.
export const connectionStatusLabel=online=>online?'Conectado':'Reconectando';
export function connectionStatusContent(online){
  return `<i class="tp-live-dot ${online?'online':'warning'}" aria-hidden="true"></i>${online?'':'<span>Reconectando</span>'}`;
}
