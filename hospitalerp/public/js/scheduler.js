// scheduler.js — minimal offline scheduler
const SCHED_DB = "hospital_erp_db";
const SCHED_VER = 3;
let sdb;

async function schedOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(SCHED_DB, SCHED_VER);
    r.onupgradeneeded = (ev) => {
      const d = ev.target.result;
      if (!d.objectStoreNames.contains("doctors")) {
        const s = d.createObjectStore("doctors", { keyPath: "id", autoIncrement: true });
        s.createIndex("name", "name");
      }
      if (!d.objectStoreNames.contains("slots")) {
        // slots: {id, doctorId, date(YYYY-MM-DD), time(HH:MM), len, status:"free|booked|blocked"}
        const s = d.createObjectStore("slots", { keyPath: "id", autoIncrement: true });
        s.createIndex("doctorDate", ["doctorId", "date"]);
        s.createIndex("date", "date");
      }
      if (!d.objectStoreNames.contains("appointments")) {
        // appts: {id, slotId, doctorId, date, time, patientId?, patientName, phone, notes, status}
        const s = d.createObjectStore("appointments", { keyPath: "id", autoIncrement: true });
        s.createIndex("doctorDate", ["doctorId", "date"]);
        s.createIndex("date", "date");
      }
    };
    r.onsuccess = () => { sdb = r.result; res(sdb); };
    r.onerror = () => rej(r.error);
  });
}
function stx(names, mode="readonly"){ return sdb.transaction(names, mode); }

async function listDoctors() {
  await schedOpen();
  return new Promise((res) => {
    const out = []; const req = stx(["doctors"]).objectStore("doctors").openCursor();
    req.onsuccess = (e) => { const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
  });
}
async function addDoctor(doc) {
  await schedOpen();
  return new Promise((res) => {
    stx(["doctors"], "readwrite").objectStore("doctors").add(doc).onsuccess = (e)=>res(e.target.result);
  });
}
async function upsertDoctorByName(name) {
  const docs = await listDoctors();
  const hit = docs.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;
  return await addDoctor({ name });
}

async function listSlots(doctorId, date) {
  await schedOpen();
  return new Promise((res) => {
    const idx = stx(["slots"]).objectStore("slots").index("doctorDate")
      .openCursor(IDBKeyRange.only([Number(doctorId), date]));
    const out = [];
    idx.onsuccess = (e)=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
  });
}
async function addSlot(slot) {
  await schedOpen();
  return new Promise((res)=> {
    stx(["slots"],"readwrite").objectStore("slots").add(slot).onsuccess = (e)=>res(e.target.result);
  });
}
async function bulkCreateSlots({ doctorId, date, start="09:00", end="13:00", len=15 }) {
  // generate HH:MM steps
  function* times(a,b,step){
    const [ah,am] = a.split(":").map(Number); const [bh,bm] = b.split(":").map(Number);
    let t = ah*60+am, stop = bh*60+bm;
    while (t < stop){ const h=String(Math.floor(t/60)).padStart(2,"0"), m=String(t%60).padStart(2,"0"); yield `${h}:${m}`; t += step; }
  }
  const ids = [];
  for (const t of times(start,end,len)){
    ids.push(await addSlot({ doctorId:Number(doctorId), date, time:t, len, status:"free" }));
  }
  return ids;
}

async function bookSlot({ slotId, patientName, phone, patientId, notes }) {
  await schedOpen();
  const tx = stx(["slots","appointments"],"readwrite");
  const slots = tx.objectStore("slots");
  const appts = tx.objectStore("appointments");
  const slot = await new Promise((res)=>{ slots.get(Number(slotId)).onsuccess = (e)=>res(e.target.result); });
  if (!slot || slot.status!=="free") throw new Error("Slot not available");
  slot.status = "booked";
  slots.put(slot);
  const appt = {
    slotId: slot.id, doctorId: slot.doctorId, date: slot.date, time: slot.time,
    patientId: patientId||null, patientName: patientName||"", phone: phone||"", notes: notes||"",
    status: "booked", ts: Date.now()
  };
  const id = await new Promise((res)=>{ appts.add(appt).onsuccess=(e)=>res(e.target.result); });
  return id;
}

async function cancelAppt(apptId) {
  await schedOpen();
  const tx = stx(["appointments","slots"],"readwrite");
  const appts = tx.objectStore("appointments");
  const slots = tx.objectStore("slots");
  const appt = await new Promise((res)=>{ appts.get(Number(apptId)).onsuccess=(e)=>res(e.target.result); });
  if (!appt) return;
  // free the slot
  const slot = await new Promise((res)=>{ slots.get(Number(appt.slotId)).onsuccess=(e)=>res(e.target.result); });
  if (slot){ slot.status="free"; slots.put(slot); }
  appt.status = "cancelled"; appts.put(appt);
}

async function listApptsByDoctorDate(doctorId, date) {
  await schedOpen();
  return new Promise((res)=>{
    const idx = stx(["appointments"]).objectStore("appointments").index("doctorDate")
      .openCursor(IDBKeyRange.only([Number(doctorId), date]));
    const out = [];
    idx.onsuccess = (e)=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
  });
}

window.SchedulerAPI = {
  schedOpen, listDoctors, addDoctor, upsertDoctorByName,
  listSlots, addSlot, bulkCreateSlots, bookSlot, cancelAppt, listApptsByDoctorDate
};
