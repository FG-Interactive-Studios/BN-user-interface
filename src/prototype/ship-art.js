/**
 * Only approved matching class is reused from the supplied ZIP.
 * Do not silently turn the ZIP submarine/battleship into GD SEARCH/DESTROYER.
 */
export const DEFAULT_SHIP_ART=Object.freeze({CARRIER:'/assets/bn-zip/ship-carrier.webp'});
export function shipArt(id){return Object.hasOwn(DEFAULT_SHIP_ART,id)?DEFAULT_SHIP_ART[id]:null;}
