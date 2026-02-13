import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function main() {
  const makesPath = resolve(process.cwd(), "ref/makeData.json");
  const modelsPath = resolve(process.cwd(), "ref/brandData.clean.json");
  const outPath = resolve(process.cwd(), "supabase/seed.sql");
  const makesJson = JSON.parse(await readFile(makesPath, "utf-8"));
  const modelsJson = JSON.parse(await readFile(modelsPath, "utf-8"));
  const versionRaw = process.env.EXTENSION_DATA_VERSION || "1";
  const version = Number.parseInt(versionRaw, 10) || 1;

  const makesRows = Object.entries(makesJson).map(([name, id]) => ({ id: String(id), name: String(name) }));
  const modelsRows = modelsJson.map((m) => ({ id: String(m.id), make_id: String(m.makeId), name: String(m.name) }));

  let sql = "";
  if (makesRows.length) {
    const chunkSize = 500;
    for (let i = 0; i < makesRows.length; i += chunkSize) {
      const chunk = makesRows.slice(i, i + chunkSize);
      const values = chunk.map((r) => `('${r.id}','${r.name.replace(/'/g, "''")}')`).join(",");
      sql += `insert into makes(id,name) values ${values} on conflict (id) do update set name=excluded.name;\n`;
    }
  }
  if (modelsRows.length) {
    const chunkSize = 1000;
    for (let i = 0; i < modelsRows.length; i += chunkSize) {
      const chunk = modelsRows.slice(i, i + chunkSize);
      const values = chunk.map((r) => `('${r.id}','${r.make_id}','${r.name.replace(/'/g, "''")}')`).join(",");
      sql += `insert into models(id,make_id,name) values ${values} on conflict (id) do update set make_id=excluded.make_id, name=excluded.name;\n`;
    }
  }
  sql += `insert into app_config(key,value) values ('brand_data_version', ${version}) on conflict (key) do update set value=excluded.value;\n`;

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, sql, "utf-8");
  process.stdout.write(outPath + "\n");
}

main();
