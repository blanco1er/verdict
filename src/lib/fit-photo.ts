/**
 * A phone photo is often 4–8 MB, over the 4.5 MB a serverless request accepts: the upload is
 * refused before our route runs. Re-encode it as a JPEG of at most `maxSide` pixels (EXIF
 * orientation applied), which also stays well inside what YouCam asks for.
 */
export async function fitPhoto(file: File, maxSide = 2048): Promise<File> {
  try {
    const img = await decode(file);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 3_000_000 && (file.type === "image/jpeg" || file.type === "image/png")) {
      img.close();
      return file;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, c.width, c.height);
    img.close();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** ImageBitmap first; an <img> when the browser will not make a bitmap of a very large photo (48 MP, HEIC). */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  }
}
