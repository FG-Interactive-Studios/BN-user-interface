/** Thin API/session client. Only the backend decides identity, rooms, turn and victory. */
const API_BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');
let session = null;
let refreshing = null;
let scheduledRefresh = null;
let accessExpiresAt = 0;
let socket = null;
let retryTimer = null;
let socketGeneration = 0;
let onEvent = () => {};
let onConnection = () => {};

export class ApiError extends Error {
  constructor(status, body) {
    const code = body?.code || body?.error || '';
    const descriptions = {
      400: 'Dados inválidos. Confira as informações e tente novamente.',
      401: 'Credenciais inválidas ou sessão encerrada. Entre novamente.',
      403: 'Você não tem permissão para esta operação.',
      404: 'Sala, jogador ou recurso não encontrado.',
      409: 'A operação não é permitida no estado atual da partida.',
      429: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    };
    super(body?.message && typeof body.message === 'string' && body.message.length < 240
      ? body.message : (descriptions[status] || `Erro na API (HTTP ${status})`) + (code ? ` (${code})` : ''));
    this.name = 'ApiError'; this.status = status; this.code = code; this.body = body;
  }
}

async function rawRequest(path, { method = 'GET', data, authorized = true, retry = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  // Proactive renewal prevents users from being logged out when the 15-minute JWT expires.
  // A single in-flight refresh is shared by all requests and the socket ticket request.
  if (authorized && session && accessExpiresAt && Date.now() >= accessExpiresAt - 60000) {
    await refreshSession();
  }
  const tokenUsed = authorized ? session?.accessToken : null;
  if (tokenUsed) headers.Authorization = `Bearer ${tokenUsed}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method, headers, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Não foi possível conectar à API. Confira se ela está em execução.');
  }
  if (response.status === 401 && authorized && retry && session) {
    try {
      // Another request may already have rotated the token while ours was in flight.
      if (tokenUsed === session.accessToken) await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) clearSession();
      throw error;
    }
    return rawRequest(path, { method, data, authorized, retry: false });
  }
  if (!response.ok) {
    let body = null;
    try { body = await response.json(); } catch { /* no JSON body */ }
    throw new ApiError(response.status, body);
  }
  return response.status === 204 || response.status === 205 ? null : response.json();
}

async function refreshSession() {
  if (!session?.refreshToken) throw new ApiError(401);
  if (!refreshing) {
    refreshing = (async () => {
      // A rotating refresh token must never be submitted concurrently.
      const updated = await rawRequest('/auth/refresh', {
        method: 'POST', data: { refreshToken: session.refreshToken }, authorized: false,
      });
      applySession(updated);
      return session;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

function applySession(tokens) {
  session = tokens;
  accessExpiresAt = Date.now() + Math.max(60, Number(tokens.expiresIn) || 900) * 1000;
  clearTimeout(scheduledRefresh);
  // Keep the rotating refresh token in memory. Browsers in background can suspend timers;
  // rawRequest also checks expiry when the user comes back.
  const delay = Math.max(10000, accessExpiresAt - Date.now() - 90000);
  scheduledRefresh = setTimeout(() => {
    if (session) void refreshSession().catch(error => {
      // Network failures may be transient. An invalid refresh token is definitive.
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) clearSession();
    });
  }, delay);
}

function clearSocket() {
  socketGeneration += 1;
  clearTimeout(retryTimer);
  retryTimer = null;
  const old = socket; socket = null;
  if (old) { old.onclose = null; old.onerror = null; old.onmessage = null; old.close(); }
}

export function clearSession() { clearSocket(); clearTimeout(scheduledRefresh); scheduledRefresh=null; session = null; accessExpiresAt=0; }
export const isAuthenticated = () => Boolean(session);
export const getSession = () => session;
export const get = (path) => rawRequest(path);
export const post = (path, data) => rawRequest(path, { method: 'POST', data });
export const put = (path, data) => rawRequest(path, { method: 'PUT', data });
export const patch = (path, data) => rawRequest(path, { method: 'PATCH', data });
export const remove = (path) => rawRequest(path, { method: 'DELETE' });
export async function register(nickname, email, password) {
  return rawRequest('/auth/register', { method: 'POST', data: { nickname, email, password }, authorized: false });
}
export async function login(email, password) {
  const result = await rawRequest('/auth/login', { method: 'POST', data: { email, password }, authorized: false });
  clearSocket(); applySession(result);
  return result;
}
export async function logout() {
  try { if (session) await post('/auth/logout'); }
  finally { clearSession(); }
}

function wsUrl() {
  const explicit = import.meta.env?.VITE_WS_URL;
  if (explicit) return explicit;
  // Relative API URLs use the Vite /ws websocket proxy in development.
  const origin = API_BASE.startsWith('http') ? new URL(API_BASE).origin : location.origin;
  return origin.replace(/^http/, 'ws') + '/ws';
}

/** Tickets authenticate the socket without exposing JWTs in URLs or logs. */
export async function connectRealtime(eventHandler, connectionHandler = () => {}) {
  onEvent = eventHandler;
  onConnection = connectionHandler;
  clearSocket();
  const generation = socketGeneration;
  async function connect(attempt = 0) {
    if (!session || generation !== socketGeneration) return;
    try {
      const { ticket } = await post('/realtime/ticket');
      if (!session || generation !== socketGeneration) return;
      const ws = new WebSocket(wsUrl(), ['battleship.v1', `bn-ticket.${ticket}`]);
      socket = ws;
      ws.onopen = () => { if (generation === socketGeneration) onConnection(true); };
      ws.onmessage = (event) => {
        if (generation !== socketGeneration) return;
        try { const message = JSON.parse(event.data); if (message && typeof message.type === 'string') onEvent(message); }
        catch { /* ignore invalid transport payload */ }
      };
      ws.onclose = () => {
        if (generation !== socketGeneration) return;
        socket = null; onConnection(false);
        if (session) retryTimer = setTimeout(() => connect(Math.min(attempt + 1, 6)), Math.min(1500 * 2 ** attempt, 15000));
      };
      ws.onerror = () => { ws.close(); };
    } catch (error) {
      if (generation !== socketGeneration) return;
      if (error instanceof ApiError && error.status === 401) { clearSession(); onConnection(false); return; }
      onConnection(false);
      if (session) retryTimer = setTimeout(() => connect(Math.min(attempt + 1, 6)), Math.min(1500 * 2 ** attempt, 15000));
    }
  }
  await connect();
}
