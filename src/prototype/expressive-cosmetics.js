import {esc} from './board.js';
export const EXPRESSIVE_LABELS=Object.freeze({ATTACK:'Efeitos de ataque',CELEBRATION:'Comemorações',FUNERAL:'Funerais',TITLE:'Títulos',COMMENTATOR:'Comentaristas',FRAME:'Molduras',BOARD_THEME:'Temas de tabuleiro'});
export const EXPRESSIVE_CATEGORIES=Object.freeze(Object.keys(EXPRESSIVE_LABELS));
export const EXPRESSION_ITEMS=Object.freeze({
 attack_default:['Impacto padrão','⚓'],attack_clown:['Chuva de Palhaços','🤡'],celebration_default:['Comemoração padrão','✨'],celebration_chaos:['Caos Absoluto','🎊'],
 funeral_default:['Funeral naval','⚰️'],funeral_pieces:['Descanse em Pedaços','🪦'],title_default:['Capitão','⚓'],title_threat:['Ameaça à Navegação','☠️'],
 commentator_default:['Comentarista padrão','📢'],commentator_support:['Central do Naufrágio','☎️'],frame_default:['Moldura padrão','◈'],frame_neon:['Patente Neon','✦'],board_default:['Tabuleiro padrão','▦'],board_abyss:['Sonar Abissal','◉']});
export function selectedExpression(items,category){return (items||[]).find(i=>i.category===category&&i.equipped&&i.owned&&i.enabled)?.id;}
export function expressionTitle(id){return id==='title_threat'?'Ameaça à Navegação':'';}
export function publicExpression(lobby,id,category){return lobby?.players?.find(p=>p.id===id)?.cosmetics?.[category];}
const epitaphs=['O navio agora tem vista para o fundo do mar.','Foi enterrado com honras e três boletos.','Nunca esqueceremos suas últimas bolhas.','Descansa, casco. A garantia também morreu.','O velório será transmitido pelo sonar.','A frota pediu um minuto de silêncio e uma boia.'];
const support={hit:['Protocolo registrado: furo no casco.','Chamado aberto para reparo emergencial.'],miss:['O chamado foi encaminhado ao setor de água.','Nenhum navio localizado. Tente novamente.'],blocked:['Solicitação recusada pela portaria.','Seu acesso ao casco foi negado.']};
const index=(seed,n)=>Number.isSafeInteger(seed)?Math.abs(seed)%n:0;
export function paidFuneral(id,seed){return id==='funeral_pieces'?'⚰️ Funeral naval — '+epitaphs[index(seed,epitaphs.length)]:null;}
export function paidCommentary(id,kind,seed){const lines=Object.hasOwn(support,kind)?support[kind]:null;return id==='commentator_support'&&lines?'☎️ '+lines[index(seed,lines.length)]:null;}
function newHit(before,after){const old=new Map((before||[]).map(s=>[s.row+','+s.col,s]));return (after||[]).some(s=>s.hit&&!s.blocked&&(!old.get(s.row+','+s.col)?.hit||old.get(s.row+','+s.col)?.blocked));}
export function impactAttacker(before,after,me,rival){if(!before||!after||before.matchId!==after.matchId||after.revision!==before.revision+1)return null;return newHit(before.shotsFired,after.shotsFired)?me:newHit(before.shotsReceived,after.shotsReceived)?rival:null;}
export function expressionPreview(item){if(!EXPRESSIVE_CATEGORIES.includes(item.category)||!Object.hasOwn(EXPRESSION_ITEMS,item.id))return '';const [label,icon]=EXPRESSION_ITEMS[item.id];return '<span class="bn-taunt-phrase">'+esc(icon+' '+label)+'</span>';}
