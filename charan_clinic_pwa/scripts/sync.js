// scripts/sync.js
import { db, getChangesSince, initChangeHooks } from "./db.js";

/**
 * Local-first peer sync over WebRTC DataChannel with AES-GCM.
 * - Manual pairing: copy/paste Offer/Answer (no server).
 * - E2E encryption: shared "Pair Code" -> key via PBKDF2.
 * - Sends changes since timestamp; applies incoming changes.
 */

let pc, dc, encKey, paired = false;
let lastAppliedTs = 0;         // local high-water mark
let lastSentTs = 0;            // last ts we exported

// ---------- Crypto helpers (AES-GCM with PBKDF2 from pair code) ----------
async function deriveKey(pairCode){
  const salt = new TextEncoder().encode("charan_clinic_sync_v1");
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pairCode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations: 120000, hash:"SHA-256" },
    baseKey,
    { name:"AES-GCM", length: 256 },
    false, ["encrypt","decrypt"]
  );
}
async function encrypt(obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.encrypt({name:"AES-GCM", iv}, encKey, data);
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(buf)) };
}
async function decrypt(payload){
  const iv = new Uint8Array(payload.iv);
  const data = new Uint8Array(payload.data);
  const buf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, encKey, data);
  return JSON.parse(new TextDecoder().decode(buf));
}

// ---------- WebRTC (no TURN, pure local/Internet STUN defaults) ----------
function newPC(){
  const cfg = { iceServers: [{ urls: ["stun:stun.l.google.com:19302","stun:global.stun.twilio.com:3478"] }] };
  pc = new RTCPeerConnection(cfg);
  pc.onicecandidate = e=>{
    if(e.candidate) return; // wait for gathering to complete
    // When gathering finished, show localDescription JSON in the UI panel
    const area = document.getElementById("syncLocalSDP");
    if(area) area.value = JSON.stringify(pc.localDescription);
  };
  pc.ondatachannel = e => bindDataChannel(e.channel);
}

function bindDataChannel(channel){
  dc = channel;
  dc.onopen = ()=> { log("Connected"); paired = true; hello(); initialSync(); livePublish(); };
  dc.onclose = ()=> { log("Disconnected"); paired = false; };
  dc.onmessage = async (ev)=>{
    try{
      const msg = await decrypt(JSON.parse(ev.data));
      await handleMessage(msg);
    }catch(err){ console.error("decrypt/message error", err); }
  };
}

function send(obj){
  if(!dc || dc.readyState!=="open") return;
  encrypt(obj).then(payload => dc.send(JSON.stringify(payload)));
}

function hello(){
  send({ type: "hello", ts: Date.now(), since: lastAppliedTs });
}

// ---------- Change stream ----------
async function initialSync(){
  // Ask peer for their since; we send ours soon after hello/req state exchange.
  send({ type: "req_state", since: lastAppliedTs });
}

async function livePublish(){
  // push any new changes periodically
  setInterval(async ()=>{
    if(!paired) return;
    const changes = await getChangesSince(lastSentTs);
    if(changes.length){
      lastSentTs = Math.max(lastSentTs, ...changes.map(c=>c.ts));
      send({ type:"changes", data: changes });
    }
  }, 1200);
}

// Apply incoming change rows safely
async function applyChanges(rows){
  // rows: [{ts, store, op, key, value}, ...] sorted by ts
  for(const r of rows){
    try{
      // Keep a monotonic watermark to avoid reapplying on reload
      if(r.ts <= lastAppliedTs) continue;

      const tbl = db[r.store];
      if(!tbl) continue;

      if(r.op === "put"){
        // if record has id OR key, best effort upsert
        const v = r.value || {};
        if(v && typeof v === "object" && ("id" in v)) {
          await tbl.put(v);
        } else if (r.key != null) {
          // If we know the primary key, try put with key
          await tbl.put({ ...v, id: r.key });
        } else {
          await tbl.put(v);
        }
      }else if(r.op === "del"){
        const key = (r.key != null) ? r.key : r.value?.id;
        if(key != null) await tbl.delete(key);
      }
      lastAppliedTs = Math.max(lastAppliedTs, r.ts);
    }catch(err){ console.warn("apply error", r, err); }
  }
}

