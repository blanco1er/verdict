#!/usr/bin/env node
// Rapport en français des visites de la démo publique de Verdict (pour le propriétaire seulement).
//   node scripts/visits-report.mjs [--url https://…] [--depuis AAAA-MM-JJ] [--detail] [--tout] [--lien-interne] [--fichier export.json]
// Le jeton est lu dans le trousseau (scripts/visits-token.sh) et envoyé en en-tête, jamais dans l'URL.
// --tout : garde aussi les robots et les visites internes. --lien-interne : imprime le lien à ouvrir une fois
// sur chaque appareil du propriétaire pour que ses visites soient exclues.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (n) => args.includes(n);
const SERVICE = "verdict-visits";
const URL0 = (opt("--url") || process.env.VERDICT_URL || "").replace(/\/+$/, "");

function token() {
  if (process.env.VERDICT_VISITS_TOKEN) return process.env.VERDICT_VISITS_TOKEN;
  try {
    return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", "verdict", "-w"], { encoding: "utf8" }).trim();
  } catch {
    console.error("Aucun jeton dans le trousseau : lancez zsh scripts/visits-token.sh");
    process.exit(1);
  }
}

if (has("--lien-interne")) {
  if (!URL0) {
    console.error("Donnez l'adresse de la démo : --url https://…");
    process.exit(1);
  }
  const k = createHmac("sha256", token()).update("internal-link").digest("hex").slice(0, 40);
  console.log(`Ouvrez ce lien une fois sur chacun de vos appareils (Safari de l'iPhone, Chrome du Mac) :\n${URL0}/api/visits/internal?k=${k}\nCe lien ne donne pas accès au journal.`);
  process.exit(0);
}

const since = opt("--depuis") || new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
let data;
if (opt("--fichier")) data = JSON.parse(readFileSync(opt("--fichier"), "utf8"));
else {
  if (!URL0) {
    console.error("Donnez l'adresse de la démo : --url https://… (ou VERDICT_URL)");
    process.exit(1);
  }
  const res = await fetch(`${URL0}/api/visits/export?since=${since}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 404) {
    console.error("Export introuvable (404) : jeton absent ou différent sur le serveur, ou journal coupé.");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Export refusé : HTTP ${res.status}`);
    process.exit(1);
  }
  data = await res.json();
}

const all = data.events ?? [];
const ev = has("--tout") ? all : all.filter((e) => !e.bot && !e.int);
const people = new Map();
for (const e of ev) {
  const p = people.get(e.v) ?? { first: e.t, last: e.t, ref: null, dev: `${e.dev} · ${e.os} · ${e.br}`, pages: new Set(), actions: [], live: 0, demo: 0, refused: 0, ms: 0, errors: 0, events: [] };
  p.last = e.t;
  if (e.e === "page") {
    p.pages.add(e.product ? `${e.path}?${e.product}` : e.path);
    if (!p.ref && e.ref && e.ref !== "self") p.ref = e.src ? `${e.ref} (${e.src})` : e.ref;
  }
  if (e.e === "action") p.actions.push(e.name);
  if (e.e === "analysis") {
    if (e.mode === "live") p.live++;
    else p.demo++;
    if (e.refused) p.refused++;
  }
  if (e.e === "leave") p.ms += e.ms || 0;
  if (e.e === "client_error") p.errors++;
  p.events.push(e);
  people.set(e.v, p);
}

const fmtDur = (ms) => (ms < 60e3 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60e3)} min`);
const paris = (iso) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const count = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);

console.log(`Verdict : visites depuis le ${since} (stockage : ${data.store ?? "?"}, ${all.length} événements, ${all.length - ev.length} écartés : robots et vos appareils)`);
console.log(`Personnes uniques : ${people.size}`);
const byDay = count([...people.values()].flatMap((p) => [...new Set(p.events.map((e) => e.t.slice(0, 10)))]));
if (byDay.length) console.log(`Par jour : ${byDay.sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => `${d.slice(5)} : ${n}`).join(" · ")}`);
console.log(`Provenance : ${count([...people.values()].map((p) => p.ref || "accès direct")).map(([r, n]) => `${r} ${n}`).join(" · ") || "—"}`);
console.log(`Appareils : ${count([...people.values()].map((p) => p.dev)).map(([d, n]) => `${d} ${n}`).join(" · ") || "—"}`);

const ps = [...people.values()];
const reached = (f) => ps.filter(f).length;
console.log("\nJusqu'où ils sont allés :");
console.log(`  ouvert l'app ............................ ${reached((p) => p.pages.size > 0)}`);
console.log(`  ouvert une fiche produit ................ ${reached((p) => [...p.pages].some((x) => x.startsWith("/product")))}`);
console.log(`  lancé la relecture (Replay) ............. ${reached((p) => p.actions.includes("replay"))}`);
console.log(`  ouvert la photo guidée .................. ${reached((p) => [...p.pages].some((x) => x.startsWith("/capture")))}`);
console.log(`  analyse en démo ......................... ${reached((p) => p.demo > 0)}`);
console.log(`  analyse réelle YouCam ................... ${reached((p) => p.live > 0)}  (${ps.reduce((s, p) => s + p.live, 0)} analyses, ${ps.reduce((s, p) => s + p.live, 0) * 9} unités)`);
console.log(`  vue marques (Brands) .................... ${reached((p) => p.pages.has("/merchant"))}`);
console.log(`  page Measured (vraies données) .......... ${reached((p) => p.pages.has("/measured"))}`);
console.log(`  ajouté un produit ....................... ${reached((p) => p.actions.includes("add_product"))}`);
const refusals = count(ev.filter((e) => e.e === "analysis" && e.refused).map((e) => e.refused));
if (refusals.length) console.log(`Analyses réelles refusées (passées en démo) : ${refusals.map(([r, n]) => `${r} ${n}`).join(" · ")}`);
const errs = ev.filter((e) => e.e === "client_error" || (e.e === "analysis" && e.outcome !== "ok"));
if (errs.length) {
  console.log(`\nErreurs (${errs.length}) :`);
  for (const e of errs.slice(-10)) console.log(`  ${paris(e.t)} ${e.e === "client_error" ? `JS : ${e.msg} (${e.src})` : `analyse ${e.mode} : ${e.outcome}${e.code ? ` ${e.code}` : ""}`}`);
}

if (has("--detail")) {
  console.log("\nDétail par personne :");
  for (const [v, p] of [...people].sort((a, b) => a[1].first.localeCompare(b[1].first))) {
    console.log(`\n${v} · ${paris(p.first)} → ${paris(p.last)} · ${p.ref || "accès direct"} · ${p.dev}${p.ms ? ` · ${fmtDur(p.ms)} sur les pages` : ""}`);
    for (const e of p.events) {
      const what =
        e.e === "page" ? `page ${e.path}${e.product ? ` (${e.product})` : ""}` : e.e === "action" ? `action ${e.name}` : e.e === "analysis" ? `analyse ${e.mode}${e.refused ? ` (refus : ${e.refused})` : ""} · ${e.concerns} critère(s) · ${e.units} unités · ${e.outcome} · ${e.ms} ms` : e.e === "leave" ? `quitte ${e.path ?? ""} après ${fmtDur(e.ms || 0)}` : `${e.e} ${e.msg ?? ""}`;
      console.log(`  ${paris(e.t)}  ${what}`);
    }
  }
}
