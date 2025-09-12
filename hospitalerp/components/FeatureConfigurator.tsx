"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Types ---------- */
type Branding = {
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
};
type InventoryCfg = {
  enabled: boolean;
  lowStockThreshold: number;
  nearExpiryDays: number;
};
type PatientsCfg = { enabled: boolean };
type BillingCfg = { enabled: boolean; gstPercent: number };
type StaffCfg = { attendanceSimple: boolean };
type AppointmentsCfg = { singleDoctor: boolean };
type Config = {
  branding: Branding;
  patients: PatientsCfg;
  inventory: InventoryCfg;
  billing: BillingCfg;
  staff: StaffCfg;
  appointments: AppointmentsCfg;
  quote?: { number: string; date: string; discountPct: number };
  pricingMode?: "tiered" | "custom";
};

/** ---------- Helpers ---------- */
const DEFAULT_CONFIG: Config = {
  branding: { clinicName: "Clinic", primaryColor: "#0ea5e9" },
  patients: { enabled: true },
  inventory: { enabled: true, lowStockThreshold: 10, nearExpiryDays: 60 },
  billing: { enabled: false, gstPercent: 18 },
  staff: { attendanceSimple: false },
  appointments: { singleDoctor: true },
  quote: { number: "Q-20250101-001", date: "2025-01-01", discountPct: 0 },
  pricingMode: "tiered",
};

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch as any)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge((out[k] ?? {}) as any, v);
    else out[k] = v;
  }
  return out as T;
}

function b64(json: any) {
  return encodeURIComponent(btoa(typeof json === "string" ? json : JSON.stringify(json)));
}

/** ---------- Stable values to avoid hydration mismatches ---------- */
function useStableNowISO() {
  const ref = useRef<string>();
  if (!ref.current) ref.current = new Date().toISOString();
  return ref.current;
}
function useStableQuoteNumber(prefix = "Q") {
  const ref = useRef<string>();
  if (!ref.current) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    ref.current = `${prefix}-${y}${m}${dd}-001`;
  }
  return ref.current;
}

