// --- inventory.js ---
// Offline IndexedDB + FEFO inventory

const dbName = "hospital_erp_db";
let db;

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("items")) {
        d.createObjectStore("items", { keyPath: "id", autoIncrement: true });
      }
      if (!d.objectStoreNames.contains("batches")) {
        const s = d.createObjectStore("batches", { keyPath: "id", autoIncrement: true });
        s.createIndex("itemId", "itemId", { unique: false });
      }
    };
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = (e) => rej(e);
  });
}

// ==== Items ====
async function addItem(it) {
  const tx = db.transaction("items", "readwrite");
  return new Promise((res) => {
    tx.objectStore("items").add(it).onsuccess = (e) => res(e.target.result);
  });
}
async function listItems() {
  return new Promise((res) => {
    db.transaction("items").objectStore("items").getAll().onsuccess = (e) => res(e.target.result);
  });
}
async function getItem(id) {
  return new Promise((res) => {
    db.transaction("items").objectStore("items").get(id).onsuccess = (e) => res(e.target.result);
  });
}

// ==== Batches ====
async function addBatch(b) {
  const tx = db.transaction("batches", "readwrite");
  return new Promise((res) => {
    tx.objectStore("batches").add(b).onsuccess = (e) => res(e.target.result);
  });
}
async function listBatches(itemId) {
  return new Promise((res) => {
    const idx = db.transaction("batches").objectStore("batches").index("itemId");
    const r = idx.getAll(IDBKeyRange.only(itemId));
    r.onsuccess = (e) => res(e.target.result);
  });
}

// ==== FEFO: issue stock ====
async function issueStock(itemId, qty, ref = "") {
  const batches = await listBatches(itemId);
  batches.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  let remain = qty;
  for (const b of batches) {
    if (remain <= 0) break;
    const take = Math.min(b.qty, remain);
    b.qty -= take;
    remain -= take;
    await new Promise((res) => {
      db.transaction("batches", "readwrite").objectStore("batches").put(b).onsuccess = () => res();
    });
  }
  if (remain > 0) throw new Error("Insufficient stock");
}

// ==== Snapshot (qty + flags) ====
async function stockSnapshot() {
  const items = await listItems();
  const out = [];
  for (const it of items) {
    const bs = await listBatches(it.id);
    let qty = 0;
    let nearExp = false;
    const now = new Date();
    const nearDays = (JSON.parse(localStorage.erpConfig || "{}").inventory?.nearExpiryDays) || 60;
    for (const b of bs) {
      qty += b.qty;
      const exp = new Date(b.expiry);
      if (b.qty > 0 && exp - now < nearDays * 864e5) nearExp = true;
    }
    out.push({ item: it, qty, batches: bs, nearExp });
  }
  return out;
}

// ==== CSV Export ====
async function exportCSV() {
  const snap = await stockSnapshot();
  let rows = [["Item", "HSN", "MRP", "Qty", "Batch", "Expiry", "Buy Price"]];
  snap.forEach(r => {
    r.batches.forEach(b => {
      rows.push([
        r.item.name,
        r.item.hsn || "",
        r.item.mrp || "",
        b.qty,
        b.batchNo || "",
        b.expiry || "",
        b.buyPrice || ""
      ]);
    });
  });
  const csv = rows.map(r => r.join(",")).join("\n");
  download("inventory.csv", csv);
}

// ==== File download helper (fixed for iframe/mobile) ====
function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// ==== Alerts ====
async function showAlerts() {
  const snap = await stockSnapshot();
  const thr = (JSON.parse(localStorage.erpConfig || "{}").inventory?.lowStockThreshold) || 10;
  const low = snap.filter(r => r.qty <= thr);
  const near = snap.filter(r => r.nearExp);
  alert(`Low stock:\n${low.map(r => r.item.name + " (" + r.qty + ")").join("\n") || "None"}\n\nNear expiry:\n${near.map(r => r.item.name).join("\n") || "None"}`);
}

// ==== Expose API for UI ====
window.InventoryAPI = { openDB, addItem, listItems, getItem, addBatch, listBatches, issueStock, stockSnapshot, exportCSV, showAlerts };
