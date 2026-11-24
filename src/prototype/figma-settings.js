import {esc} from './board.js';

/** Approved Figma settings artboard.
 * These settings are local display preferences only, not server/user preferences.
 * Music and effects control AudioManager; push notices still require their engine.
 */
const STORAGE_KEY='bn.ui.preferences.v1';
const defaults=Object.freeze({music:true,effects:true,notifications:false,language:'pt-BR'});
export const settingKeys=Object.freeze(['music','effects','notifications']);

export function loadPreferences(){
  try{
    const value=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'{}');
    const saved=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const out={...defaults};
    for(const key of settingKeys)if(typeof saved[key]==='boolean')out[key]=saved[key];
    return out;
  }catch{return {...defaults};}
}
export function savePreferences(preferences){
  const out={...defaults};
  for(const key of settingKeys)out[key]=Boolean(preferences[key]);
  try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(out));}
  catch{/* Storage can be disabled: in-memory preference still works this session. */}
  return out;
}

const arrow='<span class="bn-settings-chevron" aria-hidden="true">›</span>';
const switchControl=(label,key,value,subtext='')=>`<div class="bn-settings-row bn-settings-toggle-row">
    <div class="bn-settings-row-label"><span>${label}</span>${subtext?`<small>${subtext}</small>`:''}</div>
    <button type="button" role="switch" aria-label="${label}" aria-checked="${value?'true':'false'}"
      data-action="toggle-setting" data-item-id="${key}"
      class="bn-settings-switch ${value?'is-on':''}"><span aria-hidden="true"></span></button>
  </div>`;

export function renderFigmaSettings(profile,preferences){
  const p=preferences||defaults;
  const email=esc(profile?.email||'E-mail indisponível');
  return `<div class="screen bn-settings-stage">
    <main class="bn-settings-layout" aria-labelledby="bn-settings-title">
      <header class="bn-settings-heading">
        <button type="button" class="bn-settings-back" data-go="lobby" aria-label="Voltar ao lobby">‹</button>
        <h1 id="bn-settings-title">Configurações</h1>
      </header>
      <div class="bn-settings-panels">
        <div class="bn-settings-left">
          <section class="bn-settings-panel bn-settings-sound" aria-labelledby="bn-settings-sound-heading">
            <h2 id="bn-settings-sound-heading">Som</h2>
            ${switchControl('Música','music',p.music)}
            ${switchControl('Efeitos sonoros','effects',p.effects)}
          </section>
          <section class="bn-settings-panel bn-settings-game" aria-labelledby="bn-settings-game-heading">
            <h2 id="bn-settings-game-heading">Jogo</h2>
            ${switchControl('Notificações','notifications',p.notifications,'Avisos de turno e eventos')}
            <button type="button" class="bn-settings-row bn-settings-link-row" data-action="settings-language">
              <span>Idioma</span><span class="bn-settings-row-value">Português (BR) ${arrow}</span>
            </button>
          </section>
        </div>
        <section class="bn-settings-panel bn-settings-account" aria-labelledby="bn-settings-account-heading">
          <h2 id="bn-settings-account-heading">Conta</h2>
          <button type="button" class="bn-settings-row bn-settings-link-row bn-settings-account-link"
            data-action="settings-manage-account">
            <span class="bn-settings-row-label"><span>Gerenciar conta</span><small>${email}</small></span>${arrow}
          </button>
          <button type="button" class="bn-settings-row bn-settings-link-row" data-action="settings-legal" data-item-id="terms">
            <span>Termos de uso</span>${arrow}
          </button>
          <button type="button" class="bn-settings-row bn-settings-link-row" data-action="settings-legal" data-item-id="privacy">
            <span>Política de privacidade</span>${arrow}
          </button>
        </section>
      </div>
      <footer class="bn-settings-footer">
        <button type="button" class="bn-settings-logout" data-action="logout">Sair da conta</button>
        <p>Versão 0.1.0</p>
      </footer>
    </main>
    <dialog id="bn-settings-info-dialog" class="bn-settings-dialog" aria-labelledby="bn-settings-dialog-title">
      <div class="bn-settings-dialog-heading">
        <h2 id="bn-settings-dialog-title">Idioma</h2>
        <button type="button" data-action="settings-close-dialog" aria-label="Fechar">×</button>
      </div>
      <p id="bn-settings-dialog-description">Português (BR) é o idioma disponível nesta versão.</p>
      <button type="button" class="bn-settings-dialog-done" data-action="settings-close-dialog">Entendi</button>
    </dialog>
  </div>`;
}
