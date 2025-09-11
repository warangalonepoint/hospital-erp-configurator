"use client";
import React, { useMemo, useRef, useState } from "react";

/** ─────────────────────────────────────────────────────────────────────────────
 * Pricing + Features
 * ────────────────────────────────────────────────────────────────────────────*/
type Tier = "basic" | "standard" | "pro";

const TIERS: Record<Tier, { label: string; price: number; amc: number }> = {
  basic: { label: "Clinic Basic", price: 59999, amc: 12000 },
  standard: { label: "Hospital Standard", price: 109999, amc: 20000 },
  pro: { label: "Multi-Specialty Pro", price: 199999, amc: 40000 },
};

type Feature = {
  id: string;
  label: string;
  category:
    | "Core"
    | "Appointments"
    | "Billing & GST"
    | "Inventory & Pharmacy"
    | "Lab/Diagnostics"
    | "HR"
    | "Analytics"
    | "Operations";
  minTier: Tier;
  addonPrice?: number;
  help?: string;
};

const FEATURES: Feature[] = [
  // Core
  { id: "branding", label: "Branding (logo, colors, domain)", category: "Core", minTier: "basic", addonPrice: 0, help: "App name, logo, theme color, manifest" },
  { id: "qr_uid", label: "Universal Patient ID + QR/Barcode History", category: "Core", minTier: "basic", addonPrice: 10000 },
  { id: "dashboard", label: "Admin Dashboard (daily stats)", category: "Core", minTier: "basic", addonPrice: 6000 },

  // Appointments / Patients
  { id: "bookings", label: "Doctor Appointments & Slots", category: "Appointments", minTier: "basic", addonPrice: 10000 },
  { id: "patients", label: "Patient Profiles & Records", category: "Appointments", minTier: "basic", addonPrice: 8000 },
  { id: "multi_user", label: "Multi-User Roles (Admin/Doctor/Reception/Accounts)", category: "Appointments", minTier: "standard", addonPrice: 15000 },

  // Billing/GST
  { id: "billing_gst", label: "Billing + GST Invoices + Exports", category: "Billing & GST", minTier: "basic", addonPrice: 12000 },

  // Inventory/Pharmacy
  { id: "inventory_basic", label: "Pharmacy / Inventory (basic) + Low Stock Alerts", category: "Inventory & Pharmacy", minTier: "basic", addonPrice: 12000 },

  // Lab/Diagnostics
  { id: "lab", label: "Diagnostics/Lab Orders + PDF Reports", category: "Lab/Diagnostics", minTier: "standard", addonPrice: 20000 },

  // HR
  { id: "attendance", label: "Staff Attendance (simple)", category: "HR", minTier: "basic", addonPrice: 6000 },
  { id: "hr_payroll", label: "HR Payroll (leave, shifts, payslips)", category: "HR", minTier: "pro", addonPrice: 30000 },

  // Analytics
  { id: "branch_analytics", label: "Branch-wise Analytics", category: "Analytics", minTier: "standard", addonPrice: 12000 },
  { id: "custom_dash", label: "Custom Analytics & Dashboards", category: "Analytics", minTier: "pro", addonPrice: 25000 },

  // Ops / Growth
  { id: "multibranch", label: "Multi-Branch Support (2+ locations)", category: "Operations", minTier: "pro", addonPrice: 24000 },
  { id: "insurance_tpa", label: "Insurance/TPA Claims Module", category: "Operations", minTier: "pro", addonPrice: 28000 },
  { id: "whatsapp_auto", label: "WhatsApp Automation (reminders, bills)", category: "Operations", minTier: "pro", addonPrice: 24000 },
];

const CATEGORIES = Array.from(new Set(FEATURES.map(f => f.category)));
const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const highestTier = (tiers: Tier[]): Tier =>
  tiers.includes("pro") ? "pro" : tiers.includes("standard") ? "standard" : "basic";

/** Tier color coding (filled tiles) */
const TIER_STYLES: Record<
  Tier,
  { chipBg: string; chipText: string; chipBorder: string; tileBg: string; tileBorder: string; tileHover: string; }
