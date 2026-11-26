#!/usr/bin/env node
/**
 * Zero-dependency CLI for @imliulian/dsh-zeromem:
 *   dsh-zeromem search <query> [--db PATH] [--ns NS] [--occurred-from DATE] [--occurred-to DATE] [--hide-superseded] [--limit N] [--json]
 *   dsh-zeromem export --md [--db PATH] [-o FILE | --dir DIR] [--ns NS] [--occurred-from DATE] [--occurred-to DATE] [--as-of DATE] [--hide-superseded] [--include-evicted] [--no-frontmatter] [--json]
 *   dsh-zeromem backup [OUT] [--db PATH] [-o OUT] [--overwrite] [--no-verify] [--sha256] [--json]
 *   dsh-zeromem stats [--db PATH] [--ns NS] [--json]
 */

import { defaultDbPath, expandHome } from "../lib/config.mjs";
import { backupDatabase, exportMarkdown } from "../lib/portability.mjs";
import { SQLiteMemoryStore } from "../lib/store.mjs";

function printHelp() {
  console.log(`dsh-zeromem — ZeroMem (零忆) local SQLite memory CLI

Usage:
  dsh-zeromem search [query] [--db PATH] [--ns NS] [--occurred-from DATE] [--occurred-to DATE] [--hide-superseded] [--limit N] [--json]
  dsh-zeromem export --md [--db PATH] [-o FILE | --dir DIR] [--ns NS] [--occurred-from DATE] [--occurred-to DATE] [--as-of DATE] [--hide-superseded] [--include-evicted] [--no-frontmatter] [--json]
  dsh-zeromem backup [OUT] [--db PATH] [-o OUT] [--overwrite] [--no-verify] [--sha256] [--json]
  dsh-zeromem stats [--db PATH] [--ns NS] [--json]
`);
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  const valueFlags = new Set([
    "--db",
    "--ns",
    "--namespace",
    "--limit",
    "--as-of",
    "--occurred-from",
    "--occurred-to",
    "-o",
    "--output",
    "--dir",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      flags.help = true;
      continue;
    }
    if (valueFlags.has(arg)) {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`Missing value for ${arg}`);
      flags[arg] = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      const idx = arg.indexOf("=");
      flags[arg.slice(0, idx)] = arg.slice(idx + 1);
      continue;
    }
    if (arg.startsWith("-")) {
      flags[arg] = true;
      continue;
    }
    positionals.push(arg);
  }
  return { flags, positionals };
}

export async function runCli(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const cmd = positionals[0];
  if (!cmd || flags.help) {
    printHelp();
    return 0;
  }

  const dbPath = flags["--db"] ? expandHome(flags["--db"]) : defaultDbPath();
  const ns = flags["--ns"] || flags["--namespace"] || null;
  const asJson = Boolean(flags["--json"]);

  if (cmd === "stats") {
    const store = new SQLiteMemoryStore(dbPath);
    const st = store.stats(ns);
    if (asJson) {
      console.log(JSON.stringify(st, null, 2));
    } else {
      console.log(`DB: ${st.db_path}`);
      console.log(
        `Documents: ${st.documents} | Segments: ${st.segments} | Facts: ${st.facts} (revised ${st.revised_facts}) | Supersessions: ${st.supersessions} | Evicted: ${st.evicted_records}`
      );
      console.log(`Namespaces: ${st.namespaces.length ? st.namespaces.join(", ") : "(none)"}`);
    }
    return 0;
  }

  if (cmd === "search") {
    const query = positionals.slice(1).join(" ");
    const store = new SQLiteMemoryStore(dbPath);
    const hits = store.search(query, {
      namespace: ns,
      limit: flags["--limit"] ? Number(flags["--limit"]) : null,
      asOf: flags["--as-of"] || null,
      occurredFrom: flags["--occurred-from"] || null,
      occurredTo: flags["--occurred-to"] || null,
      includeSuperseded: !flags["--hide-superseded"],
    });
    if (asJson) {
      console.log(JSON.stringify(hits, null, 2));
    } else if (!hits.length) {
      console.log("(no matching memories)");
    } else {
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        const badges = [];
        if (h.occurred_start) badges.push(h.occurred_start);
        if (h.supersedes_fact_id) badges.push(`替代 #${h.supersedes_fact_id}`);
        if (h.superseded_by?.length) badges.push(`已被 ${h.superseded_by.map((x) => `#${x}`).join(",")} 替代`);
        if (h.until_expiry?.label) badges.push(h.until_expiry.label);
        const badgeStr = badges.length ? ` [${badges.join(" | ")}]` : "";
        console.log(`${i + 1}. (#${h.fact_id} · ${h.namespace}${badgeStr}) ${h.text}`);
      }
    }
    return 0;
  }

  if (cmd === "export") {
    const outputPath = flags["-o"] || flags["--output"] || null;
    const outputDir = flags["--dir"] || null;
    const res = exportMarkdown({
      dbPath,
      outputPath,
      outputDir,
      namespace: ns,
      occurredFrom: flags["--occurred-from"] || null,
      occurredTo: flags["--occurred-to"] || null,
      asOf: flags["--as-of"] || null,
      includeSuperseded: !flags["--hide-superseded"],
      includeEvicted: Boolean(flags["--include-evicted"]),
      frontmatter: !flags["--no-frontmatter"],
    });
    if (res.mode === "stdout" && !asJson) {
      process.stdout.write(res.markdown || "");
    } else if (asJson) {
      const out = { ...res };
      if (out.mode !== "stdout") delete out.markdown;
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(
        `Exported ${res.facts_exported} facts (${res.documents_referenced} docs) -> ${res.output_dir || res.output_path}`
      );
    }
    return 0;
  }

  if (cmd === "backup") {
    const outTarget = flags["-o"] || flags["--output"] || positionals[1] || null;
    const receipt = await backupDatabase({
      dbPath,
      outputPath: outTarget,
      overwrite: Boolean(flags["--overwrite"]),
      verify: !flags["--no-verify"],
      writeSha256: Boolean(flags["--sha256"]),
    });
    if (asJson) {
      console.log(JSON.stringify(receipt, null, 2));
    } else {
      console.log(
        `Backup OK (${receipt.journal_mode}, integrity=${receipt.integrity_check}, ${receipt.size_bytes} B): ${receipt.backup_path}`
      );
      console.log(`SHA-256: ${receipt.sha256}`);
    }
    return 0;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  runCli().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`dsh-zeromem error: ${err?.message || err}`);
      process.exitCode = 1;
    }
  );
}
