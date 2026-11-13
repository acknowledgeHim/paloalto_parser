# Third-party: EmulatorJS (vendored, self-hosted)

The files under this `emulatorjs/` folder are **third-party software**, not part of the
Family Home Center proprietary codebase, and keep their own licenses. They are vendored here so
the classic-games feature runs entirely on the device — nothing is fetched from a CDN at play time.

- **EmulatorJS** — version **4.2.1**, GPL-3.0. https://github.com/EmulatorJS/EmulatorJS
  - `data/emulator.min.js`, `data/emulator.min.css`, `data/loader.js`, `data/compression/*`,
    `data/localization/*`.
- **Libretro cores** (the actual emulators), each under its own license:
  - `data/cores/fceumm-legacy-wasm.data` — **FCEUmm** (NES), GPL-2.0+. https://github.com/libretro/libretro-fceumm
  - `data/cores/snes9x-legacy-wasm.data` — **Snes9x** (SNES), Snes9x license (non-commercial).
    https://github.com/libretro/snes9x

## Local change

`data/emulator.min.js` has **one** change from upstream 4.2.1: `checkForUpdates()` is made a no-op
(an early `return;`), so the emulator never calls out to `cdn.emulatorjs.org` for a version check.
This keeps the feature fully self-hosted. No other upstream file is modified.

## Not vendored (intentionally trimmed)

The threaded (`-wasm.data`, non-legacy) cores are omitted: this app is served over plain HTTP with no
cross-origin isolation, so EmulatorJS always selects the `-legacy` cores. The unminified `data/src/`
tree and build tooling (`data/minify/`) are also omitted — only the minified runtime is shipped.

To update: download the matching `emulator.min.js` / `emulator.min.css` and the `*-legacy-wasm.data`
cores from the EmulatorJS 4.x release (or `https://cdn.emulatorjs.org/<version>/data/…`), re-apply the
one `checkForUpdates` change, and bump the version above.
