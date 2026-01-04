const { existsSync, readdirSync, statSync, mkdirSync, rmSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cli = path.join("node_modules", "@foundryvtt", "foundryvtt-cli", "fvtt.mjs");
const srcRoot = "packs"; // YAML sources
const outRoot = ".packs-build"; // generated DB output
const systemId = "how-to-be-a-hero";

if (!existsSync(cli)) {
  console.error("Foundry CLI not installed. Run npm install.");
  process.exit(1);
}

if (!existsSync(srcRoot)) {
  console.log(`Skipping pack build: ${srcRoot} not found.`);
  process.exit(0);
}

const packDirs = readdirSync(srcRoot)
  .map((entry) => path.join(srcRoot, entry))
  .filter((p) => statSync(p).isDirectory());

if (!packDirs.length) {
  console.log(`No pack sources found in ${srcRoot}; skipping pack build.`);
  process.exit(0);
}

// Clean output directory
if (existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

for (const dir of packDirs) {
  const compendiumName = path.basename(dir);
  const args = [
    cli,
    "package",
    "pack",
    "--type",
    "System",
    "--id",
    systemId,
    "--compendiumName",
    compendiumName,
    "--inputDirectory",
    dir,
    "--outputDirectory",
    outRoot,
    "--yaml",
    "--recursive"
  ];

  console.log(`Packing ${compendiumName} from ${dir}...`);
  const res = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (res.status) {
    console.error(`Packing ${compendiumName} failed with code ${res.status}`);
    process.exit(res.status);
  }
}

console.log("Pack build complete.");
