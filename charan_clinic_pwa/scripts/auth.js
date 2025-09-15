<script type="module">
import { db, ensureSeed, hashPin } from "./db.js";

export async function getTheme(){
  await db.open();
  const t = await db.settings.get("theme");
  return t?.value || "dark";
}
export async function setTheme(v){
  await db.settings.put({key:"theme", value:v});
  document.documentElement.dataset.theme = v;
}

export async function login(roleKey, pin){
  await ensureSeed();
  const rec = await db.pins.get(roleKey);
  if(!rec) throw new Error("role not found");
  const ok = rec.hashedPin === await hashPin(pin);
  if(!ok) throw new Error("Invalid PIN");
  sessionStorage.setItem("role", roleKey);
  route(roleKey);
}
export function logout(){
  sessionStorage.clear();
  location.href = "/index.html";
}
export function guard(roles){
  const r = sessionStorage.getItem("role");
  if(!roles.includes(r)) location.href="/index.html";
}
export function route(roleKey){
  const R = {
    doctor:"/dashboard.html",
    supervisor:"/supervisor.html",
    front:"/frontoffice.html",
    mrs:"/dashboard.html",   // own view later
    master:"/dashboard.html"
  };
  location.href = R[roleKey] || "/index.html";
}
</script>
