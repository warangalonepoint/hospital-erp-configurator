<!-- inventory.js -->
<script>
/* ========= Tiny Config Loader (reads from ?cfg=base64 or localStorage.erpConfig) ========= */
window.erp = (function () {
  function decodeCfg(b64) {
    try { return JSON.parse(atob(decodeURIComponent(b64))); } catch { return null; }
  }
  const url = new URL(location.href);
  const cfgB64 = url.searchParams.get("cfg");
  let config = cfgB64 ? decodeCfg(cfgB64) : null;
  if (!config) {
    try { config = JSON.parse(localStorage.getItem("erpConfig")||"{}"); } catch { config = {}; }
  }
  // sensible defaults
  const defaults = {
    inventory:{ enabled:true, lowStockThreshold:10, nearExpiryDays:60 },
    branding:{ clinicName:"Clinic", primaryColor:"#0ea5e9" }
  };
  function deepMerge(a,b){ for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=deepMerge(a[k]||{},b[k]) } else { if(a[k]===undefined) a[k]=b[k] } } return a }
  return deepMerge(config||{}, defaults);
})();

/* ============================== IndexedDB (offline-first) =============================== */
const DB_NAME = "hospital_erp_db";
const DB_VERSION = 2;
let db;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev)=>{
      const d = ev.target.result;
      if(!d.objectStoreNames.contains("items")){
        const s = d.createObjectStore("items",{keyPath:"id", autoIncrement:true});
        s.createIndex("name","name",{unique:false});
        s.createIndex("barcode","barcode",{unique:false});
      }
      if(!d.objectStoreNames.contains("batches")){
        const s = d.createObjectStore("batches",{keyPath:"id", autoIncrement:true});
        s.createIndex("itemId","itemId");
        s.createIndex("expiry","expiry");
      }
      if(!d.objectStoreNames.contains("stock_moves")){
        const s = d.createObjectStore("stock_moves",{keyPath:"id", autoIncrement:true});
        s.createIndex("itemId","itemId");
        s.createIndex("ts","ts");
        s.createIndex("type","type");
      }
      if(!d.objectStoreNames.contains("suppliers")){
        d.createObjectStore("suppliers",{keyPath:"id", autoIncrement:true});
      }
    };
    req.onsuccess = ()=>{ db=req.result; resolve(db); };
    req.onerror = ()=>reject(req.error);
  });
}

function tx(storeNames, mode="readonly"){ return db.transaction(storeNames, mode); }

/* ============================== Helpers / Utilities ==================================== */
function fmtDate(d){ return new Date(d).toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.ceil((new Date(b)-new Date(a))/(1000*60*60*24)); }

/* ============================== Items / Batches Ops ==================================== */
async function addItem(item){
  await openDB(); 
  const t=tx(["items"],"readwrite"); 
  return new Promise((res,rej)=>{ const req=t.objectStore("items").add(item); req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); });
}
async function listItems(){
  await openDB(); 
  return new Promise((res,rej)=>{
    const out=[]; const r=tx(["items"]).objectStore("items").openCursor();
    r.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue() } else res(out) };
    r.onerror=()=>rej(r.error);
  });
}
async function getItem(id){
  await openDB();
  return new Promise((res,rej)=>{ const r=tx(["items"]).objectStore("items").get(Number(id)); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
}
async function addBatch(batch){
  await openDB();
  const t=tx(["batches"],"readwrite");
  return new Promise((res,rej)=>{ const r=t.objectStore("batches").add(batch); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
}
async function listBatchesByItem(itemId){
  await openDB();
  return new Promise((res,rej)=>{
    const out=[]; const idx=tx(["batches"]).objectStore("batches").index("itemId").openCursor(IDBKeyRange.only(Number(itemId)));
    idx.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue() } else res(out) };
    idx.onerror=()=>rej(idx.error);
  });
}
async function addMove(move){
  await openDB();
  const t=tx(["stock_moves"],"readwrite");
  return new Promise((res,rej)=>{ const r=t.objectStore("stock_moves").add(move); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
}

/* ============================== Stock Logic ============================================ */
// FEFO (expiry asc) consume
async function issueStock(itemId, qty, ref="SALE"){
  const batches = (await listBatchesByItem(itemId)).sort((a,b)=>new Date(a.expiry)-new Date(b.expiry));
  let remain = qty;
  for(const b of batches){
    if(remain<=0) break;
    const take = Math.min(b.qty, remain);
    b.qty -= take; remain -= take;
    await updateBatch(b.id, {qty:b.qty});
    await addMove({type:"sale", itemId:Number(itemId), batchId:b.id, qty:take, ref, ts:Date.now()});
  }
  if(remain>0) throw new Error("Insufficient stock");
}
async function updateBatch(id, patch){
  await openDB();
  const t=tx(["batches"],"readwrite"); const store=t.objectStore("batches");
  const current = await new Promise((res,rej)=>{ const r=store.get(Number(id)); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const updated = {...current, ...patch};
  return new Promise((res,rej)=>{ const r=store.put(updated); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); });
}
async function currentQty(itemId){
  const batches = await listBatchesByItem(itemId);
  return batches.reduce((s,b)=>s+(b.qty||0),0);
}
async function stockSnapshot(){
  const items = await listItems();
  const rows = [];
  for(const it of items){
    const batches = await listBatchesByItem(it.id);
    const qty = batches.reduce((s,b)=>s+(b.qty||0),0);
    const nearExpDays = window.erp.inventory.nearExpiryDays;
    const near = batches.filter(b=>daysBetween(new Date(), b.expiry)<=nearExpDays && b.qty>0);
    const low = qty <= (window.erp.inventory.lowStockThreshold||10);
    rows.push({item:it, qty, batches, low, nearCount:near.length});
  }
  return rows;
}

/* ============================== CSV / Print ============================================ */
function toCSV(rows){
  const header = ["Item","HSN","Unit","Tax%","MRP","BuyPrice","Qty","NearExpiryBatches"];
  const lines = [header.join(",")];
  rows.forEach(r=>{
    lines.push([
      `"${r.item.name}"`,
      r.item.hsn||"",
      r.item.unit||"",
      r.item.tax||0,
      r.item.mrp||0,
      r.item.buyPrice||0,
      r.qty,
      r.nearCount
    ].join(","));
  });
  return lines.join("\n");
}
function download(filename, text){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type:"text/plain"}));
  a.download=filename; a.click();
}

/* ============================== Label / Barcode (text-only fallback) ==================== */
function printShelfLabel(item){
  const w = window.open("","_blank","width=400,height=240");
  w.document.write(`
    <html><body style="font-family:system-ui;padding:16px">
      <div style="border:1px dashed #000;padding:12px">
        <div style="font-weight:700">${window.erp.branding?.clinicName||"Clinic"}</div>
        <div style="font-size:20px">${item.name}</div>
        <div>HSN: ${item.hsn||"-"} • Unit: ${item.unit||"-"}</div>
        <div>MRP: ₹${item.mrp||0}</div>
        <div style="margin-top:8px">Barcode: ${item.barcode||"-"}</div>
      </div>
      <script>window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}

/* ============================== Expose to pages ========================================= */
window.InventoryAPI = {
  openDB, addItem, listItems, getItem,
  addBatch, listBatchesByItem, addMove, issueStock, updateBatch,
  currentQty, stockSnapshot,
  toCSV, download, printShelfLabel
};
</script>
