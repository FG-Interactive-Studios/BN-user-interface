/** Display-only countdowns from UTC deadlines supplied by the backend.
 * No timer tick changes gameplay, player permissions or server state.
 */
export function remainingSeconds(deadline,now=Date.now()) {
  if(!deadline)return null;
  const end=Date.parse(deadline);
  if(!Number.isFinite(end))return null;
  return Math.max(0,Math.ceil((end-now)/1000));
}
export function countdown(deadline,now=Date.now()) {
  const seconds=remainingSeconds(deadline,now);
  if(seconds===null)return '—';
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
export function updateClockNodes(root,now=Date.now()) {
  root?.querySelectorAll?.('[data-deadline-at]').forEach(node=>{
    const paused=node.dataset.clockPaused==='true';
    const value=remainingSeconds(node.dataset.deadlineAt,now);
    node.textContent=paused?'Pausado':countdown(node.dataset.deadlineAt,now);
    node.classList.toggle('bn-clock-warning',!paused&&value!==null&&value<=5);
  });
}
