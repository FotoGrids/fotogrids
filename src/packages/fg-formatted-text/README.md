# fg-formatted-text

Formats stored captions and descriptions as safe HTML or plain text. It has no dependencies and runs on visitor pages, in the admin and in tests.

The PHP twin lives in `src/includes/formatted-text/`. Both read `schema.json` and both run the shared cases in `fixtures/format.json`, so the two can't drift.

## Schema

`schema.json` holds named profiles. `item_text` is the one used for captions and descriptions:

- `elements`: allowed elements and their attributes. An attribute has a `type`: `url`, `text`, `enum` (one of `values`) or `tokens` (any of `values`, space separated).
- `protocols`: URL schemes allowed in `url` attributes.
- `breakBefore`: elements that become a line break.
- `dropWithContent`: elements removed together with their content.

The `floor` section is applied after every change to a profile, including the `fotogrids/formatted_text/schema` filter, and can't be configured: it bans scripts, frames, forms, event handlers, `style`, `class`, `id`, `data-*`, `aria-*` and unsafe URL schemes.

## API

```ts
toHtml( raw, profile?, options? ): string
toPlainText( raw, profile? ): string          // "\n" for line breaks
normalize( raw, profile?, mode? ): { html, lossy }
render( element, raw, profile?, options? ): void
parse( raw, profile, options? ): { nodes, lossy }
validateProfile( raw ): Profile
bundledProfile( name? ): Profile
```

Options:

| Option | Meaning |
|---|---|
| `mode` | `basic` keeps allowed formatting; `plain` keeps text only |
| `links` | `false` shows links as their text |
| `policy` | `{ newTab, rel }` for links that carry no `target` or `rel` of their own |
| `newTabLabel` | Screen-reader text added to links that open in a new tab |
| `maxLength` | Cut after this many visible characters and add `…` |
| `tidy` | `false` keeps leading and trailing space and every line break; used by editors while the user types. JavaScript only |

`lossy` is true when the output dropped something from the input: an element, an attribute or a value.

`render()` builds DOM nodes one by one with `replaceChildren()`; it never assigns markup to an element.

## On visitor pages

`src/public/render/formatted-text/formatted-text.js` wraps this package as `FotoGrids.modules.formattedText` with `render( element, raw, { surface, field, links, itemId, galleryEl } )` and `toPlainText( raw )`, and dispatches `fotogrids:formatted_text:rendered` after each render.
