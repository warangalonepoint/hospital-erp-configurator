// /scripts/db.js  (NO <script> tags here)
export const db = new Dexie("charan_clinic");
db.version(1).stores({
  pins: "role",
  settings: "key",
  patients: "++id, uid, name, phone, referredBy",
  bookings: "++id, date, slot, patientUid, type",
  appointments: "++id, date, patientUid, time, note, type, fromBookingId",
  pharmacyItems: "++id, sku, name, hsn, gst, mrp",
  stockBatches: "++id, sku, batch, expiry, qty",
  invoices: "++id, number, date, patientUid, total, gst, discount",
  invoiceItems: "++id, invoiceId, sku, qty, rate, gst",
  labInvoices: "++id, number, date, patientUid, total, base, gst, discount, tests",
  staff: "++id, name, phone, role, shift",
  attendance: "++id, staffId, in, out",
  referrals: "++id, patientUid, by, commissionType, commissionValue",
  logs: "++id, ts, kind, store, op, key" // used by sync
});

export async function hashPin(pin){
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

export async function ensureSeed(){
  await db.open();
  const hasPins = await db.pins.count();
  if(!hasPins){
    await db.pins.bulkPut([
      { role: "doctor",     hashedPin: await hashPin("1111") },
      { role: "supervisor", hashedPin: await hashPin("2222") },
      { role: "front",      hashedPin: await hashPin("3333") },
      { role: "master",     hashedPin: await hashPin("9999") },
      { role: "mrs",        hashedPin: await hashPin("0000") }
    ]);
    await db.settings.put({key:"theme", value:"dark"});
  }
}
