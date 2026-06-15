# Loading Icons

- **Source (editable):** `loading-icons.yaml` — multiline YAML, one key per icon. SVG strings already contain the `__FG_ID__` placeholder in every `id=` and in SMIL `begin=` / `url(#...)` references; the build does not inject them.
- **Runtime:** `loading-icons.json` — generated from the YAML source by the icons build (YAML → JSON only). Shipped to `dist` via webpack.

## Build

- The icons build runs as part of **`npm run build`** and **`npm run dev`** (before webpack). It reads `loading-icons.yaml` and writes `loading-icons.json`; no placeholder injection.
- Standalone: `npm run icons:build`.

## Unique IDs (no collision)

Replace `__FG_ID__` at render time so multiple loaders on the page get unique IDs:

- **PHP:** `\FotoGrids\Assets\Loading_Icon_Library::svg( 'spinner', uniqid( 'fg', true ) )`
- **React:** `getLoadingIconSvg( 'spinner', useId() )` (after `FotoGridsLoadingIcons` is loaded)
- **Vanilla JS:** `FotoGridsLoadingIcons.getLoadingIconSvg( 'spinner', FotoGridsLoadingIcons.randomId() )`

If you only ever show one loader at a time, you can omit the instance id.
