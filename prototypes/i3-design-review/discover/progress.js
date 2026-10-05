import {byId,allById,modes} from './catalogue.js';
export const key='fixforward-discovery-v1';
export const legacyKey='fixforward-i3-site-v2';
export const empty=()=>({version:1,records:{},rounds:0,reading:'short',resume:null});
export function sanitise(value){
 const clean=empty();if(!value||typeof value!=='object')return clean;
 for(const [id,record] of Object.entries(value.records||{}))if(byId[id]&&record&&typeof record==='object')clean.records[id]=Object.fromEntries(['spot','plan','service','episode'].map(k=>[k,record[k]===true]));
 clean.rounds=Number.isInteger(value.rounds)&&value.rounds>=0?Math.min(value.rounds,100000):0;
 clean.reading=value.reading==='detail'?'detail':'short';
 const r=value.resume;
 if(r&&r.type==='station'&&Object.hasOwn(modes,r.mode)&&Array.isArray(r.queue)&&r.queue.length>0&&r.queue.length<=5&&r.queue.every(id=>allById[id]&&(r.mode==='spot'||byId[id]))&&Number.isInteger(r.index)&&r.index>=0&&r.index<r.queue.length){
  clean.resume={type:'station',mode:r.mode,queue:r.queue,index:r.index,clues:[false,false],chosen:null,reason:null};
 }
 if(r&&r.type==='episode'&&byId[r.id]&&Number.isInteger(r.step)&&r.step>=0&&r.step<=3){
  clean.resume={type:'episode',id:r.id,step:r.step,clues:[false,false],answered:false};
 }
 return clean;
}
export function load(storage){try{return {data:sanitise(JSON.parse(storage.getItem(key)||'null')),available:true};}catch{return {data:empty(),available:false};}}
export function save(storage,data){try{storage.setItem(key,JSON.stringify(data));return true;}catch{return false;}}
export function legacy(storage){try{const d=JSON.parse(storage.getItem(legacyKey)||'{}');return Array.isArray(d.stamps)?[...new Set(d.stamps.filter(id=>byId[id]))]:[];}catch{return [];}}
export function learned(records){return Object.keys(records).filter(id=>byId[id]&&Object.values(records[id]).some(v=>v===true));}
export function mark(data,id,skill){if(!byId[id]||!['spot','plan','service','episode'].includes(skill))return false;data.records[id]??={spot:false,plan:false,service:false,episode:false};const fresh=!data.records[id][skill];data.records[id][skill]=true;return fresh;}
