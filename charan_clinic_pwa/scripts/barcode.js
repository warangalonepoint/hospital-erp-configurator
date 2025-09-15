<script src="https://unpkg.com/jsqr@1.4.0/dist/jsQR.js"></script>
<script>
export async function decodeFrame(ctx, w, h){
  const img = ctx.getImageData(0,0,w,h);
  const code = jsQR(img.data, w, h);
  return code?.data || null;
}
</script>