/** ---------- Component ---------- */
export default function FeatureConfigurator() {
  // load initial from localStorage once
  const [cfg, setCfg] = useState<Config>(() => {
    try {
      const raw = localStorage.getItem("erpConfig");
      return raw ? deepMerge(DEFAULT_CONFIG, JSON.parse(raw)) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // stable defaults
  const nowISO = useStableNowISO();
  const quoteNumber = useStableQuoteNumber();
  useEffect(() => {
    setCfg((c) =>
      deepMerge(c, {
        quote: {
          number: c.quote?.number || quoteNumber,
          date: c.quote?.date || nowISO.slice(0, 10),
          discountPct: c.quote?.discountPct ?? 0,
        },
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived numbers (toy pricing just to show structure)
  const basePrice = useMemo(() => 59999, []);
  const addons = useMemo(() => {
    let n = 0;
    if (cfg.billing.enabled) n += 3000;
    if (cfg.staff.attendanceSimple) n += 2000;
    return n;
  }, [cfg.billing.enabled, cfg.staff.attendanceSimple]);
  const subtotal = basePrice + addons;
  const discount = Math.round((subtotal * (cfg.quote?.discountPct || 0)) / 100);
  const net = subtotal - discount;
  const gst = Math.round((net * (cfg.billing.gstPercent || 18)) / 100);
  const total = net + gst;

  // persist config
  useEffect(() => {
    localStorage.setItem("erpConfig", JSON.stringify(cfg));
  }, [cfg]);

  // stable JSON string for hydration-safe preview
  const previewJson = useMemo(
    () =>
      JSON.stringify(
        {
          branding: cfg.branding,
          patients: cfg.patients,
          inventory: cfg.inventory,
          billing: cfg.billing,
          staff: cfg.staff,
          appointments: cfg.appointments,
          quote: cfg.quote,
          pricingMode: cfg.pricingMode,
        },
        null,
        2
      ),
    [cfg]
  );

  // Actions
  const copyShareLink = async () => {
    const url = `${location.origin}/nav.html?cfg=${b64(cfg)}&page=patients.html`;
    await navigator.clipboard.writeText(url);
    alert("Share link copied ✅");
  };
  const downloadJson = () => {
    const blob = new Blob([previewJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Hospital ERP — Configurator</h1>

      {/* Branding */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 border rounded-xl">
          <h2 className="font-semibold">Branding & Contact</h2>
          <input
            className="w-full p-2 rounded bg-neutral-900 border border-neutral-800"
            placeholder="Clinic / Hospital Name"
            value={cfg.branding.clinicName}
            onChange={(e) => setCfg((c) => deepMerge(c, { branding: { clinicName: e.target.value } }))}
          />
          <input
            className="w-full p-2 rounded bg-neutral-900 border border-neutral-800"
            placeholder="Address"
            value={cfg.branding.address ?? ""}
            onChange={(e) => setCfg((c) => deepMerge(c, { branding: { address: e.target.value } }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              placeholder="Phone"
              value={cfg.branding.phone ?? ""}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { phone: e.target.value } }))}
            />
            <input
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              placeholder="Email"
              value={cfg.branding.email ?? ""}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { email: e.target.value } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-neutral-400">Primary Color</label>
            <input
              type="color"
              className="h-10 w-20 rounded bg-neutral-900 border border-neutral-800"
              value={cfg.branding.primaryColor ?? "#0ea5e9"}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { primaryColor: e.target.value } }))}
            />
          </div>
        </div>

        {/* Quote Details */}
        <div className="space-y-3 p-4 border rounded-xl">
          <h2 className="font-semibold">Quote Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              placeholder="Quote Number"
              value={cfg.quote?.number || ""}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { number: e.target.value } }))}
            />
            <input
              type="date"
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              value={cfg.quote?.date || nowISO.slice(0, 10)}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { date: e.target.value } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-neutral-400">Discount %</label>
            <input
              type="number"
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              value={cfg.quote?.discountPct ?? 0}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { discountPct: Number(e.target.value || 0) } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-neutral-400">GST %</label>
            <input
              type="number"
              className="p-2 rounded bg-neutral-900 border border-neutral-800"
              value={cfg.billing.gstPercent}
              onChange={(e) => setCfg((c) => deepMerge(c, { billing: { gstPercent: Number(e.target.value || 0) } }))}
            />
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-xl space-y-2">
          <h3 className="font-semibold">Core</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.patients.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { patients: { enabled: e.target.checked } }))}
            />
            Patients (UID + QR)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.inventory.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { inventory: { enabled: e.target.checked } }))}
            />
            Inventory & Pharmacy (basic)
          </label>
          {cfg.inventory.enabled && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <input
                type="number"
                className="p-2 rounded bg-neutral-900 border border-neutral-800"
                placeholder="Low stock threshold"
                value={cfg.inventory.lowStockThreshold}
                onChange={(e) =>
                  setCfg((c) => deepMerge(c, { inventory: { lowStockThreshold: Number(e.target.value || 0) } }))
                }
              />
              <input
                type="number"
                className="p-2 rounded bg-neutral-900 border border-neutral-800"
                placeholder="Near expiry days"
                value={cfg.inventory.nearExpiryDays}
                onChange={(e) =>
                  setCfg((c) => deepMerge(c, { inventory: { nearExpiryDays: Number(e.target.value || 0) } }))
                }
              />
            </div>
          )}
        </div>

        <div className="p-4 border rounded-xl space-y-2">
          <h3 className="font-semibold">Operations</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.billing.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { billing: { enabled: e.target.checked } }))}
            />
            Billing + GST invoices
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.staff.attendanceSimple}
              onChange={(e) => setCfg((c) => deepMerge(c, { staff: { attendanceSimple: e.target.checked } }))}
            />
            Staff Attendance (simple)
          </label>
        </div>

        <div className="p-4 border rounded-xl space-y-2">
          <h3 className="font-semibold">Pricing Mode</h3>
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pricing"
                checked={cfg.pricingMode === "tiered"}
                onChange={() => setCfg((c) => ({ ...c, pricingMode: "tiered" }))}
              />
              Tiered (auto)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pricing"
                checked={cfg.pricingMode === "custom"}
                onChange={() => setCfg((c) => ({ ...c, pricingMode: "custom" }))}
              />
              A-la-carte
            </label>
          </div>
        </div>
      </section>

      {/* Price Summary */}
      <section className="p-4 border rounded-xl">
        <h3 className="font-semibold mb-2">Price Summary</h3>
        <div className="grid md:grid-cols-5 gap-3">
          <div>Base: ₹{basePrice.toLocaleString("en-IN")}</div>
          <div>Add-ons: ₹{addons.toLocaleString("en-IN")}</div>
          <div>Discount: ₹{discount.toLocaleString("en-IN")}</div>
          <div>GST: ₹{gst.toLocaleString("en-IN")}</div>
          <div><b>Total: ₹{total.toLocaleString("en-IN")}</b></div>
        </div>
      </section>

      {/* Actions & JSON */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 border rounded-xl">
          <h3 className="font-semibold">Actions</h3>
          <div className="flex gap-3">
            <button className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" onClick={copyShareLink}>
              Copy Shell Link
            </button>
            <button className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" onClick={downloadJson}>
              Download JSON
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            The shell reads config from the <code>?cfg=</code> query or <code>localStorage.erpConfig</code>.
          </p>
        </div>

        <div className="space-y-2 p-4 border rounded-xl">
          <h3 className="font-medium mb-2">Config JSON</h3>
          <pre
            className="bg-neutral-900 text-neutral-50 p-3 rounded-xl overflow-auto text-xs max-h-64 whitespace-pre"
            suppressHydrationWarning
          >
{previewJson}
          </pre>
        </div>
      </section>
    </div>
  );
}
