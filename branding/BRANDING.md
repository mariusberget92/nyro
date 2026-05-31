# Nyro — Brand assets

The Nyro mark is one geometric glyph that reads three ways:

- the **N** monogram (left post · diagonal · right post)
- a **download arrow** — the right post resolves into a downward arrowhead (the core action)
- the **`_` terminal cursor** — the baseline tray echoes the `〉_ nyro` prompt (the dev-tool cue)

## Palette

| Token        | Hex        | Use                    |
|--------------|------------|------------------------|
| Nyro Blue    | `#3D7FFF`  | gradient start, accent |
| Nyro Violet  | `#7C5CFF`  | gradient end           |
| Graphite     | `#0E131B`  | dark surface / icon bg |
| Ice          | `#E7ECF3`  | text on dark           |

Brand gradient: `linear-gradient(150deg, #3D7FFF, #7C5CFF)`.

## Files

```
branding/
├── nyro-mark.svg          gradient glyph (primary)
├── nyro-mark-white.svg    mono, for dark backgrounds
├── nyro-mark-ink.svg      mono, for light backgrounds
├── nyro-icon.svg          squircle app icon (gradient bg + white mark)
├── nyro-banner.png        README header (880×300)  ·  @2x version included
└── icons/
    └── nyro-{16…1024}.png  pre-rendered app-icon PNGs
```

## Wiring the icons into the build

`electron-builder` picks up a 512×512+ PNG or a generated `.ico` / `.icns`:

```jsonc
// package.json → "build"
"win":   { "icon": "branding/icons/nyro-512.png" },
"mac":   { "icon": "branding/icons/nyro-1024.png" },
"linux": { "icon": "branding/icons" }
```

To make platform containers from the PNGs:

```bash
# macOS .icns
npx png2icns branding/nyro.icns branding/icons/nyro-1024.png

# Windows .ico (needs imagemagick)
magick branding/icons/nyro-16.png branding/icons/nyro-32.png \
       branding/icons/nyro-48.png branding/icons/nyro-256.png branding/nyro.ico
```

The favicon / small sizes hold down to 16px — the mark was tuned to stay legible there.
