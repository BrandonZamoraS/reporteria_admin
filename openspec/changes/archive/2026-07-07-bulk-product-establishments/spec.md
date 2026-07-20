## Molecular Spec: Bulk product-to-establishment assignment in product edit

### Source Inputs
- Issue/request: Present, user wants to add one product to many establishments from the product edit screen, with name filter, multi-select checkboxes, and one final save.
- Primary docs: `openspec/config.yaml`, `current_schema.sql`, `app/productos/[productId]/editar/page.tsx`, `app/productos/actions.ts`, `app/productos/_components/product-form.tsx`, `app/establecimientos/actions.ts`, `app/establecimientos/[establishmentId]/editar/page.tsx`, `app/_components/searchable-combobox.tsx`, `app/_components/adaptive-select.tsx`.
- Targeted code checked: `app/productos` edit/create flow, existing establishment multi-select sync flow, and schema for `products_establishment`.

### Intended Behavior
The product edit screen SHALL include a bulk establishment selector that lets the user filter establishments by name, select multiple establishments with checkboxes, and save all links in one submit. The current product-establishment links MUST be preloaded as selected. On save, the backend SHOULD sync the join table so the saved selection is reflected in `products_establishment`.

### Capability / Domain
Product administration, specifically the product edit workflow and its many-to-many relationship with establishments.

### Acceptance Scenarios
- GIVEN a product with existing establishment links WHEN the edit page opens THEN those establishments appear preselected.
- GIVEN a long establishment list WHEN the user types a name filter THEN the list narrows without losing selected items.
- GIVEN multiple establishments selected WHEN the user saves THEN all selected links are persisted in one operation.
- GIVEN the user clears all selections WHEN the user saves THEN the final product-establishment set is updated accordingly.

### Minimal Affected Areas
- `app/productos/[productId]/editar/page.tsx` — load current establishments and pass them into the form.
- `app/productos/_components/product-form.tsx` — add an edit-only bulk establishment picker UI.
- `app/productos/actions.ts` — validate establishment IDs and sync `products_establishment` on update.
- `app/_components/*` or a new product picker component — reusable searchable multi-select UI if the form needs a dedicated control.

### Risks
- Large establishment lists can make filtering and rendering sluggish.
- Bulk sync can accidentally remove links if the save semantics are not explicit.
- RLS / permission checks on `products_establishment` must allow the same roles as the product edit flow.

### Owner Questions
- Should save behave as a full sync of the selected establishments, or only add new links and never remove existing ones?

### Ready for Design
No, one product decision is still needed: confirm whether the save operation is additive-only or a full replacement sync.
