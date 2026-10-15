/** UI-only departure classification; API owns lobby membership.
 * LobbyResponse.players always lists the host first, then the guest.
 * A guest leaving keeps the host's room open; a host leaving closes it.
 */
export function roomDeparture(previous, current, viewerId) {
  if (!previous || !['WAITING', 'PREPARING'].includes(previous.status)) return null;
  if (!Array.isArray(previous.players) || previous.players.length !== 2) return null;
  const hostId = previous.players[0]?.id;
  if (hostId == null || viewerId == null) return null;
  if (!current) return viewerId !== hostId ? 'host-left' : null;
  if (previous.code !== current.code || !Array.isArray(current.players)) return null;
  if (current.players.length !== 1 || current.players[0]?.id !== hostId) return null;
  return viewerId === hostId ? 'guest-left' : null;
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
