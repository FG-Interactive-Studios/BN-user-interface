/**
 * ZIP carrier corresponds to CARRIER. GD's named Destroier sprite is used for DESTROYER.
 * Do not silently map the ZIP submarine or battleship to SEARCH/DESTROYER.
 */
export const DEFAULT_SHIP_ART=Object.freeze({CARRIER:'/assets/bn-zip/ship-carrier.webp',
  DESTROYER:'/assets/bn-zip/ship-destroyer-gd.webp'});
export function shipArt(id){return Object.hasOwn(DEFAULT_SHIP_ART,id)?DEFAULT_SHIP_ART[id]:null;}
