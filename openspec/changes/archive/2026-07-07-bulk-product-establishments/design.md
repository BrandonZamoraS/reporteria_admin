# Design: Bulk product establishments

## Technical Approach

Add an edit-only establishment assignment section to the product edit flow. The page stays a Server Component and loads: product, companies, establishment options, and current `products_establishment` rows in one `Promise.all`. `ProductForm` remains a client component and receives the hydrated option list plus preselected establishment IDs. Saving continues through `updateProductAction`, which will validate the submitted IDs and fully sync `products_establishment` for the edited product.

RSC/client boundary: `app/productos/[productId]/editar/page.tsx` performs all initial reads server-side. `app/productos/_components/product-form.tsx` and the new picker component remain client-side for search, checkbox interaction, and pending UI. Protected-route/auth implication: the route already gates with `requireRole(["admin", "editor"])`, and the server action re-checks auth/role through `getAuthorizedProductClient()`, so no proxy/auth expansion is required.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Use server-side hydration for current assignments and establishment options | Client fetch after mount | Matches existing App Router pattern, avoids waterfall/loading flicker, guarantees preselected state on first render. |
| Add a product-specific checkbox picker component | Reuse `SearchableCombobox` or build a generic multi-select now | The request needs visible multi-select checkboxes plus search. A local component is the smallest reviewable change under the review budget. |
| Mirror establishment sync logic with a `syncProductEstablishments` helper | Direct delete-all/insert-all | Diff-based sync reuses proven semantics from `app/establecimientos/actions.ts`, avoids unnecessary writes, and still delivers full replacement behavior. |

## Data Flow

`EditProductPage` → Supabase reads (`product`, `company`, `establishment`, current `products_establishment`) → `ProductForm`
→ local search + selected ID state → hidden `establishmentIds` inputs → `updateProductAction`
→ validate submitted IDs → `syncProductEstablishments`
→ update join table → `revalidatePath` + redirect.

Initial selection is derived from current join rows by `product_id`. Filtering only affects the visible list, never the selected ID state.

## File Changes

| File | Action | Description |
|---|---|---|
| `app/productos/[productId]/editar/page.tsx` | Modify | Load establishment options and current assignments, normalize props for the form. |
| `app/productos/_components/product-form.tsx` | Modify | Accept establishment props, render edit-only assignment section, submit hidden `establishmentIds`. |
| `app/productos/_components/product-establishments-picker.tsx` | Create | Local client component with search input, checkbox list, selected count, and empty states. |
| `app/productos/actions.ts` | Modify | Parse establishment IDs, validate existence, sync `products_establishment`, revalidate affected paths. |
| `tests/modules/productos-editor.spec.ts` | Modify | Add focused edit-flow assertions for editor. |
| `tests/modules/productos-admin.spec.ts` | Modify | Add focused edit-flow assertions for admin. |

## Interfaces / Contracts

```ts
type EstablishmentOption = {
  establishment_id: number;
  name: string;
  route_name: string | null;
  is_active: boolean;
};

type ProductFormProps = {
  // existing props...
  establishmentOptions?: EstablishmentOption[];
  initialSelectedEstablishmentIds?: number[];
};
```

Server action contract:
- `formData.getAll("establishmentIds")` is parsed as unique positive integers.
- Submitted IDs MUST all exist in `establishment`.
- Saved IDs become the full final set for `products_establishment(product_id=...)`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | ID parsing/dedup and diff calculation if extracted | Keep helper pure inside `app/productos/actions.ts`; test only if extraction is needed during apply. |
| Integration | Product update + join-table sync semantics | Covered indirectly by server-action path in Playwright because repo test stack is Playwright-only. |
| E2E | Preselected assignments, search filtering, replace-all save, admin/editor access | Extend `tests/modules/productos-admin.spec.ts` and `tests/modules/productos-editor.spec.ts` with one focused edit scenario each. |

## Implementation Handoff

### Execution Order

1. Update `app/productos/[productId]/editar/page.tsx` to load and normalize establishment data.
2. Add `app/productos/_components/product-establishments-picker.tsx` and wire it into `app/productos/_components/product-form.tsx`.
3. Extend `app/productos/actions.ts` with parse/validate/sync logic, then add focused Playwright coverage.

### Apply Slices

| Slice | Goal | Files to Read/Edit | Acceptance | Verification |
|---|---|---|---|---|
| 1 | Hydrate edit form with available + selected establishments | `app/productos/[productId]/editar/page.tsx`, `app/productos/_components/product-form.tsx` | Edit page renders current assignments as selected | `npm run lint` |
| 2 | Add searchable checkbox picker with stable selected state | `app/productos/_components/product-form.tsx`, `app/productos/_components/product-establishments-picker.tsx` | Filtering by name does not clear selections; empty states are visible | `npm run lint` |
| 3 | Persist full replacement sync and cover main flow | `app/productos/actions.ts`, `tests/modules/productos-admin.spec.ts`, `tests/modules/productos-editor.spec.ts` | Saving replaces final set in `products_establishment` and keeps role access intact | `npm run test:productos` |

### Constraints for Apply

- Preserve the current App Router split: server reads in page, interactive state in client components.
- Follow the existing hidden-input submission pattern used in `app/establecimientos/_components/establishment-form.tsx`.
- Do not broaden this change into create-product assignment or generic shared multi-select refactors.

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None.
