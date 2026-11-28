#!/usr/bin/env node
/**
 * Installs (idempotently) the Piston runtimes the IDE uses, at the pinned
 * versions from lib/code-runner/languages.ts. Plain Node 18+, no deps, so it
 * runs the same locally, in Docker and with `railway run`.
 *
 *   PISTON_URL=http://localhost:2000 node scripts/piston-install.mjs
 *
 * Downloads are large (Python ≈ 250 MB, Java ≈ 200 MB) and can take several
 * minutes; packages persist in Piston's /piston/packages volume, so this only
 * needs to run once per volume.
 */

const url = (process.env.PISTON_URL ?? "http://localhost:2000").replace(/\/+$/, "");
const token = process.env.PISTON_AUTH_TOKEN?.trim();
const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

const wanted = [
  { language: "python", version: process.env.PISTON_PYTHON_VERSION || "3.12.0" },
  { language: "java", version: process.env.PISTON_JAVA_VERSION || "15.0.2" },
  { language: "typescript", version: process.env.PISTON_TYPESCRIPT_VERSION || "5.0.3" },
];

async function waitForPiston() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${url}/api/v2/runtimes`, { headers });
      if (res.ok) return res.json();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Piston no respondió en ${url} después de 2 minutos.`);
}

const installed = await waitForPiston();
console.log(`Piston en ${url} — runtimes instalados: ${installed.map((r) => `${r.language}@${r.version}`).join(", ") || "(ninguno)"}`);

let failed = false;
for (const pkg of wanted) {
  if (installed.some((r) => r.language === pkg.language && r.version === pkg.version)) {
    console.log(`✓ ${pkg.language}@${pkg.version} ya instalado`);
    continue;
  }
  console.log(`… instalando ${pkg.language}@${pkg.version} (puede tardar varios minutos)`);
  const started = Date.now();
  const res = await fetch(`${url}/api/v2/packages`, { method: "POST", headers, body: JSON.stringify(pkg) });
  const body = await res.text();
  if (res.ok) {
    console.log(`✓ ${pkg.language}@${pkg.version} instalado en ${Math.round((Date.now() - started) / 1000)} s`);
  } else {
    failed = true;
    console.error(`✗ ${pkg.language}@${pkg.version}: HTTP ${res.status} ${body.slice(0, 300)}`);
  }
}

process.exit(failed ? 1 : 0);
