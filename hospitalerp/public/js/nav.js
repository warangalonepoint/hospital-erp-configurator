<script>
// ---- tiny config loader (same behavior as inventory.js)
function loadCfg() {
  function decodeCfg(b64){ try{ return JSON.parse(atob(decodeURIComponent(b64))); }catch{ return null; } }
  const url = new URL(location.href);
  const cfgB64 = url.searchParams.get("cfg");
  let cfg = cfgB64 ? decodeCfg(cfgB64) : null;
  if(!cfg){
    try{ cfg = JSON.parse(localStorage.getItem("erpConfig")||"{}"); }catch{ cfg = {}; }
  }
  const defaults = {
    branding:{ clinicName:"Clinic", address:"", phone:"", email:"", primaryColor:"#0ea5e9" },
    inventory:{ enabled:true, lowStockThreshold:10, nearExpiryDays:60 },
    patients:{ enabled:true },
    appointments:{ singleDoctor:true },
    billing:{ enabled:false },
    staff:{ attendanceSimple:false }
  };
  return deepMerge(cfg||{}, defaults);
}
function deepMerge(a,b){ for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=deepMerge(a[k]||{},b[k]) } else if(a[k]===undefined){ a[k]=b[k] } } return a; }

const cfg = loadCfg();
const qpCfg = "cfg="+encodeURIComponent(btoa(JSON.stringify(cfg)));
localStorage.setItem("erpConfig", JSON.stringify(cfg));

// ---- sidebar builder (shows only enabled modules)
const menu = [
  { key:"dashboard", label:"Dashboard", href:"dashboard.html" },            // future
  { key:"patients",  label:"Patients",  href:"patients.html", show: ()=>cfg.patients.enabled },
  { key:"appointments", label:"Appointments", href:"bookings.html", show: ()=>true },
  { key:"pharmacy",  label:"Pharmacy",  href:"pharmacy.html", show: ()=>cfg.inventory.enabled },
  { key:"grn",       label:"GRN (Add Stock)", href:"inventory-grn.html", show: ()=>cfg.inventory.enabled },
  { key:"billing",   label:"Billing", href:"billing.html", show: ()=>cfg.billing.enabled },
  { key:"staff",     label:"Staff Attendance", href:"staff-attendance.html", show: ()=>cfg.staff.attendanceSimple },
  { key:"config",    label:"Configurator", href:"/hospitalerp/configurator", external:true } // your Next route
];

const side = document.getElementById("side");
const clinicName = document.getElementById("clinicName");
const clinicMeta = document.getElementById("clinicMeta");
clinicName.textContent = cfg.branding?.clinicName || "Clinic";
clinicMeta.textContent = cfg.branding?.address || "";

function linkFor(item){
  if(item.external) return item.href; // Next route keeps its own params
  const url = new URL(item.href, location.origin);
  url.search = qpCfg; 
  return url.toString();
}

function buildSide(){
  const ul = document.createElement("ul");
  ul.className = "nav";
  menu.forEach(it=>{
    if(it.show && !it.show()) return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = it.label;
    a.onclick = (e)=>{ e.preventDefault(); loadPage(it.href); setActive(a); };
    a.dataset.href = linkFor(it);
    li.appendChild(a); ul.appendChild(li);
  });
  side.innerHTML = "";
  side.appendChild(ul);
}

function setActive(a){
  document.querySelectorAll(".nav a").forEach(x=>x.classList.remove("active"));
  a.classList.add("active");
}

function loadPage(href){
  const frame = document.getElementById("frame");
  const isExternal = href.startsWith("/"); // configurator path
  frame.src = isExternal ? href : `${href}${href.includes("?")?"&":"?"}${qpCfg}`;
}

// default page from ?page=...
(function init(){
  buildSide();
  const url = new URL(location.href);
  const page = url.searchParams.get("page") || "pharmacy.html";
  // set active based on built links
  const anchor = Array.from(document.querySelectorAll(".nav a"))
    .find(a => (a.dataset.href||"").includes(page)) || document.querySelector(".nav a");
  if(anchor){ setActive(anchor); }
  loadPage(page);

  document.getElementById("copyLinkBtn").onclick = ()=>{
    const share = `${location.origin}${location.pathname}?page=${encodeURIComponent(page)}&${qpCfg}`;
    navigator.clipboard.writeText(share).then(()=>alert("Link copied"));
  };
  document.getElementById("clearCfgBtn").onclick = ()=>{
    localStorage.removeItem("erpConfig");
    alert("Cleared config cache. Reloading…");
    location.reload();
  };
})();
</script>
