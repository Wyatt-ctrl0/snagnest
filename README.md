# SnagNest

A curated Shopify storefront for trending, problem-solving finds with a cozy "nest" feel. Custom Shopify theme built on a hand-tuned Liquid foundation, with a warm cream-and-terracotta palette and Fraunces / Nunito type.

## What's in here

| Path | Description |
|------|-------------|
| `theme/` | The deployable Shopify theme (sections, snippets, templates, layout, locales, assets, config). |
| `brand/` | Brand artwork: logo lockups, icon, and favicons. |
| `preview/` | Static HTML preview of the storefront (home, product, collection, and supporting pages) for local viewing. |

## Theme structure

The theme follows the standard Shopify Online Store 2.0 layout:

- `theme/layout/` — `theme.liquid` shell
- `theme/sections/` — page sections
- `theme/snippets/` — reusable components (header, footer, product cards, cart, forms, icons)
- `theme/templates/` — JSON templates for each page type
- `theme/config/` — `settings_schema.json` and `settings_data.json`
- `theme/locales/` — translation strings
- `theme/assets/` — CSS, JS, images

## Local preview

The `preview/` folder is a self-contained static mirror of the storefront. Serve it with any static server:

```bash
cd preview
python -m http.server 8742
```

Then open http://localhost:8742.

## Deploying the theme

Use the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) from the `theme/` directory:

```bash
cd theme
shopify theme dev      # local development against a store
shopify theme push     # upload to a store (creates an unpublished theme by default)
```

## Brand

The brand mark is a terracotta line-art bird in a nest with a price tag and star. See `brand/logo/README.md` for usage. Do not redraw or recolor the mark; use the supplied artwork.

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| base | `#FBF4E7` | cream background |
| surface | `#F3E9D6` | sand surfaces |
| accent | `#C9683E` | terracotta |
| accent-soft | `#E0A458` | amber |
| text | `#2B2622` | charcoal |
