# Theme Package Development

SeanBlog themes are directory-based packages. They are not standalone React or Node.js code, and they are not single CSS files. A theme package is declarative: SeanBlog reads the manifest, templates, parts, settings schema, CSS, and static assets, then renders them through built-in safe components.

## Package structure

```text
theme-slug/
  theme.json
  templates/
    home.json
    article-list.json
    article-detail.json
    taxonomy.json
    search.json
  parts/
    header.json
    footer.json
  assets/
    theme.css
    preview.svg
```

## Manifest

`theme.json` must be at the package root.

Required fields:

- `slug`: lowercase letters, numbers, hyphens, or underscores; must match the directory name after install.
- `name`: display name shown in the admin theme library.
- `version`: package version.
- `engine`: must be `seanblog-theme`.
- `engineVersion`: currently `1`.
- `templates`: must include `home`, `articleDetail`, `taxonomy`, and `search`.

Optional fields:

- `author`
- `description`
- `previewImage`
- `assets.css`
- `parts`
- `settingsSchema`
- `blocks`

## Templates and parts

Templates and parts are JSON metadata files. The current engine validates their presence and uses the built-in App Router pages and component slots. Future renderer phases will map these JSON definitions to a stricter block tree.

Supported block names for theme declarations:

- `SiteHeader`
- `ArticleList`
- `ArticleCard`
- `ArticleContent`
- `TaxonomyList`
- `Pagination`
- `SearchDialog`
- `CommentList`
- `SiteFooter`

Theme packages must not ship executable server code. Uploading arbitrary React, JavaScript, TypeScript, or Node.js modules for execution is intentionally unsupported.

## CSS rules

Theme CSS lives under `assets/theme.css` by convention. It can:

- define supported CSS variables on `:root`
- define styles for safe component selectors: `.sb-*`, `.sf-*`, and `.article-content`
- use relative `url(...)` references to files inside the same package; these are rewritten to the theme asset API

It cannot:

- use `@import`
- use `!important`
- reference absolute, remote, data, or parent-directory URLs
- include `<style>` or HTML-like content
- target arbitrary global selectors outside the safe namespaces

## Settings schema

`settingsSchema` lets a theme expose editable settings in `/admin/personalization`.

Supported field types:

- `text`
- `color`
- `number`
- `boolean`
- `select`

A setting can optionally declare `cssVariable`; when present, SeanBlog writes the saved value into a `:root` CSS variable override for the active theme.

Example:

```json
{
  "key": "accentColor",
  "label": "Accent color",
  "type": "color",
  "default": "#2563eb",
  "cssVariable": "--color-accent"
}
```

## Import and export

Admin theme import accepts a `.zip` package with `theme.json` at the zip root. The server validates:

- zip structure and file count
- zip-slip/path traversal attempts
- manifest schema and theme engine version
- required templates
- CSS safety rules
- package size

Installed themes can be exported back to `.zip` from the theme library.

## Default theme

`themes/seanblog-default/` is the built-in default theme package. It follows the same package rules as third-party themes and is not deletable or overwritable from the admin UI.

Visual direction:

- content-first, minimal, native components
- Inter typography
- black/white/gray hierarchy
- blue accent
- clear borders and soft radius
- low-distraction hover/focus states
- mobile-first responsive layout
