# Watermark fonts

The text watermark is burned into images server-side (GD / Imagick), which
requires a real `.ttf` file on disk at processing time - a CSS font name is not
enough because no browser is involved.

These fonts back the **Plugin Settings → Watermark → Font family** dropdown.
Each font key in `Watermark_Settings_Store::FONTS` maps to one filename here.
`Watermark_Settings_Store::font_path()` resolves a key to its absolute path.

## Required files

Drop the **Regular** weight of each face here, named exactly as below:

All faces are shipped as static **SemiBold (weight 600)** instances - bolder
than Regular so the watermark reads clearly over busy image areas.

| Font key           | Filename                       | Family           | Licence |
| ------------------ | ------------------------------ | ---------------- | ------- |
| `inter`            | `Inter-SemiBold.ttf`           | Sans (default)   | SIL OFL |
| `roboto`           | `Roboto-SemiBold.ttf`          | Sans             | SIL OFL |
| `open-sans`        | `OpenSans-SemiBold.ttf`        | Sans (humanist)  | SIL OFL |
| `montserrat`       | `Montserrat-SemiBold.ttf`      | Sans (geometric) | SIL OFL |
| `oswald`           | `Oswald-SemiBold.ttf`          | Sans (condensed) | SIL OFL |
| `lora`             | `Lora-SemiBold.ttf`            | Serif            | SIL OFL |
| `playfair-display` | `PlayfairDisplay-SemiBold.ttf` | Serif (display)  | SIL OFL |
| `merriweather`     | `Merriweather-SemiBold.ttf`    | Serif            | SIL OFL |
| `jetbrains-mono`   | `JetBrainsMono-SemiBold.ttf`   | Monospace        | SIL OFL |
| `dancing-script`   | `DancingScript-SemiBold.ttf`   | Script           | SIL OFL |

All faces are SIL OFL - redistributable under the plugin's GPL licence and
acceptable for WordPress.org. Ship each font's licence file (e.g. `OFL.txt`)
alongside the `.ttf` in this directory.

## Source

Static SemiBold (weight 600) instances generated from the upstream variable
fonts on Google Fonts (<https://fonts.google.com>) via `fonttools varLib.instancer`.

> Adding or removing a font means updating `Watermark_Settings_Store::FONTS`
> and the `FONTS` list in `WatermarkTab.jsx` so the registry and the dropdown
> stay in sync.
