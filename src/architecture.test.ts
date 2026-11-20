import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture test: menjaga aturan yang tidak bisa (atau sulit) dicek ESLint.
 * Arah import per layer ada di eslint.config.js; test ini menjaga struktur folder,
 * batas antar modul, batas pemakaian library, dan konvensi runtime Node.
 * Penjelasan tiap aturan ada di docs/ARCHITECTURE.md. Kalau test ini gagal, perbaiki kodenya, bukan test-nya.
 */

const SRC = path.resolve(import.meta.dirname);
const TOP_LEVEL = ["app.ts", "main.ts", "architecture.test.ts", "config", "di", "modules", "scripts", "shared"];
const SHARED_DIRS = ["database", "domain", "http", "logger"];
const LAYERS = ["domain", "application", "infrastructure", "presentation"];
const PRESENTATION_FILE = /\.(controller|routes|schemas)(\.test)?\.ts$/;

const isIgnored = (name: string) => name.startsWith(".");
const entries = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !isIgnored(e.name));

function walk(dir: string): string[] {
  return entries(dir).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");
const isTest = (p: string) => p.endsWith(".test.ts");
const files = walk(SRC).filter((f) => f.endsWith(".ts")).map(rel);
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");

type Edge = { from: string; spec: string; to?: string };

/** Semua import dari satu file. `to` terisi untuk import relatif (path relatif terhadap src/). */
function importsOf(file: string): Edge[] {
  const pattern = /(?:import|export)\s[^"';]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  return [...read(file).matchAll(pattern)].map((m) => {
    const spec = (m[1] ?? m[2] ?? m[3])!;
    const to = spec.startsWith(".") ? rel(path.resolve(SRC, path.dirname(file), spec)) : undefined;
    return { from: file, spec, to };
  });
}

const edges = files.flatMap(importsOf);
const moduleOf = (p: string) => p.match(/^modules\/([^/]+)\//)?.[1];
const layerOf = (p: string) => p.match(/^modules\/[^/]+\/([^/]+)\//)?.[1];
const format = (e: Edge) => `${e.from} -> ${e.to ?? e.spec}`;

describe("struktur folder", () => {
  it("src/ hanya berisi app.ts, main.ts, config, di, modules, scripts, shared", () => {
    const extra = entries(SRC).map((e) => e.name).filter((n) => !TOP_LEVEL.includes(n));
    expect(extra, "File atau folder baru di src/ harus masuk ke salah satu folder yang sudah ada").toEqual([]);
  });

  it("src/shared/ hanya berisi database, domain, http, logger", () => {
    const extra = entries(path.join(SRC, "shared")).map((e) => e.name).filter((n) => !SHARED_DIRS.includes(n));
    expect(extra).toEqual([]);
  });

  it("setiap modul hanya berisi folder domain, application, infrastructure, presentation", () => {
    const violations = entries(path.join(SRC, "modules")).flatMap((mod) =>
      entries(path.join(SRC, "modules", mod.name))
        .filter((e) => !e.isDirectory() || !LAYERS.includes(e.name))
        .map((e) => `modules/${mod.name}/${e.name}`),
    );
    expect(violations).toEqual([]);
  });

  it("layer tidak punya subfolder", () => {
    const violations = files.filter((p) => /^modules\/[^/]+\/[^/]+\/[^/]+\//.test(p));
    expect(violations).toEqual([]);
  });

  it("file presentation bernama *.controller.ts, *.routes.ts, atau *.schemas.ts", () => {
    const violations = files.filter((p) => layerOf(p) === "presentation" && !PRESENTATION_FILE.test(p));
    expect(violations).toEqual([]);
  });

  it("schema tabel Drizzle (*.table.ts) hanya ada di infrastructure", () => {
    const violations = files.filter((p) => p.endsWith(".table.ts") && layerOf(p) !== "infrastructure");
    expect(violations).toEqual([]);
  });
});

describe("batas antar modul", () => {
  it("shared/ tidak bergantung pada modules, di, config, atau app", () => {
    const violations = edges
      .filter((e) => e.from.startsWith("shared/") && e.to && /^(modules|di|config)\/|^(app|main)\.ts$/.test(e.to))
      .map(format);
    expect(violations).toEqual([]);
  });

  it("infrastructure hanya di-import oleh modulnya sendiri, di/container.ts, scripts/, dan test", () => {
    const violations = edges
      .filter((e) => e.to && layerOf(e.to) === "infrastructure")
      .filter((e) => !(layerOf(e.from) === "infrastructure" && moduleOf(e.from) === moduleOf(e.to!)))
      .filter((e) => e.from !== "di/container.ts" && !e.from.startsWith("scripts/") && !isTest(e.from))
      .map(format);
    expect(violations).toEqual([]);
  });

  it("dependency antar modul tidak membentuk siklus", () => {
    const graph = new Map<string, Set<string>>();
    for (const e of edges) {
      const a = moduleOf(e.from);
      const b = e.to && moduleOf(e.to);
      if (a && b && a !== b && !isTest(e.from)) {
        if (!graph.has(a)) graph.set(a, new Set());
        graph.get(a)!.add(b);
      }
    }
    const cycles = new Set<string>();
    const visit = (node: string, trail: string[]) => {
      if (trail.includes(node)) return void cycles.add([...trail.slice(trail.indexOf(node)), node].join(" -> "));
      for (const next of graph.get(node) ?? []) visit(next, [...trail, node]);
    };
    for (const node of graph.keys()) visit(node, []);
    expect([...cycles]).toEqual([]);
  });
});

describe("batas pemakaian library", () => {
  const allowed = (e: Edge, places: RegExp) => isTest(e.from) || places.test(e.from);

  it("express hanya dipakai di presentation, shared/http, dan app.ts", () => {
    const violations = edges
      .filter((e) => e.spec === "express" && !allowed(e, /^(modules\/[^/]+\/presentation\/|shared\/http\/|app\.ts$|main\.ts$)/))
      .map(format);
    expect(violations).toEqual([]);
  });

  it("drizzle-orm dan pg hanya dipakai di infrastructure, shared/database, dan scripts/", () => {
    const violations = edges
      .filter((e) => /^(drizzle-orm(\/.*)?|pg)$/.test(e.spec))
      .filter((e) => !allowed(e, /^(modules\/[^/]+\/infrastructure\/|shared\/database\/|scripts\/)/))
      .map(format);
    expect(violations).toEqual([]);
  });
});

describe("konvensi runtime dan HTTP", () => {
  it("process.env hanya dibaca di config/env.ts", () => {
    const violations = files.filter((p) => p !== "config/env.ts" && !isTest(p) && /process\.env/.test(read(p)));
    expect(violations).toEqual([]);
  });

  it("import relatif memakai ekstensi .ts (Node menjalankan .ts langsung)", () => {
    const violations = edges.filter((e) => e.spec.startsWith(".") && !e.spec.endsWith(".ts")).map(format);
    expect(violations).toEqual([]);
  });

  it("controller tidak memakai try/catch (Express 5 meneruskan error ke errorHandler)", () => {
    const violations = files.filter((p) => p.endsWith(".controller.ts") && /\btry\s*\{/.test(read(p)));
    expect(violations).toEqual([]);
  });
});
