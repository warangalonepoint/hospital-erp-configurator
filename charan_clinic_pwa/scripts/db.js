<script src="https://cdn.jsdelivr.net/npm/dexie@4.0.2/dist/dexie.min.js"></script>
<script>
// DB
export const db = new Dexie("charan_clinic");
db.version(1).stores({
  pins: "role",                        // role -> hashedPin
  settings: "key",
  patients: "++id, uid, name, phone, referredBy",
  bookings: "++id, date, slot, patientUid, type", // type: manual/online/whatsapp
  appointments: "++id, date, patientUid",
  pharmacyItems: "++id, sku, name, hsn, gst, mrp",
  stockBatches: "++id, sku, batch, expiry, qty",
  invoices: "++id, number, date, patientUid, total",
  invoiceItems: "++id, invoiceId, sku, qty, rate, gst",
  labInvoices: "++id, date, patientUid, tests, total",
  staff: "++id, name, phone, role",
  attendance: "++id, staffId, in, out",
  referrals: "++id, patientUid, by, commissionType, commissionValue",
  logs: "++id, ts, kind, note"
});

// one-time seed
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

// util hashing (WebCrypto)
export async function hashPin(pin){
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
</script>
