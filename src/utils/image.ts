/**
 * Pictures chosen by search are plain https links (tiny). Pictures uploaded/pasted from the phone are
 * data URLs and can be several MB, so shrink them before sending them to the room's other players.
 */
const MAX_DATA_URL_CHARS = 240_000;

export async function prepareSecretImage(url: string): Promise<string> {
  if (!url.startsWith('data:')) return url;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = url;
    });
    for (const [maxSide, quality] of [[512, 0.82], [384, 0.7], [256, 0.6]] as const) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff'; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', quality);
      if (out.length <= MAX_DATA_URL_CHARS) return out;
    }
  } catch {
    /* fall through */
  }
  return url;
}