// Handle protocol messages
async function handleMessage(msg){
  switch(msg.type){
    case "hello":
      // record their since; respond with ours
      send({ type:"ack", since: lastAppliedTs });
      break;

    case "req_state": {
      const since = msg.since || 0;
      const changes = await getChangesSince(since);
      if(changes.length){
        lastSentTs = Math.max(lastSentTs, ...changes.map(c=>c.ts));
        send({ type:"changes", data: changes });
      }else{
        send({ type:"noop" });
      }
      break;
    }

    case "changes":
      await applyChanges(msg.data || []);
      // acknowledge with our changes since lastSentTs (pull-push loop)
      const more = await getChangesSince(lastSentTs);
      if(more.length){
        lastSentTs = Math.max(lastSentTs, ...more.map(c=>c.ts));
        send({ type:"changes", data: more });
      }
      break;

    case "noop":
    case "ack":
    default:
      break;
  }
}

// ---------- UI Overlay ----------
export async function openSyncPanel(){
  await db.open(); initChangeHooks();

  const div = document.createElement("div");
  div.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
  div.innerHTML = `
    <div style="background:var(--card);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:12px;max-width:860px;width:100%;color:var(--text)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
        <strong>Peer Sync (Local-first, Encrypted)</strong>
        <div style="display:flex;gap:8px">
          <button id="syncClose" class="btn">Close</button>
        </div>
      </div>

      <div class="row">
        <input id="pairCode" class="input" placeholder="Pair Code (shared secret, e.g., 6-10 digits/words)" />
      </div>

      <div class="row" style="margin-top:8px">
        <button id="btnCreate" class="btn">Create Offer</button>
        <button id="btnJoin" class="btn">Join with Remote Offer → Create Answer</button>
        <button id="btnConnect" class="btn">Connect with Remote Answer</button>
      </div>

      <div class="row" style="margin-top:8px">
        <textarea id="syncLocalSDP" class="input" rows="6" placeholder="Your Offer/Answer JSON will appear here..."></textarea>
      </div>
      <div class="row">
        <textarea id="syncRemoteSDP" class="input" rows="6" placeholder="Paste REMOTE Offer/Answer JSON here..."></textarea>
      </div>

      <div id="syncLog" class="helper" style="margin-top:8px;max-height:160px;overflow:auto"></div>
    </div>
  `;
  document.body.appendChild(div);

  function close(){ document.body.removeChild(div); }
  document.getElementById("syncClose").onclick = close;

  const pairInput = document.getElementById("pairCode");
  const localSDP = document.getElementById("syncLocalSDP");
  const remoteSDP = document.getElementById("syncRemoteSDP");

  document.getElementById("btnCreate").onclick = async ()=>{
    if(!pairInput.value.trim()) return alert("Enter a Pair Code first");
    encKey = await deriveKey(pairInput.value.trim());
    newPC();
    const ch = pc.createDataChannel("sync");
    bindDataChannel(ch);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log("Offer created. Copy Local JSON to the other device's JOIN box.");
  };

  document.getElementById("btnJoin").onclick = async ()=>{
    if(!pairInput.value.trim()) return alert("Enter a Pair Code first");
    encKey = await deriveKey(pairInput.value.trim());
    const remote = remoteSDP.value.trim();
    if(!remote) return alert("Paste remote Offer JSON first");
    newPC();
    await pc.setRemoteDescription(JSON.parse(remote));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    log("Answer created. Send Local JSON back to the Offer device and click Connect there.");
  };

  document.getElementById("btnConnect").onclick = async ()=>{
    const remote = remoteSDP.value.trim();
    if(!remote) return alert("Paste remote Answer JSON");
    await pc.setRemoteDescription(JSON.parse(remote));
    log("Connected (once DataChannel is open).");
  };
}

function log(msg){
  const el = document.getElementById("syncLog");
  if(!el) return;
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
