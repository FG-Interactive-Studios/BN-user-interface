import { renderAuthPage } from "./auth/index";
import { renderLobbyPage } from "./lobby/index";
import { renderMatchmakingPage } from "./matchmaking/index";
import { renderPlacementPage } from "./placement/index";
import { renderMatchPage } from "./match/index";
import { renderResultPage } from "./result/index";
import { renderStorePage } from "./store/index";

export const pages = [
  { name: "auth", label: "Autenticação", render: renderAuthPage },
  { name: "lobby", label: "Lobby", render: renderLobbyPage },
  { name: "matchmaking", label: "Matchmaking", render: renderMatchmakingPage },
  { name: "placement", label: "Posicionamento", render: renderPlacementPage },
  { name: "match", label: "Partida", render: renderMatchPage },
  { name: "result", label: "Resultado", render: renderResultPage },
  { name: "store", label: "Loja", render: renderStorePage },
];
