"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

/* ---------- Hydration-safe formatter ---------- */
function PriceCell({ value }: { value: number }) {
  const [formatted, setFormatted] = useState<string>("");
  useEffect(() => setFormatted(value.toLocaleString("en-IN")), [value]);
  return <span suppressHydrationWarning>{formatted || value}</span>;
}

/* ---------- Types ---------- */
type Branding = { clinicName: string; address?: string; phone?: string; email?: string; primaryColor?: string };
type PatientsCfg = { enabled: boolean };
type InventoryCfg = { enabled: boolean; lowStockThreshold: number; nearExpiryDays: number };
type BillingCfg = { enabled: boolean; gstPercent: number };
type StaffCfg = { attendanceSimple: boolean };
type AppointmentsCfg = { enabled: boolean; singleDoctor: boolean };
type Config = {
  branding: Branding;
  patients: PatientsCfg;
  inventory: InventoryCfg;
  billing: BillingCfg;
  staff: StaffCfg;
  appointments: AppointmentsCfg;
  quote: { number: string; date: string; discountPct: number };
  pricingMode: "tiered" | "custom";
};

/* ---------- Defaults (sync with shell) ---------- */
const DEFAULT_CONFIG: Config = {
  branding: { clinicName: "Clinic", primaryColor: "#0ea5e9" },
  patients: { enabled: true },
  inventory: { enabled: true, lowStockThreshold: 10, nearExpiryDays: 60 },
  billing: { enabled: false, gstPercent: 18 },
  staff: { attendanceSimple: false },
  appointments: { enabled: true, singleDoctor: true },
  quote: { number: "Q-20250101-001", date: "2025-01-01", discountPct: 0 },
  pricingMode: "tiered",
};

/* ---------- Utils ---------- */
function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch as any)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge((out[k] ?? {}) as any, v);
    else out[k] = v;
  }
  return out as T;
}
const b64 = (json: any) => encodeURIComponent(btoa(typeof json === "string" ? json : JSON.stringify(json)));
function useStableNowISO() {
  const ref = useRef<string>();
  if (!ref.current) ref.current = new Date().toISOString();
  return ref.current;
}
function useStableQuoteNumber(prefix = "Q") {
  const ref = useRef<string>();
  if (!ref.current) {
    const d = new Date();
    ref.current = `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate()
    ).padStart(2, "0")}-001`;
  }
  return ref.current;
}

