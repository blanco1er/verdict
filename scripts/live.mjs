#!/usr/bin/env node
// Live YouCam calls for the owner's real measurements. Run through scripts/youcam-live.sh (key from the keychain).
//   check                         free: unit balance + official cost grid (no unit spent)
//   session --kind K --concerns a,b,c,d [--label "..."] [--product "..." --claim "..." --purchased YYYY-MM-DD --window 30] [--yes] photos...
// Without --yes nothing is spent: the photos are checked locally (size, light) and the cost is shown.
// Only scores are stored (src/lib/live/measured.json); photos and file names never are.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const API = process.env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com";
const KEY = process.env.YOUCAM_API_KEY || "";
const OUT = process.env.VERDICT_MEASURED_OUT || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../src/lib/live/measured.json");
const SD = ["wrinkle", "pore", "texture", "acne", "oiliness", "radiance", "eye_bag", "age_spot", "dark_circle_v2", "droopy_upper_eyelid", "droopy_lower_eyelid", "firmness", "moisture", "redness", "tear_trough", "skin_type"];
const KINDS = ["repeatability", "control", "series"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!KEY) {
  console.error("YOUCAM_API_KEY absente : passez par zsh scripts/youcam-live.sh");
  process.exit(1);
}

async function call(method, p, body, attempt = 0) {
  const res = await fetch(API + p, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (res.status === 429 && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
    console.log(`  429 (limite de débit) : nouvel essai dans ${Math.round(wait / 1000)} s${res.headers.get("retry-after") ? " (Retry-After présent)" : ""}`);
    await sleep(wait);
    return call(method, p, body, attempt + 1);
  }
  if (res.status >= 400) throw new Error(`${method} ${p.split("?")[0]} → HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function balance() {
  const r = await call("GET", "/s2s/v1.0/client/credit");
  const list = r.results ?? r.data?.results ?? [];
  return { units: list.reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0), expiry: list.map((x) => x.expiry).filter(Boolean).sort()[0] };
}

async function check() {
  const b = await balance();
  console.log(`Solde : ${b.units} unités${b.expiry ? ` (première expiration le ${new Date(b.expiry).toISOString().slice(0, 10)})` : ""}.`);
  const rows = [];
  let token = "";
  for (let i = 0; i < 10; i++) {
    const r = await call("GET", `/s2s/v2.0/credit/feature-cost?page_size=20${token ? `&starting_token=${encodeURIComponent(token)}` : ""}`);
    const res = r.result ?? r.data ?? {};
    rows.push(...(res.skus ?? []));
    token = res.next_token;
    if (!token) break;
  }
  const wanted = rows.filter((s) => /skin analysis|skin simulation|look/i.test(s.description ?? ""));
  console.log("Grille officielle (extrait) :");
  for (const s of wanted) console.log(`  ${s.amount} unités / ${s.proc_unit} ${s.unit} : ${s.description}`);
  console.log(`${rows.length} lignes au total. Aucun appel payant.`);
}

function photoInfo(file) {
  const st = statSync(file);
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null;
  let w = 0;
  let h = 0;
  let brightness = null;
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
    w = Number(out.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
    h = Number(out.match(/pixelHeight: (\d+)/)?.[1] ?? 0);
    // Mean luminance on a 64x48 BMP made by sips (macOS): the same measure as the app's on-device meter.
    const dir = mkdtempSync(path.join(tmpdir(), "verdict-"));
    const bmp = path.join(dir, "s.bmp");
    execFileSync("sips", ["-s", "format", "bmp", "-z", "48", "64", file, "--out", bmp], { stdio: "ignore" });
    const b = readFileSync(bmp);
    rmSync(dir, { recursive: true, force: true });
    const off = b.readUInt32LE(10);
    const bw = b.readInt32LE(18);
    const bh = Math.abs(b.readInt32LE(22));
    const bpp = b.readUInt16LE(28) / 8;
    const row = Math.ceil((bw * bpp) / 4) * 4;
    let sum = 0;
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = off + y * row + x * bpp;
        sum += 0.0722 * b[i] + 0.7152 * b[i + 1] + 0.2126 * b[i + 2];
      }
    brightness = Math.round((sum / (bw * bh) / 255) * 1000) / 1000;
  } catch {
    /* sips missing: the API still checks light and framing itself */
  }
  let takenAt = st.mtime.toISOString();
  try {
    const d = execFileSync("mdls", ["-raw", "-name", "kMDItemContentCreationDate", file], { encoding: "utf8" }).trim();
    if (d && d !== "(null)") takenAt = new Date(d.replace(" +0000", "Z").replace(" ", "T")).toISOString();
  } catch {
    /* keep the file date */
  }
  return { size: st.size, type, w, h, short: Math.min(w, h), brightness, takenAt };
}

function issuesOf(i) {
  const out = [];
  if (!i.type) out.push("format (JPEG ou PNG)");
  if (i.size >= 10 * 1024 * 1024) out.push("plus de 10 Mo");
  if (i.short && i.short < 480) out.push(`petit côté ${i.short} px < 480`);
  if (i.brightness != null && i.brightness < 0.25) out.push(`trop sombre (${Math.round(i.brightness * 100)} %)`);
  if (i.brightness != null && i.brightness > 0.85) out.push(`surexposée (${Math.round(i.brightness * 100)} %)`);
  return out;
}

function load() {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { schema: 1, updated: null, product: null, sessions: [] };
  }
}
function save(data) {
  data.updated = new Date().toISOString();
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, OUT);
}

async function analyse(file, info, concerns) {
  const t0 = Date.now();
  const bytes = readFileSync(file);
  const created = await call("POST", "/s2s/v2.0/file", { files: [{ content_type: info.type, file_name: `verdict${info.type === "image/png" ? ".png" : ".jpg"}`, file_size: bytes.byteLength }] });
  const f = created.data.files[0];
  const put = await fetch(f.requests[0].url, { method: "PUT", headers: f.requests[0].headers, body: bytes });
  if (!put.ok) throw new Error(`PUT vers l'URL pré-signée → HTTP ${put.status}`);
  const run = await call("POST", "/s2s/v2.0/task/skin-analysis", { src_file_id: f.file_id, dst_actions: concerns, format: "json" });
  const taskId = run.data.task_id;
  for (let waited = 0; waited < 180_000; waited += 3000) {
    await sleep(3000);
    const s = await call("GET", `/s2s/v2.0/task/skin-analysis/${encodeURIComponent(taskId)}`);
    const st = s.data.task_status;
    if (st === "success") return { taskId, ms: Date.now() - t0, output: s.data.results?.output ?? [] };
    if (st === "error") {
      const e = new Error(`tâche en erreur : ${s.data.error ?? "?"} ${s.data.error_message ?? ""} (aucune unité facturée)`);
      e.task = true;
      throw e;
    }
  }
  throw new Error(`tâche ${taskId} encore en cours après 3 min`);
}

function parseArgs(argv) {
  const o = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") o.yes = true;
    else if (a.startsWith("--")) o[a.slice(2)] = argv[++i];
    else o.files.push(a);
  }
  return o;
}

async function session(argv) {
  const o = parseArgs(argv);
  if (!KINDS.includes(o.kind)) throw new Error(`--kind : ${KINDS.join(" | ")}`);
  const concerns = String(o.concerns ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (concerns.length < 1 || concerns.length > 4 || !concerns.every((c) => SD.includes(c))) throw new Error("--concerns : 1 à 4 critères SD, par ex. redness,pore,oiliness,moisture");
  if (!o.files.length) throw new Error("Aucune photo donnée.");
  const data = load();
  if (o.kind === "series" && !data.product && !o.product) throw new Error('Première photo de série : ajoutez --product "..." --claim "..." --purchased AAAA-MM-JJ --window 30');

  console.log(`Vérification locale de ${o.files.length} photo(s) (gratuit) :`);
  const infos = o.files.map((f) => ({ f, i: photoInfo(f) }));
  let blocked = 0;
  for (const { f, i } of infos) {
    const issues = issuesOf(i);
    if (issues.some((x) => !x.startsWith("trop sombre") && !x.startsWith("surexposée"))) blocked++;
    console.log(`  ${path.basename(f)} : ${i.w}×${i.h}, lumière ${i.brightness == null ? "?" : Math.round(i.brightness * 100) + " %"}, prise le ${i.takenAt.slice(0, 16).replace("T", " ")} UTC${issues.length ? `  ⚠ ${issues.join(", ")}` : ""}`);
  }
  if (blocked) throw new Error(`${blocked} photo(s) refusée(s) avant tout appel : corrigez-les, rien n'a été dépensé.`);
  const cost = (concerns.length <= 4 ? 9 : 12) * infos.length;
  const b = await balance();
  console.log(`Coût : ${infos.length} × 9 = ${cost} unités. Solde actuel : ${b.units}. Après : ${b.units - cost}.`);
  if (!o.yes) {
    console.log("Rien n'a été dépensé. Ajoutez --yes pour lancer les analyses.");
    return;
  }
  if (b.units - cost < 0) throw new Error("Solde insuffisant.");
  if (o.kind === "series" && o.product) {
    data.product = { name: o.product, claim: o.claim ?? "", purchasedOn: o.purchased ?? new Date().toISOString().slice(0, 10), returnWindowDays: Number(o.window ?? 30) };
  }
  let ok = 0;
  for (const { f, i } of infos) {
    process.stdout.write(`  ${path.basename(f)} … `);
    try {
      const r = await analyse(f, i, concerns);
      const scores = {};
      let all;
      for (const x of r.output) {
        if (x.type === "all") all = x.score;
        else if (x.raw_score != null) scores[x.type] = { raw: x.raw_score, ui: x.ui_score };
      }
      data.sessions.push({
        id: `${o.kind}-${data.sessions.filter((s) => s.kind === o.kind).length + 1}`,
        kind: o.kind,
        ...(o.label ? { label: String(o.label).slice(0, 80) } : {}),
        takenAt: i.takenAt,
        analyzedAt: new Date().toISOString(),
        scores,
        ...(all != null ? { all } : {}),
        taskId: r.taskId,
        latencyMs: r.ms,
        units: 9,
        photo: { shortSidePx: i.short, longSidePx: Math.max(i.w, i.h), brightness: i.brightness },
      });
      save(data);
      ok++;
      console.log(`${Math.round(r.ms / 100) / 10} s · ${Object.entries(scores).map(([k, v]) => `${k} raw ${Math.round(v.raw * 100) / 100} / ui ${v.ui}`).join(" · ")}`);
    } catch (e) {
      console.log(`échec : ${e.message}`);
    }
  }
  const after = await balance();
  console.log(`${ok}/${infos.length} analysées. Unités réellement consommées : ${Math.round((b.units - after.units) * 100) / 100}. Solde : ${after.units}.`);
  console.log(`Scores enregistrés dans ${path.relative(process.cwd(), OUT)} (aucune photo).`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "check") await check();
  else if (cmd === "session") await session(rest);
  else {
    console.log("Commandes : check | session (voir scripts/youcam-live.sh)");
    process.exit(2);
  }
} catch (e) {
  console.error(`Erreur : ${e.message}`);
  process.exit(1);
}
