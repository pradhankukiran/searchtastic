import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SearchEngine } from "@/lib/search/types";

const configDir = path.join(process.cwd(), "config");

export async function readSearchEngines() {
  const file = await readFile(path.join(configDir, "search-engines.json"), "utf8");
  const engines = JSON.parse(file) as SearchEngine[];

  return engines.filter(
    (engine) =>
      typeof engine.id === "string" &&
      typeof engine.name === "string" &&
      typeof engine.category === "string" &&
      typeof engine.enabled === "boolean",
  );
}

export async function readDomainList(fileName: "whitelist.txt" | "blacklist.txt") {
  const file = await readFile(path.join(configDir, fileName), "utf8");

  return file
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean);
}
