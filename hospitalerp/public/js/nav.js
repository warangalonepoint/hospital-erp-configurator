// --- nav.js (pure JS) ---
function decodeCfg(b64){ try{ return JSON.parse(atob(decodeURIComponent(b64))); }catch{ return null; } }
function deepMerge(a,b){ for(const k in b){ if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])){ a[k]=deepMerge(a[k]||{},b[k]) } else if(a[k]===undefined){ a[k]=b[k] } } return a; }

(function init(){
  // 1) Load config from ?cfg=... or localStorage
  const url = new URL(location.href);
  const cfgB64 = url.searchParams.get("cfg");
  let cfg = cfgB64 ? decodeCfg(cfgB64) : null;
  if(!cfg){
    try{ cfg = JSON.parse(localStorage.getItem("erpConfig")||"{}"); }catch{ cfg = {}; }
  }
  const defaults = {
    branding:{ clinicName:"Clinic", address:"", primaryColor:"#0ea5e9" },
    patients:{ enabled:true },
    inventory:{ enabled:true, lowStockThreshold:10, nearExpiryDays:60 },
    appointments:{ singleDoctor:true },
    billing:{ enabled:false },
    staff:{ attendanceSimple:false }
  };
  cfg = deepMerge(cfg||{}, defaults);
  localStorage.setItem("erpConfig", JSON.stringify(cfg));

  // 2) Build sidebar (config-aware)
  const menu = [
    { key:"patients",  label:"Patients",            href:"patients.html",         show: ()=>cfg.patients.enabled },
    { key:"pharmacy",  label:"Pharmacy",            href:"pharmacy.html",         show: ()=>cfg.inventory.enabled },
    { key:"grn",       label:"GRN (Add Stock)",     href:"inventory-grn.html",    show: ()=>cfg.inventory.enabled },
    { key:"billing",   label:"Billing",             href:"billing.html",          show: ()=>cfg.billing.enabled },
    // Next.js route, open as-is (no cfg params)
    { key:"config",    label:"Configurator",        href:"/configurator",         external:true }
  ];

  const qpCfg = "cfg="+encodeURIComponent(btoa(JSON.stringify(cfg)));
  const side = document.getElementById("side");
  const ul = document.createElement("ul");
  ul.className = "nav";

  function linkFor(item){
    if(item.external) return item.href;
    const u = new URL(item.href, location.origin);
    u.search = qpCfg;
    return u.toString();
  }

  menu.forEach(it=>{
    if(it.show && !it.show()) return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#"; a.textContent = it.label;
    a.dataset.href = linkFor(it);
    a.onclick = (e)=>{ e.preventDefault(); setActive(a); loadPage(it); };
    li.appendChild(a); ul.appendChild(li);
  });
  side.innerHTML = ""; side.appendChild(ul);

  // 3) Top bar branding
  const clinicName = document.getElementById("clinicName");
  const clinicMeta  = document.getElementById("clinicMeta");
  if (clinicName) clinicName.textContent = cfg.branding.clinicName || "Clinic";
  if (clinicMeta)  clinicMeta.textContent  = cfg.branding.address || "ERP Shell";

  function setActive(a){
    document.querySelectorAll(".nav a").forEach(x=>x.classList.remove("active"));
    a.classList.add("active");
  }
  function loadPage(item){
    const frame = document.getElementById("frame");
    const isExternal = item.external === true;
    frame.src = isExternal ? item.href : `${item.href}?${qpCfg}`;
  }

  // 4) Default page from ?page=..., else first visible
  const want = url.searchParams.get("page") || "patients.html";
  const first = Array.from(document.querySelectorAll(".nav a"))
    .find(a => (a.dataset.href||"").includes(want)) || document.querySelector(".nav a");
  if (first){
    setActive(first);
    const item = menu.find(m => first.textContent === m.label);
    loadPage(item);
  }

  // 5) Share/Clear actions
  const shareBtn = document.getElementById("copyLinkBtn");
  if (shareBtn){
    shareBtn.onclick = ()=>{
      const share = `${location.origin}${location.pathname}?page=${encodeURIComponent(want)}&${qpCfg}`;
      navigator.clipboard.writeText(share).then(()=>alert("Link copied"));
    };
  }
  const clearBtn = document.getElementById("clearCfgBtn");
  if (clearBtn){
    clearBtn.onclick = ()=>{ localStorage.removeItem("erpConfig"); alert("Cleared config cache"); location.reload(); };
  }
})();
