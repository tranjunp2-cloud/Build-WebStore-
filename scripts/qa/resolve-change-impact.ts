import fs from "fs";
import path from "path";
import {
  parseCoverageMap,
  resolveChangeImpact,
} from "../../src/lib/admin/qa/change-impact";

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const pathsFile = getOption("--paths-file");
const mapFile =
  getOption("--map-file") ?? path.resolve(process.cwd(), "qa/coverage-map.yml");
if (!pathsFile)
  throw new Error(
    "Usage: tsx scripts/qa/resolve-change-impact.ts --paths-file <file> [--map-file <file>]",
  );

const changedPaths = fs
  .readFileSync(pathsFile, "utf8")
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const coverageMap = parseCoverageMap(fs.readFileSync(mapFile, "utf8"));
process.stdout.write(
  `${JSON.stringify(resolveChangeImpact(changedPaths, coverageMap))}\n`,
);
