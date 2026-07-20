# Design: Product Photos

## Technical Approach

Add a single optional photo per product, stored in a new **public** Supabase Storage bucket `product-photos`. The photo URL is persisted in a new `photo_url text` column on `public.product`. Uploads go through server actions using the service-role admin client (same pattern as `app/registros/actions.ts`). Display uses `next/image` — already configured with `**.supabase.co` and `**.supabase.in` remote patterns, so no `next.config.ts` change is needed.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Bucket visibility | Public vs Private+signed URLs | **Public** | Product photos are not sensitive. Public URLs avoid signed-url latency on list/detail pages. Simpler, cacheable. Owner confirmed. |
| Photos per product | Single vs Gallery | **Single** | User request: "una foto". Owner confirmed. |
| Storage client | Anon (user) vs Service-role (admin) | **Service-role** | Matches existing evidence upload pattern (`createStorageAdminClient()` in `registros/actions.ts`). Server actions already authorize via `getAuthorizedProductClient()`. RLS on bucket is defense-in-depth only. |
| URL storage | Full URL vs Relative path | **Full public URL** | `${SUPABASE_URL}/storage/v1/object/public/product-photos/products/{productId}/{uuid}.{ext}`. Simpler reads, no URL construction on every display. Matches evidence pattern. |
| File path convention | Flat vs Nested | **`products/{productId}/{uuid}.{ext}`** | Matches evidence pattern (`records/{recordId}/{uuid}.{ext}`). Groups files per product for easy cleanup. UUID prevents collisions and path injection. |
| Create flow with photo | Pre-generate ID vs Insert-then-update | **Insert product → upload photo → update photo_url** | Avoids pre-generating IDs. Two-step is acceptable because server action is atomic from the user's perspective. If upload fails, product is created without photo (acceptable — user can retry). |
| Thumbnail in list | None vs Column vs First column | **First column (small thumbnail)** | Owner confirmed. Fits existing grid layout. Adds visual scanning value. |

## Data Flow

### Upload (Create)
```
Form (multipart/form-data)
  → createProductAction(formData)
    → validate role (admin/editor)
    → validate file (type, size) on server
    → INSERT product (photo_url = null) → get product_id
    → IF file present:
        → generate path: products/{productId}/{uuid}.{ext}
        → upload via service-role client to 'product-photos' bucket
        → build public URL
        → UPDATE product SET photo_url = public URL
    → revalidatePath + redirect
```

### Upload (Update / Replace)
```
Form (multipart/form-data)
  → updateProductAction(formData)
    → validate role + file
    → IF file present:
        → fetch current product.photo_url
        → upload new file (new UUID path)
        → IF old photo exists: delete old storage object
        → UPDATE product SET photo_url = new URL
    → ELSE: update product fields only
    → revalidatePath + redirect
```

### Delete Product
```
deleteProductAction(formData)
  → validate role (admin only)
  → fetch product.photo_url
  → IF photo_url exists: delete storage object
  → DELETE product from DB
  → revalidatePath + redirect
```

### Display
```
Product Detail Page (server component)
  → SELECT product with photo_url
  → <Image src={photo_url} /> or <ProductPhotoPlaceholder />

Product List (server component)
  → SELECT products with photo_url
  → render thumbnail in first grid column
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/NNNNNNNNNNNN_product_photos.sql` | Create | Add `photo_url` column, create `product-photos` public bucket, add RLS policies |
| `app/productos/actions.ts` | Modify | Add `uploadProductPhoto()`, `removeProductPhoto()`, `extractStoragePathFromUrl()` helpers. Integrate into `createProductAction`, `updateProductAction`, `deleteProductAction` |
| `app/productos/_components/product-form.tsx` | Modify | Add file input with client-side validation + preview. Show current photo in edit mode. Extend `Product` type with `photo_url` |
| `app/productos/[productId]/page.tsx` | Create | Product detail page — displays product info + photo (or placeholder) |
| `app/productos/[productId]/editar/page.tsx` | Modify | Fetch `photo_url` and pass to `ProductForm` |
| `app/productos/page.tsx` | Modify | Add thumbnail column in product list grid |
| `app/productos/_components/product-photo-placeholder.tsx` | Create | Reusable placeholder component for missing photos |

## Interfaces / Contracts

### Database Migration
```sql
-- 1. Add column
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Create public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-photos', 'product-photos', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies (defense-in-depth; server actions use service-role key)
-- SELECT: public (anyone can view product photos)
-- INSERT/UPDATE/DELETE: authenticated admin/editor only
```

