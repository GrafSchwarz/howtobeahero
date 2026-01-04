const { existsSync, readdirSync, statSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.join("node_modules", "@foundryvtt", "foundryvtt-cli", "fvtt.mjs");
const outRoot = "packs"; // YAML destination
const srcCandidates = [".packs-build", path.join("release", "packs")]; // DB sources (preferred first)
const workingRoot = ".packs-unpack-tmp"; // temp copy to normalize LevelDB files
const systemId = "how-to-be-a-hero";

if (!existsSync(cli)) {
  console.error("Foundry CLI not installed. Run npm install.");
  process.exit(1);
}

const srcRoot = srcCandidates.find((dir) => existsSync(dir));
if (!srcRoot) {
  console.log(`Skipping pack unpack: none of ${srcCandidates.join(", ")} found.`);
  process.exit(0);
}

console.log(`Using pack source: ${srcRoot}`);

function isLevelDbDirectory(dirPath) {
  const entries = readdirSync(dirPath);
  return entries.some((entry) => entry === "CURRENT" || entry.endsWith(".ldb"));
}

// Find compendium DBs (LevelDB dirs or .db files) in srcRoot
const dbEntries = readdirSync(srcRoot)
  .map((entry) => {
    const p = path.join(srcRoot, entry);
    return { path: p, stats: statSync(p) };
  })
  .filter(({ path: p, stats }) => {
    if (stats.isFile()) return p.endsWith(".db");
    if (stats.isDirectory()) return isLevelDbDirectory(p);
    return false;
  });

if (!dbEntries.length) {
  console.log(`No compendium DBs found in ${srcRoot}; nothing to unpack.`);
  process.exit(0);
}

// Ensure destination exists
if (!existsSync(outRoot)) mkdirSync(outRoot, { recursive: true });
// Ensure working directory is clean
if (existsSync(workingRoot)) rmSync(workingRoot, { recursive: true, force: true });
mkdirSync(workingRoot, { recursive: true });

for (const { path: dbPath, stats } of dbEntries) {
  const compendiumName = path.basename(dbPath).replace(/\.db$/, "");
  const workingPackPath = path.join(workingRoot, compendiumName);
  if (existsSync(workingPackPath)) rmSync(workingPackPath, { recursive: true, force: true });

  // Copy to a temp location so we can normalize the LevelDB CURRENT file (CRLF breaks classic-level on Windows)
  if (stats.isDirectory()) {
    cpSync(dbPath, workingPackPath, { recursive: true });
    const currentFile = path.join(workingPackPath, "CURRENT");
    if (existsSync(currentFile)) {
      const manifestLine = readFileSync(currentFile, "utf8").split(/\n/)[0]?.trim();
      if (manifestLine) writeFileSync(currentFile, `${manifestLine}\n`);
    }
  } else {
    cpSync(dbPath, workingPackPath);
  }

  const destDir = path.join(outRoot, compendiumName);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const args = [
    cli,
    "package",
    "unpack",
    "--type",
    "System",
    "--id",
    systemId,
    "--compendiumName",
    compendiumName,
    "--inputDirectory",
    workingRoot,
    "--outputDirectory",
    destDir,
    "--yaml",
    "--folders",
    "--recursive"
  ];

  console.log(`Unpacking ${compendiumName} from ${dbPath}...`);
  const res = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (res.status) {
    console.error(`Unpacking ${compendiumName} failed with code ${res.status}`);
    process.exit(res.status);
  }
}

// Clean up working copies
rmSync(workingRoot, { recursive: true, force: true });

console.log("Unpack complete.");
