# Q_Generator — document layout

Templates are **separate stylesheets** (not baked into `styles.css`):

| File | Role |
|------|------|
| `templates/classic.css` | Classic: logo left, document type & refs right; 3px accent rule |
| `templates/executive.css` | Executive: full accent header, white “identity card” for logo/company, light type on field |
| `templates/minimal.css` | Minimal: centered header, hairlines, pill ref/dates, card-style meta blocks |

`index.html` loads `styles.css` then each `templates/*.css`. **Deploy** the `templates/` folder with the app (same relative paths as locally).

`#docPage` carries `tpl-classic` | `tpl-executive` | `tpl-minimal` (via `applyTemplate` / **Template** in Document layout). Shared markup: `#docHeader` → `.doc-header-brand` → `.doc-logo-area` … and `.doc-header-docinfo` → `.doc-title-block` → `.doc-doc-type` + `.doc-title-meta` (ref + dates).

When changing layout, overflow, or table chrome: verify multi-page overflow and PDF export.