### Server Action Helpers (in `actions.ts`)
```typescript
const PRODUCT_PHOTO_BUCKET = "product-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Upload a photo file for a product. Returns public URL or null if no file.
async function uploadProductPhoto(
  supabase: SupabaseClient, // service-role
  productId: number,
  file: File
): Promise<{ url: string; error?: string }>;

// Delete a storage object by extracting path from its public URL.
async function removeProductPhotoByUrl(
  photoUrl: string
): Promise<boolean>;

// Extract storage path from a public URL.
function extractStoragePathFromUrl(photoUrl: string): string | null;
```

### ProductForm Props Extension
```typescript
type Product = {
  product_id: number;
  sku: string;
  name: string;
  company_id: number;
  is_active: boolean;
  photo_url?: string | null; // NEW
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| E2E (Playwright) | Upload photo in create flow | Navigate to `/productos/nueva`, fill form, select image file, submit, verify redirect and photo on detail page |
| E2E | Upload photo in edit flow | Navigate to `/productos/{id}/editar`, verify current photo shown, upload new photo, verify old replaced |
| E2E | Photo in product list | Navigate to `/productos`, verify thumbnail visible for products with photo |
| E2E | Delete product with photo | Delete a product that has a photo, verify no broken state |
| E2E | Invalid file rejection | Try uploading a `.txt` file or >5MB file, verify error message shown |
| E2E | Placeholder display | View a product without photo, verify placeholder shown (no broken image) |

## Implementation Handoff

### Execution Order

1. **Migration** — create `supabase/migrations/NNNNNNNNNNNN_product_photos.sql`
2. **Server actions** — add upload/delete helpers + integrate into CRUD in `app/productos/actions.ts`
3. **Form component** — add file input + preview in `app/productos/_components/product-form.tsx`
4. **Edit page** — fetch `photo_url` in `app/productos/[productId]/editar/page.tsx`
5. **Detail page** — create `app/productos/[productId]/page.tsx`
6. **List page** — add thumbnail column in `app/productos/page.tsx`
7. **Placeholder component** — create `app/productos/_components/product-photo-placeholder.tsx`

### Apply Slices

| Slice | Goal | Files to Read/Edit | Acceptance | Verification |
|-------|------|--------------------|------------|--------------|
| 1 | Migration: column + bucket + RLS | `supabase/migrations/NNNNNNNNNNNN_product_photos.sql` | Migration runs without error; bucket visible in Supabase dashboard | `supabase db push` or run SQL in dashboard |
| 2 | Server action helpers + CRUD integration | `app/productos/actions.ts`, reference `app/registros/actions.ts` | Create product with photo → `photo_url` populated in DB. Edit → old photo deleted, new saved. Delete → photo cleaned up. | Manual test via form, check DB + Storage |
| 3 | Form file input + preview | `app/productos/_components/product-form.tsx`, `app/productos/[productId]/editar/page.tsx` | File input accepts images only, shows preview, validates size client-side. Edit mode shows current photo. | Manual test in browser |
| 4 | Product detail page | `app/productos/[productId]/page.tsx` (new), `app/productos/_components/product-photo-placeholder.tsx` (new) | Detail page shows product info + photo. Missing photo → placeholder. | Navigate to `/productos/{id}` |
| 5 | Thumbnail in product list | `app/productos/page.tsx` | Thumbnail appears in first column of product grid. Missing photo → placeholder. | Navigate to `/productos` |

### Constraints for Apply

- Follow existing code style: Tailwind utility classes, `[var(--border)]` CSS vars, `text-[13px]` sizing, `rounded-[8px]`/`rounded-[12px]` corners.
- Use service-role admin client for storage (same as `createStorageAdminClient()` in `registros/actions.ts`). Do NOT use anon key for uploads.
- Keep all storage operations server-side. Never expose service-role key to client.
- File input must use `accept="image/jpeg,image/png,image/webp"` for UX, but server MUST re-validate type and size.
- UUID filenames only — never use user-provided filenames in storage paths.
- Product detail page must be accessible to all authenticated roles (admin, editor, visitante) — check `requireRole` usage.

## Migration / Rollout

No data migration required. New column is nullable — existing products will have `photo_url = null` and display the placeholder. Bucket creation is idempotent (`ON CONFLICT DO NOTHING`).

## Open Questions

None — all decisions confirmed by owner.