/* ---------- Component ---------- */
export default function FeatureConfigurator() {
  const nowISO = useStableNowISO();
  const defaultQuote = useStableQuoteNumber();

  // load once from localStorage and seed sensible defaults
  const [cfg, setCfg] = useState<Config>(() => {
    try {
      const raw = localStorage.getItem("erpConfig");
      const parsed = raw ? JSON.parse(raw) : {};
      const merged = deepMerge(DEFAULT_CONFIG, parsed);
      if (!merged.quote?.number) merged.quote.number = defaultQuote;
      if (!merged.quote?.date) merged.quote.date = nowISO.slice(0, 10);
      localStorage.setItem("erpConfig", JSON.stringify(merged));
      return merged;
    } catch {
      const seeded = deepMerge(DEFAULT_CONFIG, { quote: { number: defaultQuote, date: nowISO.slice(0, 10) } });
      localStorage.setItem("erpConfig", JSON.stringify(seeded));
      return seeded;
    }
  });

  // persist & live-tint brand color
  useEffect(() => {
    localStorage.setItem("erpConfig", JSON.stringify(cfg));
    if (cfg.branding?.primaryColor) {
      document.documentElement.style.setProperty("--prim", cfg.branding.primaryColor);
    }
  }, [cfg]);

  // pricing calc (simple)
  const basePrice = 59999;
  const addons = useMemo(() => {
    let n = 0;
    if (cfg.billing.enabled) n += 3000;
    if (cfg.staff.attendanceSimple) n += 2000;
    // appointments currently included in base; price later if needed
    return n;
  }, [cfg.billing.enabled, cfg.staff.attendanceSimple]);

  const subtotal = basePrice + addons;
  const discount = Math.round((subtotal * (cfg.quote?.discountPct || 0)) / 100);
  const net = subtotal - discount;
  const gst = Math.round((net * (cfg.billing.gstPercent || 18)) / 100);
  const total = net + gst;

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

  const copyShellLink = async () => {
    const url = `${location.origin}/nav.html?cfg=${b64(cfg)}&page=home.html`;
    await navigator.clipboard.writeText(url);
    alert("Shell link copied ✅");
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
    <div className="page safe-bottom">
      <div className="topbar">
        <div style={{ fontWeight: 800 }}>🏥 Hospital ERP — Configurator</div>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
        <button className="btn-pill" onClick={copyShellLink} style={{ marginLeft: 8 }}>
          Share Shell Link
        </button>
        <button className="btn-pill" onClick={downloadJson}>Download JSON</button>
      </div>

      {/* Branding & Quote */}
      <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
        <div className="card space-y-3">
          <h2 className="font-semibold">Branding & Contact</h2>
          <input
            className="w-full"
            placeholder="Clinic / Hospital Name"
            value={cfg.branding.clinicName}
            onChange={(e) => setCfg((c) => deepMerge(c, { branding: { clinicName: e.target.value } }))}
          />
          <input
            className="w-full"
            placeholder="Address"
            value={cfg.branding.address ?? ""}
            onChange={(e) => setCfg((c) => deepMerge(c, { branding: { address: e.target.value } }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Phone"
              value={cfg.branding.phone ?? ""}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { phone: e.target.value } }))}
            />
            <input
              placeholder="Email"
              value={cfg.branding.email ?? ""}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { email: e.target.value } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Primary Color
            </label>
            <input
              type="color"
              className="h-10 w-20"
              value={cfg.branding.primaryColor ?? "#0ea5e9"}
              onChange={(e) => setCfg((c) => deepMerge(c, { branding: { primaryColor: e.target.value } }))}
            />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">Quote Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Quote Number"
              value={cfg.quote.number}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { number: e.target.value } }))}
            />
            <input
              type="date"
              value={cfg.quote.date}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { date: e.target.value } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Discount %
            </label>
            <input
              type="number"
              value={cfg.quote.discountPct}
              onChange={(e) => setCfg((c) => deepMerge(c, { quote: { discountPct: Number(e.target.value || 0) } }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              GST %
            </label>
            <input
              type="number"
              value={cfg.billing.gstPercent}
              onChange={(e) => setCfg((c) => deepMerge(c, { billing: { gstPercent: Number(e.target.value || 0) } }))}
            />
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="grid md:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
        <div className="card space-y-3">
          <h3 className="font-semibold">Core</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Patients (UID + QR)</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.patients.enabled}
                onChange={(e) => setCfg((c) => deepMerge(c, { patients: { enabled: e.target.checked } }))}
              />
              <span className="knob" />
            </span>
          </label>

          <label className="flex items-center justify-between gap-4">
            <span>Inventory & Pharmacy (basic)</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.inventory.enabled}
                onChange={(e) => setCfg((c) => deepMerge(c, { inventory: { enabled: e.target.checked } }))}
              />
              <span className="knob" />
            </span>
          </label>

          {cfg.inventory.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Low stock threshold"
                value={cfg.inventory.lowStockThreshold}
                onChange={(e) =>
                  setCfg((c) => deepMerge(c, { inventory: { lowStockThreshold: Number(e.target.value || 0) } }))
                }
              />
              <input
                type="number"
                placeholder="Near expiry days"
                value={cfg.inventory.nearExpiryDays}
                onChange={(e) => setCfg((c) => deepMerge(c, { inventory: { nearExpiryDays: Number(e.target.value || 0) } }))}
              />
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold">Appointments</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Enable Appointments module</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.appointments.enabled}
                onChange={(e) =>
                  setCfg((c) => deepMerge(c, { appointments: { enabled: e.target.checked, singleDoctor: true } }))
                }
              />
              <span className="knob" />
            </span>
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Single Doctor Scheduling</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.appointments.singleDoctor}
                onChange={(e) => setCfg((c) => deepMerge(c, { appointments: { singleDoctor: e.target.checked } }))}
              />
              <span className="knob" />
            </span>
          </label>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold">Operations</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Billing + GST invoices</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.billing.enabled}
                onChange={(e) => setCfg((c) => deepMerge(c, { billing: { enabled: e.target.checked } }))}
              />
              <span className="knob" />
            </span>
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Staff Attendance (simple)</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={cfg.staff.attendanceSimple}
                onChange={(e) => setCfg((c) => deepMerge(c, { staff: { attendanceSimple: e.target.checked } }))}
              />
              <span className="knob" />
            </span>
          </label>
        </div>
      </div>

      {/* Pricing */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="font-semibold mb-2">Price Summary</h3>
        <div className="grid md:grid-cols-5 gap-3">
          <div>Base: ₹<PriceCell value={basePrice} /></div>
          <div>Add-ons: ₹<PriceCell value={addons} /></div>
          <div>Discount: ₹<PriceCell value={discount} /></div>
          <div>GST: ₹<PriceCell value={gst} /></div>
          <div>
            <b>Total: ₹<PriceCell value={total} /></b>
          </div>
        </div>
      </div>

      {/* JSON */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="font-semibold mb-2">Config JSON</h3>
        <pre className="text-xs overflow-auto" suppressHydrationWarning>
{previewJson}
        </pre>
      </div>
    </div>
  );
}
