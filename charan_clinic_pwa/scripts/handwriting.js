// ./scripts/handwriting.js
export async function openPad(){
  return new Promise(resolve=>{
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
    overlay.innerHTML = `
      <div style="background:var(--card);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:12px;max-width:720px;width:100%">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>Handwriting Pad</strong>
          <div style="display:flex;gap:8px">
            <button id="padPen" class="btn">Pen</button>
            <button id="padErase" class="btn">Eraser</button>
            <button id="padUndo" class="btn">Undo</button>
            <button id="padClear" class="btn">Clear</button>
            <button id="padClose" class="btn">Close</button>
          </div>
        </div>
        <canvas id="padCanvas" width="640" height="360" style="background:#fff;border-radius:12px;box-shadow:var(--shadow);margin-top:8px;touch-action:none"></canvas>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <input id="padText" class="input" placeholder="Optional: brief text extracted / summary" />
          <button id="padSave" class="btn">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const c = overlay.querySelector("#padCanvas");
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#111"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    let drawing = false, erasing = false, last=null;
    const strokes = []; // [{pts:[{x,y}], erase:false}]

    function pos(e){
      const r = c.getBoundingClientRect();
      const x = (e.touches? e.touches[0].clientX: e.clientX) - r.left;
      const y = (e.touches? e.touches[0].clientY: e.clientY) - r.top;
      return {x,y};
    }
    function drawLine(a,b){
      ctx.globalCompositeOperation = erasing? "destination-out":"source-over";
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    function pointerDown(e){ drawing = true; last = pos(e); strokes.push({pts:[last], erase: erasing}); e.preventDefault(); }
    function pointerMove(e){
      if(!drawing) return;
      const p = pos(e);
      drawLine(last,p);
      strokes[strokes.length-1].pts.push(p);
      last = p; e.preventDefault();
    }
    function pointerUp(){ drawing=false; last=null; }

    c.addEventListener("pointerdown", pointerDown);
    c.addEventListener("pointermove", pointerMove);
    c.addEventListener("pointerup", pointerUp);
    c.addEventListener("pointerleave", pointerUp);
    c.addEventListener("touchstart", e=>{pointerDown(e);}, {passive:false});
    c.addEventListener("touchmove", e=>{pointerMove(e);}, {passive:false});
    c.addEventListener("touchend", e=>{pointerUp();}, {passive:false});

    overlay.querySelector("#padPen").onclick = ()=>{ erasing=false; };
    overlay.querySelector("#padErase").onclick = ()=>{ erasing=true; };
    overlay.querySelector("#padClear").onclick = ()=>{ ctx.clearRect(0,0,c.width,c.height); strokes.length=0; };
    overlay.querySelector("#padUndo").onclick = ()=>{
      if(!strokes.length) return;
      // redraw from scratch
      strokes.pop();
      ctx.clearRect(0,0,c.width,c.height);
      const lw = ctx.lineWidth, lc=ctx.lineCap, lj=ctx.lineJoin, ss=ctx.strokeStyle;
      strokes.forEach(s=>{
        ctx.globalCompositeOperation = s.erase? "destination-out":"source-over";
        ctx.lineWidth = lw; ctx.lineCap = lc; ctx.lineJoin = lj; ctx.strokeStyle = ss;
        for(let i=1;i<s.pts.length;i++) drawLine(s.pts[i-1], s.pts[i]);
      });
    };

    overlay.querySelector("#padClose").onclick = ()=>{ document.body.removeChild(overlay); resolve(null); };
    overlay.querySelector("#padSave").onclick = ()=>{
      const img = c.toDataURL("image/png");
      const note = overlay.querySelector("#padText").value.trim();
      document.body.removeChild(overlay);
      resolve({ imageB64: img, note });
    };
  });
}
