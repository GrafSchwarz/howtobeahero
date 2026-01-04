# Contributing / Local Dev Setup

## Prereqs
- Node 20+ (matches GitHub Actions).
- Git, npm.
- Foundry VTT installed locally with a writable `Data` directory.

## Install dependencies
```bash
npm install
```

## Build commands
- `npm run build:release` — cleans and rebuilds `release/` with runtime-only files (assets, css, lang, module, generated pack DBs, templates, ui, pics, manifest, docs). Safe to run even if packs or SCSS sources are missing.
- `npm run build` — runs CSS + pack builds (writes CSS output and pack DBs).
- `npm run pack` — compiles compendium YAML from `packs/<pack-name>/` into `.packs-build/` (DB files). Skips if no pack folders exist.
- `npm run unpack` — extracts `.db` files from `.packs-build/` back into YAML under `packs/<pack-name>/` (overwrites existing pack folders).
- `npm run build:css` — builds `css/how-to-be-a-hero.css` from `src/scss/how-to-be-a-hero.scss`. Skips if the SCSS entrypoint is missing.
- `npm run watch` — watches SCSS; requires `src/scss/how-to-be-a-hero.scss` to exist.

## Recommended workflow for local Foundry testing
1) Build the release folder:
   ```bash
   npm run build:release
   ```
2) Symlink `release/` into your Foundry data `systems` directory (adjust the path if your Foundry data directory differs):
   ```powershell
   $dst = "$Env:LOCALAPPDATA\\FoundryVTT\\Data\\systems\\how-to-be-a-hero"
   cmd /c rmdir $dst 2>$null
   cmd /c mklink /D $dst "$(Resolve-Path release)"
   ```
   or on Unix:
   ```bash
   ln -sfn "$(pwd)/release" "$FOUNDRY_DATA/systems/how-to-be-a-hero"
   ```
3) Launch Foundry and load the system from the symlinked folder.

## Editing compendium content
- Source YAML lives under `packs/<pack-name>/`.
- Run `npm run pack` (or `build:release`) to regenerate `.packs-build/` and update the `release/` folder.
- To pull changes from DBs back to YAML (e.g., after editing in Foundry), run `npm run unpack` (writes to `packs/`).

## Notes
- The release folder intentionally excludes dev tooling; CI zips it for tagged releases, but locally it stays as a folder for symlinking.
- CSS steps skip without failing if the SCSS entrypoint is not present.
