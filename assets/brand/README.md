# kelex brand assets

The mark reads left to right: a brace (`{`) goes in, an eye reads it, field rows come out.
Zod schema in, form out. Monoline in the fleet's house grammar, drawn in ASCII and cleaned
to SVG, named for a fictional AI like legion beside it.

## The marks

| File                  | What it is                               | Use                                            |
| --------------------- | ---------------------------------------- | ---------------------------------------------- |
| `kelex-mark.svg`      | Full mark, white on a black rounded tile | App icon, anywhere you want the tile           |
| `kelex-mark.dark.svg` | Full mark, transparent, `currentColor`   | On a page; inherits the surrounding text color |
| `kelex-in.svg`        | The brace &mdash; **schema in**          | Section icon; transparent `currentColor`       |
| `kelex-view.svg`      | The eye &mdash; **view**                 | Section icon; transparent `currentColor`       |
| `kelex-out.svg`       | The field rows &mdash; **export**        | Section icon; transparent `currentColor`       |

The three part-icons share the full mark's stroke language, so they line up in a row without
adjustment. They are the three product verbs: **schema in &rarr; view &rarr; export**.

### The 32px floor

The full mark narrates the whole pipeline, so it needs horizontal room. **It stops holding
below 32px** &mdash; the brace, eye, and fields smear together. That is why the favicon family
is not a shrunk full mark but the **eye alone** (`favicon/`), which is literally the center of
the full mark, so it reads as a true reduction rather than a different logo.

## Favicons and touch icons (`favicon/`)

Generated set, current best practice. Favicon family = the eye (holds tiny); touch/manifest
icons = the full mark (large enough to narrate).

| File                                                        | Size(s)      | Purpose                                                              |
| ----------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| `favicon.ico`                                               | 16 / 32 / 48 | Legacy browser tab, multi-res                                        |
| `favicon.svg`                                               | scalable     | Modern browser tab (the eye)                                         |
| `favicon-16x16.png` `favicon-32x32.png` `favicon-96x96.png` | as named     | Legacy / explicit PNG references                                     |
| `apple-touch-icon.png`                                      | 180          | iOS home screen; opaque, full-bleed, no self-rounding (iOS masks it) |
| `icon-192.png` `icon-512.png`                               | 192 / 512    | PWA / Android manifest, `purpose: any`                               |
| `icon-maskable-512.png`                                     | 512          | Android adaptive, `purpose: maskable` (mark inside the safe zone)    |
| `manifest.webmanifest`                                      | &mdash;      | References the 192/512 + maskable icons; theme/background `#000000`  |

### Drop into a site `<head>`

Paths assume the icons are served from the site root; adjust if they sit in a subpath.

```html
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

## Regenerating the favicon set

The PNG/ICO outputs are rasterized from the SVG sources; there is no committed build step
(these are static brand assets, regenerated only when the mark changes). To rebuild, rasterize
with any SVG renderer at the sizes in the table above and pack `favicon.ico` from the 16/32/48
eye PNGs. The reference recipe used `@resvg/resvg-js` for rendering and `png-to-ico` for the
container, run from a throwaway project &mdash; nothing to keep in the repo's dependencies.

- Favicon source: `favicon/favicon.svg` (the eye, black tile).
- Full-mark source: `kelex-mark.svg`.
- apple-touch is the full mark at ~78% on an opaque full-bleed black square (no rounding).
- maskable is the full mark at ~60% on an opaque full-bleed black square (safe zone).
