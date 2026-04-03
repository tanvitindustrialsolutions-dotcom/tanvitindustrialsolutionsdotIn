# Q_Generator — document layout

The app uses a **single Classic** document layout (no `tpl-*` classes on `#docPage`).

When changing **preview layout**, **overflow/annexure**, **items table**, **header/footer**, or **CSS** under `.doc-page` / `.doc-table-*`:

1. **Verify** on a doc with enough line items to stress the layout (and with annexure if relevant).
2. **Annexure pages** use `.doc-page.doc-annexure-page` (flex), same stacking rules as the main page.
3. **JS height checks** (`checkPageOverflow`, `contentH`) must treat **`.doc-table-section`** correctly: use `scrollHeight` vs `getBoundingClientRect().height` when the flex band clips the table.
