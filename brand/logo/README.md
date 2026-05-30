# SnagNest — Logo Assets

Canonical home for the SnagNest brand logo. Reference these by path from any
theme build, social profile, or doc — do **not** copy versioned duplicates
elsewhere. If the logo changes, change it here.

Brief / source prompt: `docs/superpowers/specs/2026-05-29-snagnest-store-design.md` §3.3

## Palette
- Icon terracotta: `#C9683E`
- Icon warm amber (star): `#E0A458`
- Wordmark charcoal: `#2B2622`
- Icon-tile cream: `#FBF4E7`

## Files (drop your saved PNGs here with these exact names)

| Filename | Variant | Use |
|----------|---------|-----|
| `snagnest-logo-horizontal.png` | Color icon + wordmark, **transparent** bg | Site header, light surfaces, email header. Save the largest/cleanest export. |
| `snagnest-icon-square.png` | Nest-tag-star icon in rounded square, **cream** bg | Favicon, social/app avatar, Shopify store icon |
| `snagnest-logo-mono.png` | Charcoal icon + wordmark, **transparent** bg | Dark-on-light surfaces, print, watermark, single-color contexts |

Optional extras worth keeping if you have them:
| `snagnest-icon.png` | Icon only, transparent bg | Compact header, OG image overlay |
| `snagnest-logo-horizontal.svg` | Vector | Crispest header rendering at any size |
| `favicon.ico` | 32×32 / 48×48 | Browser tab (generate from `snagnest-icon-square.png`) |

## How to save from ChatGPT
Right-click each generated image → "Save image as…" → navigate to this folder →
use the matching filename above. Keep PNG transparency intact (don't re-flatten).

## Where these get wired (once the theme is forked)
Per the theme-fork plan, the Shopify theme expects the header logo at
`assets/logo.png` (same convention as the Molly & Sophie theme). The build step
copies `snagnest-logo-horizontal.png` → theme `assets/logo.png` and sets the
square icon as the store favicon in theme settings.
