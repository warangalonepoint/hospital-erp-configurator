export const $ = (q,root=document)=>root.querySelector(q);
export const $$ = (q,root=document)=>[...root.querySelectorAll(q)];
export function toast(msg){ alert(msg); }
export function clearAll(){
  if(confirm("Clear cache and local data?")){
    caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
    indexedDB.databases?.().then(dbs=>dbs.forEach(d=>indexedDB.deleteDatabase(d.name)));
    location.reload();
  }
}
export function walink(text, phone=""){
  const t = encodeURIComponent(text);
  const p = phone ? `&phone=${phone.replace(/\D/g,"")}` : "";
  return `https://wa.me/?text=${t}${p}`;
}
