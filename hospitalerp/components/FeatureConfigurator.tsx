"use client";

import React, { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

/* ---------- Hydration-safe formatter ---------- */
function PriceCell({ value }: { value: number }) {
  const [formatted, setFormatted] = useState<string>("");
  useEffect(() => setFormatted(value.toLocaleString("en-IN")), [value]);
  return <span suppressHydrationWarning>{formatted || value}</span>;
}

/* ---------- Types ---------- */
// Branding fields optional so partial updates type-check.
type Branding = {
  clinicName?: string;
  address?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
};
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

/* ---------- Defaults ---------- */
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
const stableQuote = (prefix = "Q") => {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-001`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- Component ---------- */
export default function FeatureConfigurator() {
  // 1) Safe initial state (no localStorage during render)
  const [cfg, setCfg] = useState<Config>(() =>
    deepMerge(DEFAULT_CONFIG, {
      quote: { number: stableQuote(), date: todayISO(), discountPct: 0 },
    })
  );

  // 2) Load/save config from localStorage only on client
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("erpConfig");
      if (raw) {
        const parsed = JSON.parse(raw);
        setCfg((prev) => deepMerge(prev, parsed));
      } else {
        window.localStorage.setItem("erpConfig", JSON.stringify(cfg));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("erpConfig", JSON.stringify(cfg));
    } catch {}
    if (cfg.branding?.primaryColor) {
      document.documentElement.style.setProperty("--prim", cfg.branding.primaryColor);
    }
  }, [cfg]);

  // 3) Pricing
  const basePrice = 59999;
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
            value={cfg.branding.clinicName ?? ""}
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
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>Primary Color</label>
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
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { quote: { ...c.quote, number: e.target.value } }))
              }
            />
            <input
              type="date"
              value={cfg.quote.date}
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { quote: { ...c.quote, date: e.target.value } }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Discount %</label>
            <input
              type="number"
              value={cfg.quote.discountPct}
              onChange={(e) =>
                setCfg((c) =>
                  deepMerge(c, { quote: { ...c.quote, discountPct: Number(e.target.value || 0) } })
                )
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">GST %</label>
            <input
              type="number"
              value={cfg.billing.gstPercent}
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { billing: { gstPercent: Number(e.target.value || 0) } }))
              }
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
        <div className="card space-y-3">
          <h3 className="font-semibold">Core</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Patients (UID + QR)</span>
            <input
              type="checkbox"
              checked={cfg.patients.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { patients: { enabled: e.target.checked } }))}
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <span>Inventory & Pharmacy</span>
            <input
              type="checkbox"
              checked={cfg.inventory.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { inventory: { enabled: e.target.checked } }))}
            />
          </label>

          {cfg.inventory.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Low stock threshold"
                value={cfg.inventory.lowStockThreshold}
                onChange={(e) =>
                  setCfg((c) =>
                    deepMerge(c, { inventory: { lowStockThreshold: Number(e.target.value || 0) } })
                  )
                }
              />
              <input
                type="number"
                placeholder="Near expiry days"
                value={cfg.inventory.nearExpiryDays}
                onChange={(e) =>
                  setCfg((c) =>
                    deepMerge(c, { inventory: { nearExpiryDays: Number(e.target.value || 0) } })
                  )
                }
              />
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold">Appointments</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Enable Appointments</span>
            <input
              type="checkbox"
              checked={cfg.appointments.enabled}
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { appointments: { enabled: e.target.checked } }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Single Doctor Scheduling</span>
            <input
              type="checkbox"
              checked={cfg.appointments.singleDoctor}
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { appointments: { singleDoctor: e.target.checked } }))
              }
            />
          </label>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold">Operations</h3>
          <label className="flex items-center justify-between gap-4">
            <span>Billing + GST</span>
            <input
              type="checkbox"
              checked={cfg.billing.enabled}
              onChange={(e) => setCfg((c) => deepMerge(c, { billing: { enabled: e.target.checked } }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Staff Attendance</span>
            <input
              type="checkbox"
              checked={cfg.staff.attendanceSimple}
              onChange={(e) =>
                setCfg((c) => deepMerge(c, { staff: { attendanceSimple: e.target.checked } }))
              }
            />
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
          <div><b>Total: ₹<PriceCell value={total} /></b></div>
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
