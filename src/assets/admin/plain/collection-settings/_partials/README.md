# Catalog partials

A **partial** is a reusable cluster of settings (typography, button styling, image
filters, shadow, border) declared once and stamped into many catalog files via
a `use` node. Partials are expanded server-side by `Catalog_Partial_Expander`
during catalog load, *before* the assembler and the defaults layer run, so the
browser, the assembler, and `Collection_Defaults` all consume plain expanded
settings.

## Partial definition format

Each `_partials/<name>.json` declares:

- `partial` - the partial's id (must match the `use` value).
- `layout` - ordered list describing how fields render. Each entry is either:
  - a string - a single field id rendered as a top-level sibling, or
  - `{ "wrap": "side_by_side" | "setting_group", "fields": [ ... ] }` - a
    group wrapping the listed field ids.
- `field_defaults` (optional) - a map of attributes applied to every field as a
  base layer (below the per-field template). Use it to avoid repeating
  `type` / tier flags on every field. Merge order is
  `field_defaults` → field template → use-node `overrides` (later wins).
- `fields` - a map of field id → field template. A field template is a normal
  catalog setting minus its `key`, with these optional extra keys:
  - `label_template` - used when the `use` node passes a non-empty `label`
    param. `{{label}}` is replaced with that param.
  - `label_template_empty` - used when the `use` node passes no `label` (or an
    empty one), so labels read "Font Size" instead of " Font Size".
  - `default` - the cluster fallback default for this field (see resolution
    order below).

Any string value anywhere in a field (labels, condition `dependsOn`, option
values, …) may contain `{{token}}` placeholders. They are replaced from the
`use` node's `params` map after the field is built. Example: a shared
image-filter partial whose condition reads
`"dependsOn": "{{filter_type_key}}"` is stamped with
`"params": { "filter_type_key": "thumbnail_filter_type" }`.

## Using a partial in a catalog file

```json
{
	"use": "typography",
	"key_prefix": "caption_title_",
	"label": "Title",
	"condition": {
		"dependsOn": "caption_hide_title",
		"values": [false, "0"]
	},
	"overrides": {
		"font_size": {
			"responsive": {
				"desktop": { "min": 8, "max": 72, "default": 18 }
			}
		}
	}
}
```

`use` node keys:

- `use` (required) - partial id.
- `key_prefix` (required) - prepended to each field id to form the saved key
  (`key_prefix` + field id → `caption_title_font_family`).
- `label` (optional) - substituted into each field's `label_template`. Omit for
  the bare `label_template_empty` form.
- `params` (optional) - token map for `{{token}}` substitution across all string
  values in the expanded fields (see above).
- `condition` (optional) - propagated to every expanded field and group.
- `include` / `exclude` (optional, mutually exclusive) - restrict which fields
  expand. With neither, all fields expand in `layout` order. `include` keeps the
  partial's declared order regardless of the order listed.
- `overrides` (optional) - map of field id → partial-shallow-merged overrides
  applied to that field (labels, responsive ranges, defaults, …).

### Composite partials (button-styling)

`button-styling` composes other partials and a state-subtabs structure. Extra
`use` node keys it understands:

- `composed` - map of composed-partial id → overrides forwarded to that nested
  `use` (e.g. `composed.typography.overrides.font_size`).
- `states` - which state subtabs render, in order (e.g.
  `["regular", "hover", "open"]`).
- `state_meta` - per-state `{ infix, label, icon }` that **merges over** the
  partial's defaults. Use it to override an existing state (e.g. a custom
  `regular` icon) or define a new state the partial doesn't carry (e.g. a
  dropdown `open` state). Defining a state here means it does not have to live
  in the shared partial.
- `states_label` - overrides the state-subtabs container label (e.g.
  "Trigger States" instead of "Button States").
- `state_conditions` - per-state condition applied to that subtab wrapper.
- `colors` - which color fields each state includes (forwarded as the nested
  state partial's `include`).
- `key_map` - remaps a field id's emitted key **suffix** (e.g.
  `{ "color": "text" }` so the key is `<prefix>text`, matching a renderer that
  reads `_text`).

## Default resolution order

For any expanded key, the resolved default is computed once, lowest → highest:

1. partial field `default` (cluster fallback)
2. `use` node `overrides.<field>.default` (per-instance)
3. `Collection_Defaults` entry for the exact key, if present (authoritative;
   also owns the gallery/album split)

The cluster default and the PHP default are layers in one ordered merge, not
competing authorities - the PHP layer wins ties.
