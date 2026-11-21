import {isSoundEvent} from './audio-manager.js';
// Vite registers only real, versioned files. Missing files never become URLs.
const manifests=import.meta.glob('../assets/audio/*/manifest.json',{eager:true,import:'default'});
const assets=import.meta.glob('../assets/audio/**/*.ogg',{eager:true,query:'?url',import:'default'});
export const audioPacks=Object.create(null);
for(const [path,manifest] of Object.entries(manifests)){
  if(!manifest||manifest.version!==1||!/^sound_[a-z0-9_-]+$/.test(manifest.id))continue;
  const folder=path.slice(0,path.lastIndexOf('/')+1);
  const sounds=Object.create(null);
  for(const [event,file] of Object.entries(manifest.sounds||{})){
    if(!isSoundEvent(event)||typeof file!=='string'||! /^(music|sfx)\/[a-z0-9_-]+\.ogg$/.test(file))continue;
    const url=assets[folder+file];if(url)sounds[event]=url;
  }
  if(!Object.hasOwn(audioPacks,manifest.id))audioPacks[manifest.id]=sounds;
}
