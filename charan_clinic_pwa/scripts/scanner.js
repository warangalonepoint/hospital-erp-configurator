<script type="module">
import { decodeFrame } from "./barcode.js";
export async function startScan(video, canvas, onCode){
  const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
  video.srcObject = stream; await video.play();
  const ctx = canvas.getContext("2d");
  const loop = async ()=>{
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const code = await decodeFrame(ctx, canvas.width, canvas.height);
    if(code){ onCode(code); stop(); }
    else requestAnimationFrame(loop);
  }; loop();
  function stop(){ stream.getTracks().forEach(t=>t.stop()); }
  return stop;
}
</script>
