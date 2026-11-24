// Shared lifetime policy for transient messages. Acknowledgement-only notices
// explicitly opt out; an ordinary render must never extend a deadline.
export const NOTICE_DURATION=Object.freeze({success:4000,error:7000,combat:3200,power:5000,reading:12000});
export function createNoticeLifetime({now=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){
  let timer=null,deadline=null,generation=0;
  function clear(){generation++;if(timer!==null)cancel(timer);timer=null;deadline=null;}
  return {
    clear,
    start(duration,expire){
      clear();
      if(duration===null)return;
      const token=generation;
      deadline=now()+duration;
      timer=schedule(()=>{
        if(token!==generation)return;
        clear();expire();
      },duration);
    },
    expired(){return deadline!==null&&now()>=deadline;}
  };
}