> = {
  basic:    { chipBg: "bg-emerald-100",  chipText: "text-emerald-900",  chipBorder: "border-emerald-200",  tileBg: "bg-emerald-100/70",  tileBorder: "border-emerald-200",  tileHover: "hover:border-emerald-400" },
  standard: { chipBg: "bg-amber-100",    chipText: "text-amber-900",    chipBorder: "border-amber-200",    tileBg: "bg-amber-100/70",    tileBorder: "border-amber-200",    tileHover: "hover:border-amber-400" },
  pro:      { chipBg: "bg-fuchsia-100",  chipText: "text-fuchsia-900",  chipBorder: "border-fuchsia-200",  tileBg: "bg-fuchsia-100/70",  tileBorder: "border-fuchsia-200",  tileHover: "hover:border-fuchsia-400" },
};

/** Category pastel fills */
const CAT_STYLES: Record<string, { bg: string; ring: string; header: string }> = {
  "Core":                 { bg: "bg-sky-50",      ring: "ring-sky-200",      header: "text-sky-900" },
  "Appointments":         { bg: "bg-emerald-50",  ring: "ring-emerald-200",  header: "text-emerald-900" },
  "Billing & GST":        { bg: "bg-amber-50",    ring: "ring-amber-200",    header: "text-amber-900" },
  "Inventory & Pharmacy": { bg: "bg-cyan-50",     ring: "ring-cyan-200",     header: "text-cyan-900" },
  "Lab/Diagnostics":      { bg: "bg-violet-50",   ring: "ring-violet-200",   header: "text-violet-900" },
  "HR":                   { bg: "bg-rose-50",     ring: "ring-rose-200",     header: "text-rose-900" },
  "Analytics":            { bg: "bg-indigo-50",   ring: "ring-indigo-200",   header: "text-indigo-900" },
  "Operations":           { bg: "bg-fuchsia-50",  ring: "ring-fuchsia-200",  header: "text-fuchsia-900" },
};

/** Helpers */
function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function uploadFile(): Promise<string> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return resolve("{}");
      const r = new FileReader(); r.onload = () => resolve(String(r.result || "{}")); r.readAsText(f);
    };
    input.click();
  });
}
function Tip({ text }: { text: string }) {
  return (
    <span className="relative group cursor-help select-none">
      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-neutral-100">?</span>
      <span className="invisible group-hover:visible absolute z-10 left-1/2 -translate-x-1/2 mt-2 text-xs bg-black text-white px-2 py-1 rounded shadow">
        {text}
      </span>
    </span>
  );
}

