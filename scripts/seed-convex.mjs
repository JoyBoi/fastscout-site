#!/usr/bin/env node
/**
 * Seed makes, models, and appConfig into Convex.
 *
 * Usage (dev):  npm run seed
 * Usage (prod): npm run seed:prod
 *
 * Requires: npx convex dev (or convex deploy) to have been run first.
 * Data source: ref/makeData.json and ref/brandData.clean.json
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const isProd = process.argv.includes("--prod");

function run(fn, args) {
  // Use spawnSync to avoid shell quoting issues with special chars in data
  const argv = ["convex", "run"];
  if (isProd) argv.push("--prod");
  argv.push(fn, JSON.stringify(args));

  const result = spawnSync("npx", argv, { cwd: root, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Command failed: ${fn}`);
  }
  try { return JSON.parse(result.stdout); } catch { return result.stdout.trim(); }
}

async function main() {
  console.log(`Seeding Convex (${isProd ? "production" : "dev"})...`);

  const makesRaw = JSON.parse(
    await readFile(resolve(root, "ref/makeData.json"), "utf-8"),
  );
  const modelsRaw = JSON.parse(
    await readFile(resolve(root, "ref/brandData.clean.json"), "utf-8"),
  );

  // makeData.json: { name: makeId, ... }
  const makes = Object.entries(makesRaw).map(([name, id]) => ({
    makeId: String(id),
    name: String(name),
  }));

  // brandData.clean.json: [{ id, name, makeId }, ...]
  const models = modelsRaw.map((m) => ({
    modelId: String(m.id),
    makeId: String(m.makeId),
    name: String(m.name),
  }));

  const BATCH = 100;

  console.log(`Seeding ${makes.length} makes...`);
  let makesInserted = 0;
  for (let i = 0; i < makes.length; i += BATCH) {
    const result = run("seed:importMakes", { makes: makes.slice(i, i + BATCH) });
    makesInserted += result?.inserted ?? 0;
    process.stdout.write(`  ${Math.min(i + BATCH, makes.length)}/${makes.length}\r`);
  }
  console.log(`\nMakes: ${makesInserted} inserted, ${makes.length - makesInserted} skipped.`);

  console.log(`Seeding ${models.length} models...`);
  let modelsInserted = 0;
  for (let i = 0; i < models.length; i += BATCH) {
    const result = run("seed:importModels", { models: models.slice(i, i + BATCH) });
    modelsInserted += result?.inserted ?? 0;
    process.stdout.write(`  ${Math.min(i + BATCH, models.length)}/${models.length}\r`);
  }
  console.log(`\nModels: ${modelsInserted} inserted, ${models.length - modelsInserted} skipped.`);

  const version = Number(process.env.EXTENSION_DATA_VERSION ?? "1");
  run("seed:setConfig", { key: "brand_data_version", value: version });
  console.log(`appConfig brand_data_version = ${version}`);

  console.log("Done.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
