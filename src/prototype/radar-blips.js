/**
 * Decorative sonar contacts, never matchmaking/player locations.
 * A 0° beam points north. CSS conic-gradient and the contacts share one
 * clockwise period; pulse delay is the point's polar angle / full rotation.
 */
export const RADAR_SWEEP_SECONDS = 2.2;
export const RADAR_CONTACTS = Object.freeze([
  {x:68,y:35}, {x:33,y:69}, {x:21,y:36}, {x:80,y:64},
  {x:56,y:20}, {x:42,y:84}, {x:78,y:25}, {x:17,y:53},
  {x:62,y:78}, {x:37,y:28}, {x:73,y:48}, {x:48,y:66},
]);
export function contactDelaySeconds({x,y}) {
  // CSS conic gradients start at the top and rotate clockwise.
  const degrees=(Math.atan2(x-50,50-y)*180/Math.PI+360)%360;
  return Number((degrees/360*RADAR_SWEEP_SECONDS).toFixed(4));
}
export function sonarContactMarkup() {
  return RADAR_CONTACTS.map((contact,index)=>
    `<span class="bn-radar-contact" style="left:${contact.x}%;top:${contact.y}%;--pulse-delay:${contactDelaySeconds(contact)}s" data-sonar-blip="${index+1}"></span>`
  ).join('');
}
