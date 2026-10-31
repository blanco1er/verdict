/**
 * GET /api/image?u=<YouCam result URL> -> the image bytes.
 * YouCam result links are signed S3 URLs without CORS; the gallery copies them through here.
 * Only YouCam result hosts are allowed (no open proxy).
 */
const ALLOWED = /^https:\/\/(yce-[a-z0-9-]+\.s3[a-z0-9.-]*\.amazonaws\.com|[a-z0-9-]+\.makeupar\.com|app-cdn\.makeupar\.com)\//i;

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get("u") ?? "";
  if (!ALLOWED.test(u)) return Response.json({ error: "Only YouCam result images" }, { status: 400 });
  const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return Response.json({ error: `Upstream ${res.status}` }, { status: 502 });
  const type = res.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return Response.json({ error: "Not an image" }, { status: 502 });
  return new Response(res.body, { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
}
