# FotoGrids (Free) — Developer Guide

FotoGrids is a modern WordPress gallery and slider plugin built around the
WordPress Media Library. This repository holds the **Free** plugin. The Pro
plugin lives in a sibling repository and extends Free purely through WordPress
hooks — it never imports Free's classes directly.

This README covers local development of the Free plugin. For the full
architecture reference (PHP bootstrap, database layer, the render pipeline,
the Free↔Pro contract, REST conventions), see `CLAUDE.md` in the repository
root.

## Requirements

| Tool      | Version           |
| --------- | ----------------- |
| PHP       | 8.0+              |
| WordPress | 6.1+ (tested 6.8) |
| Node.js   | 18+               |
| npm       | 8+                |

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` builds the loading-icon assets, then runs the YAML watcher and
`webpack --watch` together. Webpack writes a complete, installable plugin into
`dist/`. Point your local WordPress install at that folder (or use the zip
tasks below) to test.

## Project layout

```
Plugin/
├── src/                  Source — edit here
│   ├── fotogrids.php      Main plugin file (bootstrap, constants, hooks)
│   ├── config/           Module registry, loading-icon catalogues
│   ├── includes/         PHP classes (REST, settings, modules, tools, render helpers)
│   ├── assets/           React/TS admin UI, SCSS, plain-JS entrypoints
│   ├── public/           Frontend render pipeline + shortcodes/blocks
│   ├── languages/        Translations
│   └── tests/            Jest unit + integration tests
├── tests/                PHP integration tests + CI guard scripts
├── scripts/              Build helpers (loading icons, JSON↔YAML)
├── dist/                 Build output — generated, never edited, git-ignored
├── webpack.config.js     Build configuration
├── package.json
└── CLAUDE.md             Full developer/architecture reference
```

The build output in `dist/` is produced entirely by webpack (including the
`CopyWebpackPlugin` step that copies the PHP source). Do not hand-assemble it.

## Scripts

### Build

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Watch build (development): icons + YAML + webpack |
| `npm run build`       | Production build (icons + webpack, minified)      |
| `npm run build:dev`   | One-shot development build (no watch)             |
| `npm run clean`       | Remove `dist/`                                    |
| `npm run icons:build` | Rebuild the loading-icon assets                   |

### Package / release

| Command            | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `npm run zip:dev`  | Development build, zipped to `fotogrids-dev.zip`       |
| `npm run zip:prod` | Production build, zipped to `fotogrids-v<version>.zip` |
| `npm run release`  | `clean` + `build` + `zip:prod`                         |

### Quality

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `npm run lint`       | ESLint over `src/assets`          |
| `npm run lint:fix`   | ESLint with autofix               |
| `npm run format`     | Prettier over assets and Markdown |
| `npm run type-check` | `tsc --noEmit`                    |

### Tests

| Command                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `npm test`              | Jest (JS/TS)                                        |
| `npm run test:watch`    | Jest in watch mode                                  |
| `npm run test:coverage` | Jest with coverage                                  |
| `npm run test:ci`       | Render guards + PHP integration tests + Jest CI run |

The Jest suite lives in `src/tests/`. The root `tests/` directory holds
self-contained PHP integration tests (run with the `php` binary, no PHPUnit
required) and the CI guard scripts under `tests/ci/`. Both are wired into
`npm run test:ci`.

### Internationalisation

| Command                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `npm run i18n:makepot` | Generate `src/languages/fotogrids.pot` (needs WP-CLI) |

## Architecture at a glance

- **Backend**: PHP 8.0+, explicit `require_once` bootstrap (no autoloader or
  service container), custom database tables, REST API under `fotogrids/v1`.
- **Admin UI**: React 18 (mostly `.jsx`, some `.tsx`) using
  `@wordpress/components`, mounted into PHP-rendered containers. No SPA router,
  no Tailwind, no shadcn.
- **Frontend**: vanilla ES6+ (no jQuery, no React). Galleries and albums are
  rendered by a modular pipeline under `src/public/render/`; per-gallery JS
  behaviour attaches via the `window.FotoGrids` runtime.
- **Free ↔ Pro**: Pro detects Free via the `FOTOGRIDS_VERSION` constant and
  extends it through filters and actions only.

See `CLAUDE.md` for the authoritative detail on all of the above, including the
render pipeline stages, the `data-fg-*` attribute convention, and the list of
extension hooks.

## License

GPL-2.0-or-later.
