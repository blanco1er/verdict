/**
 * A phone photo is often 4–8 MB, over the 4.5 MB a serverless request accepts: the upload is
 * refused before our route runs. Re-encode it as a JPEG of at most `maxSide` pixels (EXIF
 * orientation applied), which also stays well inside what YouCam asks for.
 */
export async function fitPhoto(file: File, maxSide = 2048): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3_000_000 && (file.type === "image/jpeg" || file.type === "image/png")) {
      bmp.close();
      return file;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