/** ─────────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────────────*/
export default function FeatureConfigurator() {
  // Defaults
  const [selected, setSelected] = useState<Record<string, boolean>>({
    branding: true, qr_uid: true, bookings: true, patients: true,
    billing_gst: true, inventory_basic: true, attendance: true, dashboard: true,
  });
  const [pricingMode, setPricingMode] = useState<"tiered" | "alacarte">("tiered");

  // Branding + Contact
  const [clinicName, setClinicName] = useState("Dr. Charan Hospital");
  const [clinicAddress, setClinicAddress] = useState("1st Floor, Main Road, Hyderabad, TS 500001");
  const [clinicPhone, setClinicPhone] = useState("+91 90000 00000");
  const [clinicEmail, setClinicEmail] = useState("admin@drcharanhospital.in");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Quote meta
  const today = new Date().toISOString().slice(0,10);
  const [quoteNumber, setQuoteNumber] = useState<string>(`Q-${today.replaceAll("-","")}-001`);
  const [quoteDate, setQuoteDate] = useState<string>(today);
  const [terms, setTerms] = useState<string>(
    "1) Prices in INR, exclusive of applicable taxes.\n" +
    "2) 50% advance to kick-off, balance on delivery.\n" +
    "3) Includes 30 days warranty; AMC covers updates & support.\n" +
    "4) Customizations billed separately if out of scope.\n" +
    "5) Delivery: 2–6 weeks based on selected modules."
  );

  // Quote controls
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [gstPct, setGstPct] = useState<number>(18);

  const selectedFeatures = useMemo(() => FEATURES.filter(f => selected[f.id]), [selected]);

  const requiredTier: Tier = useMemo(() => {
    if (pricingMode === "alacarte") return "basic";
    const tiers = selectedFeatures.map(f => f.minTier);
    return highestTier(tiers);
  }, [selectedFeatures, pricingMode]);

  const basePrice  = pricingMode === "tiered" ? TIERS[requiredTier].price : TIERS.basic.price;
  const amc        = pricingMode === "tiered" ? TIERS[requiredTier].amc   : TIERS.basic.amc;
  const addonsPrice = pricingMode === "alacarte" ? selectedFeatures.reduce((sum, f) => sum + (f.addonPrice || 0), 0) : 0;
  const grandTotal = basePrice + addonsPrice;

  // Discount + GST math
  const discountAmt = Math.round((grandTotal * (discountPct || 0)) / 100);
  const netAfterDiscount = grandTotal - discountAmt;
  const gstAmt = Math.round((netAfterDiscount * (gstPct || 0)) / 100);
  const finalWithGST = netAfterDiscount + gstAmt;

  // Exportable config JSON
  const configJson = useMemo(() =>
    JSON.stringify({
      v: 1,
      org: { name: clinicName, address: clinicAddress, phone: clinicPhone, email: clinicEmail, logoUrl, primaryColor },
      quote: { number: quoteNumber, date: quoteDate, discountPct, gstPct },
      pricing: {
        mode: pricingMode,
        baseTier: requiredTier, basePrice, addonsPrice,
        netAfterDiscount, gstAmt, finalWithGST, amc
      },
      features: selectedFeatures.map(f => f.id),
      terms,
      generatedAt: new Date().toISOString()
    }, null, 2),
    [clinicName, clinicAddress, clinicPhone, clinicEmail, logoUrl, primaryColor, quoteNumber, quoteDate, discountPct, gstPct, pricingMode, requiredTier, basePrice, addonsPrice, netAfterDiscount, gstAmt, finalWithGST, amc, selectedFeatures, terms]
  );

  const toggle = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => setLogoUrl(String(ev.target?.result)); r.readAsDataURL(file);
  };

  // Shareable URL
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("cfg", btoa(unescape(encodeURIComponent(configJson))));
    const newUrl = `${window.location.pathname}?${q.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [configJson]);

  // Load from URL (once)
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("cfg");
    if (!raw) return;
    try {
      const text = decodeURIComponent(escape(atob(raw)));
      const obj = JSON.parse(text);
      setClinicName(obj.org?.name ?? clinicName);
      setClinicAddress(obj.org?.address ?? clinicAddress);
      setClinicPhone(obj.org?.phone ?? clinicPhone);
      setClinicEmail(obj.org?.email ?? clinicEmail);
      setLogoUrl(obj.org?.logoUrl ?? null);
      setPrimaryColor(obj.org?.primaryColor ?? primaryColor);
      setQuoteNumber(obj.quote?.number ?? quoteNumber);
      setQuoteDate(obj.quote?.date ?? quoteDate);
      setDiscountPct(Number(obj.quote?.discountPct ?? 0));
      setGstPct(Number(obj.quote?.gstPct ?? 18));
      setTerms(obj.terms ?? terms);
      const next: Record<string, boolean> = {};
      FEATURES.forEach(f => (next[f.id] = !!obj.features?.includes(f.id)));
      setSelected(next);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Build a clean proposal HTML and auto-print (Download PDF via browser) */
  const exportPdf = () => {
    const featuresList = selectedFeatures.map(f => `<li>${f.label}</li>`).join("");
    const win = window.open("", "_blank");
    if (!win) return alert("Popup blocked. Allow popups to export PDF.");
    win.document.write(`
      <html>
        <head>
          <title>Proposal - ${clinicName}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; margin: 24px; color: #111; }
            .hdr { display:flex; align-items:center; gap:16px; border-bottom:1px solid #ddd; padding-bottom:12px; margin-bottom:16px; }
            .logo { width:56px; height:56px; border-radius:12px; background:#eee; overflow:hidden; display:flex; align-items:center; justify-content:center; }
            h1 { margin: 0; font-size: 20px; }
            .meta { font-size:12px; color:#555 }
            .card { border:1px solid #e5e5e5; border-radius:12px; padding:16px; margin:12px 0; }
            .row { display:flex; justify-content:space-between; margin:6px 0; }
            .muted { color:#666; }
            ul { margin:0; padding-left:18px; }
            .tot { font-weight:700; font-size:16px; }
            .footer { margin-top:24px; font-size:12px; color:#555; }
            .terms { white-space:pre-wrap; }
          </style>
        </head>
        <body>
          <div class="hdr">
            <div class="logo">${logoUrl ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:cover">` : clinicName.charAt(0)}</div>
            <div>
              <h1>${clinicName} — Proposal</h1>
              <div class="meta">${clinicAddress}<br/>${clinicPhone} • ${clinicEmail}</div>
            </div>
            <div style="margin-left:auto;text-align:right" class="meta">
              <div><b>Quote No:</b> ${quoteNumber}</div>
              <div><b>Date:</b> ${quoteDate}</div>
            </div>
          </div>

          <div class="card">
            <b>Selected Modules</b>
            <ul>${featuresList || "<li>No features selected</li>"}</ul>
          </div>

          <div class="card">
            <b>Pricing</b>
            <div class="row"><span>Base (${TIERS[requiredTier].label})</span><span>${fmtINR(basePrice)}</span></div>
            ${pricingMode === "alacarte" ? `<div class="row"><span>Add-ons</span><span>${fmtINR(addonsPrice)}</span></div>` : ``}
            <div class="row"><span>Subtotal</span><span>${fmtINR(grandTotal)}</span></div>
            <div class="row"><span>Discount (${discountPct}%)</span><span>- ${fmtINR(discountAmt)}</span></div>
            <div class="row"><span>Net</span><span>${fmtINR(netAfterDiscount)}</span></div>
            <div class="row"><span>GST (${gstPct}%)</span><span>${fmtINR(gstAmt)}</span></div>
            <div class="row tot"><span>Total w/ GST</span><span>${fmtINR(finalWithGST)}</span></div>
            <div class="row"><span class="muted">AMC / year</span><span class="muted">${fmtINR(amc)}</span></div>
          </div>

          <div class="card">
            <b>Terms & Conditions</b>
            <div class="terms">${(terms || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br/>")}</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  /** Compose email via mailto with summary + share link */
  const emailQuote = () => {
    const subject = encodeURIComponent(`Quote ${quoteNumber} — ${clinicName}`);
    const bodyLines = [
      `Hello,`,
      ``,
      `Please find the proposal for ${clinicName}.`,
      ``,
      `Quote No: ${quoteNumber}`,
      `Date: ${quoteDate}`,
      `Plan: ${TIERS[requiredTier].label} (${pricingMode === "alacarte" ? "À-la-carte" : "Tiered"})`,
      `Subtotal: ${fmtINR(grandTotal)}`,
      `Discount: ${discountPct}% (-${fmtINR(discountAmt)})`,
      `GST: ${gstPct}% (${fmtINR(gstAmt)})`,
      `Total w/ GST: ${fmtINR(finalWithGST)}`,
      ``,
      `Selected modules: ${selectedFeatures.map(f => f.label).join(", ") || "None"}`,
      ``,
      `Share link: ${window.location.href}`,
      ``,
      `--`,
      `${clinicName}`,
      `${clinicAddress}`,
      `${clinicPhone} • ${clinicEmail}`
    ].join("\n");
    const body = encodeURIComponent(bodyLines);
    window.location.href = `mailto:${clinicEmail}?subject=${subject}&body=${body}`;
  };

  /** UI helpers */
  const priceCardBorder = {
    basic: "ring-emerald-200",
    standard: "ring-amber-200",
    pro: "ring-fuchsia-200",
  }[requiredTier];

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white text-neutral-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-neutral-200 flex items-center justify-center overflow-hidden ring-1 ring-black/5">
            {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" alt="logo" /> : <span className="font-semibold text-neutral-600">{clinicName.trim().charAt(0) || "H"}</span>}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Hospital PWA ERP — Configurator</h1>
            <p className="text-xs text-neutral-500">Tick features, auto-pick plan, export / share / print.</p>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium">{clinicName}</div>
              <div className="text-neutral-500">{clinicAddress}</div>
              <div className="text-neutral-500">{clinicPhone} • {clinicEmail}</div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl bg-neutral-900 text-white hover:opacity-90">
              Upload Logo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid lg:grid-cols-3 gap-8" id="printable">
        {/* LEFT: Branding + Pricing */}
        <section className="lg:col-span-1 space-y-6 lg:sticky lg:top-20 self-start">
          {/* Branding */}
          <div className="rounded-3xl p-5 shadow-md ring-1 ring-neutral-200 bg-neutral-50 space-y-3">
            <h2 className="font-semibold tracking-tight">Branding & Contact</h2>
            <label className="text-xs text-neutral-500">Clinic / Hospital Name</label>
            <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            <label className="text-xs text-neutral-500">Address</label>
            <input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500">Phone</label>
                <input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Email</label>
                <input value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </div>
            </div>
            <label className="text-xs text-neutral-500">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 border rounded-lg" />
              <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 border rounded-xl px-3 py-2" />
            </div>
          </div>

          {/* Quote Meta */}
          <div className="rounded-3xl p-5 shadow-md ring-1 ring-neutral-200 bg-neutral-50 space-y-3">
            <h2 className="font-semibold tracking-tight">Quote Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500">Quote Number</label>
                <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Date</label>
                <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
              </div>
            </div>
          </div>

          {/* Mode */}
          <div className="rounded-3xl p-5 shadow-md ring-1 ring-neutral-200 bg-neutral-50 space-y-4">
            <h2 className="font-semibold tracking-tight">Pricing Mode</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setPricingMode("tiered")} className={`px-3 py-2 rounded-xl border text-sm ${pricingMode === "tiered" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"}`}>Tiered (auto plan)</button>
              <button onClick={() => setPricingMode("alacarte")} className={`px-3 py-2 rounded-xl border text-sm ${pricingMode === "alacarte" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"}`}>À-la-carte (custom)</button>
            </div>
            <p className="text-xs text-neutral-500">Tiered picks the lowest plan that supports selected features. À-la-carte sticks to Basic and adds per-feature prices.</p>
          </div>

          {/* Price Summary */}
          <div className={`rounded-3xl p-5 shadow-md ring-1 bg-white ${priceCardBorder}`}>
            <h2 className="font-semibold mb-1 tracking-tight">Price Summary</h2>
            {requiredTier === "standard" && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 border text-amber-900 mb-2">Most popular</span>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Base ({TIERS[requiredTier].label})</span><span>{fmtINR(basePrice)}</span></div>
              {pricingMode === "alacarte" && (<div className="flex justify-between"><span>Add-ons</span><span>{fmtINR(addonsPrice)}</span></div>)}
              <div className="flex justify-between font-medium border-t pt-2"><span>Subtotal</span><span>{fmtINR(grandTotal)}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col"><span className="text-xs text-neutral-500">Discount (%)</span><input type="number" value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="border rounded-xl px-2 py-1" min={0} max={50} /></label>
                <label className="flex flex-col"><span className="text-xs text-neutral-500">GST (%)</span><input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} className="border rounded-xl px-2 py-1" min={0} max={28} /></label>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between"><span>Discount</span><span>- {fmtINR(discountAmt)}</span></div>
                <div className="flex justify-between"><span>Net</span><span>{fmtINR(netAfterDiscount)}</span></div>
                <div className="flex justify-between"><span>GST ({gstPct}%)</span><span>{fmtINR(gstAmt)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2 text-base"><span>Total w/ GST</span><span>{fmtINR(finalWithGST)}</span></div>
                <div className="flex justify-between text-neutral-600"><span>AMC / year</span><span>{fmtINR(amc)}</span></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={emailQuote} className="px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50">Email Quote</button>
              <button onClick={exportPdf} className="px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50">Export PDF</button>
              <button onClick={async () => { await navigator.clipboard.writeText(window.location.href); alert("Share link copied!"); }} className="px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50">Copy Share Link</button>
            </div>
          </div>

          {/* Terms */}
          <div className="rounded-3xl p-5 shadow-md ring-1 ring-neutral-200 bg-neutral-50 space-y-2">
            <h2 className="font-semibold tracking-tight">Terms & Conditions</h2>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={6} className="w-full border rounded-xl px-3 py-2" />
          </div>
        </section>

        {/* RIGHT: Features + Export */}
        <section className="lg:col-span-2 space-y-6">
          {CATEGORIES.map(cat => {
            const catStyle = CAT_STYLES[cat] ?? { bg: "bg-neutral-50", ring: "ring-neutral-200", header: "text-neutral-900" };
            return (
              <div key={cat} className={`rounded-3xl shadow-sm ring-1 p-5 ${catStyle.bg} ${catStyle.ring}`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`font-semibold tracking-tight ${catStyle.header}`}>{cat}</h2>
                  <div className="text-xs text-neutral-600">Tier gates apply in Tiered mode.</div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {FEATURES.filter(f => f.category === cat).map(f => {
                    const checked = !!selected[f.id];
                    const style = TIER_STYLES[f.minTier];
                    const requiresHigher = f.minTier !== "basic" && pricingMode === "tiered";
                    return (
                      <label key={f.id} className={["flex items-start gap-3 p-4 rounded-2xl border transition cursor-pointer shadow-sm", style.tileBg, style.tileBorder, style.tileHover].join(" ")}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(f.id)} className="mt-1 accent-black" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${style.chipBg} ${style.chipText} ${style.chipBorder}`}>
                              {f.minTier === "basic" ? "Basic" : f.minTier === "standard" ? "Standard" : "Pro"}
                            </span>
                            {requiresHigher && (
                              <>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${style.chipBg} ${style.chipText} ${style.chipBorder}`}>
                                  requires {TIERS[f.minTier].label}
                                </span>
                                <Tip text="Selecting this bumps the plan in Tiered mode. Use À-la-carte for a custom bundle." />
                              </>
                            )}
                            {pricingMode === "alacarte" && f.addonPrice ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-50">+{fmtINR(f.addonPrice)}</span>
                            ) : null}
                          </div>
                          {f.help && <p className="text-xs text-neutral-600 mt-1">{f.help}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Export JSON */}
          <div className="rounded-3xl p-5 shadow-md ring-1 ring-black/5 bg-white/70 backdrop-blur">
            <h2 className="font-semibold mb-2 tracking-tight">Selected & Export</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedFeatures.length > 0 ? (
                selectedFeatures.map(f => <span key={f.id} className="text-xs px-2 py-1 rounded-full bg-neutral-100 border">{f.label}</span>)
              ) : (
                <span className="text-sm text-neutral-500">No features selected.</span>
              )}
            </div>

            <h3 className="font-medium mb-2">Config JSON</h3>
            <pre className="bg-neutral-900 text-neutral-50 p-3 rounded-xl overflow-auto text-xs max-h-64 whitespace-pre-wrap">
{typeof configJson === "string" ? configJson : JSON.stringify(configJson, null, 2)}
            </pre>

            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={async () => { await navigator.clipboard.writeText(configJson); alert("Config copied!"); }} className="px-3 py-2 rounded-xl bg-neutral-900 text-white hover:opacity-90 text-sm">Copy JSON</button>
              <button onClick={() => download(`${clinicName.replace(/\s+/g, "_")}_config.json`, configJson)} className="px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50">Save as JSON</button>
              <button
                onClick={async () => {
                  const text = await uploadFile();
                  try {
                    const obj = JSON.parse(text);
                    setClinicName(obj.org?.name ?? clinicName);
                    setClinicAddress(obj.org?.address ?? clinicAddress);
                    setClinicPhone(obj.org?.phone ?? clinicPhone);
                    setClinicEmail(obj.org?.email ?? clinicEmail);
                    setLogoUrl(obj.org?.logoUrl ?? null);
                    setPrimaryColor(obj.org?.primaryColor ?? primaryColor);
                    setQuoteNumber(obj.quote?.number ?? quoteNumber);
                    setQuoteDate(obj.quote?.date ?? quoteDate);
                    setDiscountPct(Number(obj.quote?.discountPct ?? 0));
                    setGstPct(Number(obj.quote?.gstPct ?? 18));
                    setTerms(obj.terms ?? terms);
                    const next: Record<string, boolean> = {};
                    FEATURES.forEach(f => (next[f.id] = !!obj.features?.includes(f.id)));
                    setSelected(next);
                    alert("Config loaded.");
                  } catch { alert("Invalid JSON file."); }
                }}
                className="px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50"
              >
                Load JSON
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Global brand color + print styles */}
      <style jsx global>{`
        :root { --brand: ${primaryColor}; }
        .brand { color: var(--brand); }
        @media print {
          body { background: white !important; }
          header, .no-print { display: none !important; }
          #printable { page-break-inside: avoid; }
          .shadow, .shadow-sm, .rounded-2xl, .rounded-3xl, .border {
            box-shadow: none !important; border: 1px solid #ddd !important;
          }
        }
      `}</style>
    </div>
  );
}
