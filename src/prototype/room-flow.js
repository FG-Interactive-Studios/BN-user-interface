/** Pure UI transitions. Backend remains authoritative for room membership. */
export function roomPartnerDeparted(previous, current) {
  if (!previous || !['WAITING', 'PREPARING'].includes(previous.status)) return false;
  if (!Array.isArray(previous.players) || previous.players.length < 2) return false;
  if (!current) return true;
  return previous.code === current.code &&
    Array.isArray(current.players) && current.players.length < 2;
}
export function resolvedRoute(route, authenticated, roomStatus = null) {
  if (authenticated && (route === 'auth' || route === 'register')) {
    if (roomStatus === 'WAITING') return 'matchmaking';
    if (roomStatus === 'PREPARING') return 'placement';
    if (roomStatus === 'PLAYING') return 'match';
    if (roomStatus === 'FINISHED') return 'result';
    return 'lobby';
  }
  return route;
}
