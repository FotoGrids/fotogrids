# shared

Code used across the whole plugin: the admin, visitor pages and, through the PHP mirror in `src/includes`, the server.

Each folder here is self-contained. It imports nothing from the rest of the plugin, which ESLint enforces, so it can be loaded on any surface and tested on its own. Code that needs plugin modules belongs next to the code that uses it, not here.

Import from the admin or frontend code through the `@shared` alias, for example `@shared/formatted-text`.

- `formatted-text` formats stored captions and descriptions as safe HTML or plain text. It also runs on visitor pages, so it imports no framework either.
- `text-editor` is the visual editor for captions and descriptions, built on `formatted-text`.
