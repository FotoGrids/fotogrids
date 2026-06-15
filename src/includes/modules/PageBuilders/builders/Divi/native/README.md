# FotoGrids — Native Divi 5 modules

Native Divi 5 (D5) modules for FotoGrids Gallery and Album. Unlike the
legacy `ET_Builder_Module` path (removed), these are real Divi 5 modules:
no "Legacy" badge, native Visual Builder editing.

## What's here

```
native/
├── src/                      # Visual Builder source (TypeScript/TSX)
│   ├── index.ts              # registerModule wiring (divi.moduleLibrary…)
│   ├── module-icons.ts       # icon-library registration
│   ├── icons/                # gallery + album panel icons
│   └── components/
│       ├── gallery/          # edit.tsx, module.json, types.ts, styles, scss
│       └── album/            # same, for albums
├── build/bundle.js           # compiled VB bundle (committed)
├── styles/{bundle,vb-bundle}.css
├── modules-json/{gallery,album}/module.json   # copied from src at build
└── php/                      # front-end render side (committed, no build)
    ├── class-gallery-module.php   # DependencyInterface + render_callback
    ├── class-album-module.php
    └── class-collection-options.php   # populates the native select
```

This package has **no build files of its own** — no `webpack.config.js`,
`tsconfig.json`, or `package.json`. The VB bundle is built by the plugin's
own webpack as a second config in the array exported from the plugin root
`webpack.config.js` (the `divi-native` config).

## How it works

- **VB side**: `src/index.ts` calls `registerModule()` (from
  `@divi/module-library`) on the `divi.moduleLibrary.registerModuleLibraryStore.after`
  action. Each module's `edit.tsx` renders a live server-side preview by
  fetching FotoGrids' existing `/fotogrids/v1/preview/{kind}/{id}` REST
  endpoint — identical output to the Gutenberg LivePreview.
- **PHP side**: each module class implements Divi 5's `DependencyInterface`
  and registers its block via `ModuleRegistration::register_module()`. The
  `render_callback` resolves the picked ID and delegates to
  `Public_Render::gallery_shortcode()` / `album_shortcode()` stamped
  `Request_Source::DIVI`, so every decorator/feature/layout works unchanged.
- **Picker**: a native `divi/select` field, its options injected
  server-side at registration by `Collection_Options` (lists published +
  private collections). The PickerModal-as-a-field is NOT used — Divi 5.6.2
  has no supported third-party custom-field API (verified); the select is
  the supported path.

Boot + asset registration lives in the parent `../Module.php`
(`register_native_modules`, `register_vb_package`).

## Rebuilding the VB bundle

There is **no separate build step**. The bundle is built as part of the
plugin's normal build, from the plugin root (`Plugin/`):

```bash
npm run dev      # watch: rebuilds the VB bundle on every src/ change
npm run build    # one-shot production build
```

Both invoke webpack with a two-config array (`main` + `divi-native`) from
the plugin's `webpack.config.js`. The `divi-native` config:

- entry `native/src/index.ts` → `native/build/bundle.js`
- extracts `module.scss` → `native/styles/bundle.css`, duplicated as
  `vb-bundle.css` (the runtime enqueues a separate VB stylesheet handle;
  the two are identical today — split into `style.scss` (VB) +
  `module.scss` (front end) if they ever diverge)
- copies each component's `module.json` → `native/modules-json/<name>/`

The `main` config declares `dependencies: ['divi-native']`, so it builds
after the native bundle and its CopyWebpackPlugin pattern ships
`native/{build,styles,modules-json}` into `dist/`.

`@divi/*` runtime packages, React, and `@wordpress/{i18n,hooks}` are webpack
**externals** — resolved off the `divi` / `vendor` globals Divi enqueues in
the builder. Because they're never bundled, the `@divi/*` type packages
aren't needed to build; ts-loader runs `transpileOnly`. Only our `edit`
components + `registerModule` wiring ship in the bundle.
