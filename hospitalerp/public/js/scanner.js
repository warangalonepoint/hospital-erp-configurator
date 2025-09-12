// Camera barcode scanner (BarcodeDetector API)
class CameraScanner {
  constructor({ onDetect } = {}) { this.onDetect = onDetect || (() => {}); this.running = false; }
  async open() {
    if (!('BarcodeDetector' in window)) { alert('Camera scan not supported. Use Chrome or a USB scanner.'); return; }
    const formats = ['code_128','ean_13','ean_8','upc_e','upc_a','qr_code','code_39'];
    this.detector = new BarcodeDetector({ formats });

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline','');
    this.video.style.width='100%'; this.video.style.borderRadius='12px';

    try { this.stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false }); }
    catch { alert('Camera permission denied.'); return; }

    this.video.srcObject = this.stream; await this.video.play();

    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,0.85)', display:'grid', placeItems:'center', zIndex:9999, padding:'16px' });
    const box = document.createElement('div');
    Object.assign(box.style, { width:'min(520px,96vw)', background:'#0d0d13', border:'1px solid #222', borderRadius:'14px', padding:'12px' });
    const bar = document.createElement('div');
    bar.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong>Scan Barcode</strong>
      <button id="scanCloseBtn" style="background:#1a1a24;border:1px solid #333;color:#fff;border-radius:10px;padding:6px 10px">Close</button>
    </div>`;
    box.appendChild(bar); box.appendChild(this.video); this.overlay.appendChild(box); document.body.appendChild(this.overlay);
    document.getElementById('scanCloseBtn').onclick = () => this.close();

    this.running = true;
    const tick = async () => {
      if (!this.running) return;
      try {
        const codes = await this.detector.detect(this.video);
        if (codes && codes.length) { const code = codes[0].rawValue; this.onDetect(code); this.close(); return; }
      } catch {}
      requestAnimationFrame(tick);
    };
    tick();
  }
  close() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach(t=>t.stop());
    if (this.overlay) this.overlay.remove();
  }
}
window.CameraScanner = CameraScanner;
