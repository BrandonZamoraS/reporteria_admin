## Molecular Spec: Product Photos

### Source Inputs
- Issue/request: Present — "añadir foto a productos desde el editor/creador y que se muestre al abrir el producto"
- Primary docs: `current_schema.sql` (product table), `supabase/migrations/20260206063050_profile_photo_bucket_private.sql` (existing storage pattern), `app/productos/` (all product pages and components)
- Targeted code checked: `app/registros/actions.ts` (evidence upload pattern), `lib/reports/evidence-storage.ts` (existing storage utilities), `app/productos/actions.ts` (product CRUD), `app/productos/_components/product-form.tsx` (form component)

### Intended Behavior
- Admin and editor roles can upload a single photo per product from the product editor (edit mode) and creator (new mode)
- The photo is displayed when viewing a product's detail page
- Products without a photo show a graceful placeholder (no broken image)
- When a product photo is replaced, the old photo is deleted from storage
- When a product is deleted, its photo is deleted from storage

### Capability / Domain
- **Product module**: editor page (`[productId]/editar/page.tsx`), creator page (`nueva/page.tsx`), and detail view (new `[productId]/page.tsx`)
- **Supabase Storage**: new public bucket `product-photos`
- **Database**: `public.product` table — add `photo_url` column

### Acceptance Scenarios
- GIVEN an admin is on the product editor WHEN they upload a JPG/PNG/WEBP photo under 5MB THEN the photo is saved to Supabase Storage, the product's `photo_url` is updated, and the photo is visible on the product detail page
- GIVEN an editor is on the product creator WHEN they fill all required fields and upload a photo THEN the product is created with the photo associated
- GIVEN a user views a product detail page WHEN the product has a photo THEN the photo is displayed using `next/image`
- GIVEN a user views a product detail page WHEN the product has no photo THEN a placeholder or no-image fallback is shown
- GIVEN an admin replaces a product photo WHEN they upload a new one THEN the old photo is deleted from storage and the new one is saved
- GIVEN an admin deletes a product WHEN the product had a photo THEN the photo is also deleted from storage
- GIVEN a user uploads a file that is not an image OR exceeds 5MB THEN an error message is shown and no photo is saved

### Minimal Affected Areas
- `supabase/migrations/NNNNNNNNNNNN_product_photos.sql` — new migration: add `photo_url text` to `product`, create `product-photos` bucket with RLS policies
- `app/productos/actions.ts` — add photo upload/delete logic in `createProductAction` and `updateProductAction`; add photo cleanup in `deleteProductAction`
- `app/productos/_components/product-form.tsx` — add file input for photo upload, show current photo preview in edit mode
- `app/productos/nueva/page.tsx` — pass photo-related data if needed (minimal change)
- `app/productos/[productId]/page.tsx` — **new file**: product detail view that displays product info and photo
- `app/productos/[productId]/editar/page.tsx` — load current photo URL for edit form
- `app/productos/page.tsx` — optionally show a photo thumbnail in the product list (nice-to-have, not required for this spec)
- `lib/supabase/` — no new utilities needed; existing `createSupabaseServerClient` and `createSupabaseBrowserClient` suffice. Use `supabase.storage.from('product-photos')` directly.

### Detailed Approach

#### Storage: Public Bucket
- **Bucket name**: `product-photos`
- **Visibility**: **public** (not signed URLs). Product photos are not sensitive, and public URLs avoid signed-url latency on list/detail pages. Simpler to implement and cache.
- **File size limit**: 5MB (matching `profile-photos`)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`
- **Path convention**: `products/{product_id}/{uuid}.{ext}`

#### RLS Policies on `product-photos` bucket
- `product_photos_select_public` — SELECT for authenticated users (any authenticated user can view)
- `product_photos_insert_admin_editor` — INSERT for admin/editor roles
- `product_photos_update_admin_editor` — UPDATE for admin/editor roles
- `product_photos_delete_admin_editor` — DELETE for admin/editor roles
- Uses `current_user_role()` function (already exists in schema)

#### Database
- Add column: `ALTER TABLE public.product ADD COLUMN photo_url text;`
- Store the full public URL: `${supabaseUrl}/storage/v1/object/public/product-photos/products/{productId}/{uuid}.{ext}`

#### Upload Flow (Server Action)
1. Validate role (admin/editor) — already in `getAuthorizedProductClient()`
2. Validate file type (startsWith `image/`) and size (≤5MB)
3. Generate path: `products/{productId}/{uuid}.{ext}`
4. Upload via `supabase.storage.from('product-photos').upload(path, file, { contentType, upsert: false })`
5. Build public URL: `${supabaseUrl}/storage/v1/object/public/product-photos/${path}`
6. If product already has a `photo_url`, extract old path and delete old object
7. Update `product.photo_url` in DB

#### Photo Display
- Product detail page uses `<Image>` from `next/image` with the public URL
- Configure `remotePatterns` in `next.config.ts` to allow the Supabase storage hostname
- Show placeholder when `photo_url` is null

### Risks
- **Old photo orphaned on replace/delete**: MUST clean up storage objects when photo is replaced (in update) and when product is deleted (in delete). Add a `removeStorageObject` helper to avoid duplicated cleanup logic.
- **File size validation on client + server**: File size must be validated client-side (UX) AND server-side (security). Server action already has access to `file.size`.
- **next/image remotePatterns config**: Must add Supabase storage URL to `remotePatterns` in `next.config.ts`, otherwise images won't load.
- **UUID file names**: Prevent filename collisions and path-injection attacks. Use `crypto.randomUUID()` for the filename, not the user's original filename.

### Owner Questions
- Should the product list page (`/productos`) show a small photo thumbnail in each row? (Not required by the request but adds UX value.)
- Single photo per product is assumed from "una foto" — confirm this is correct.
- Is a public bucket acceptable, or do you prefer private bucket with signed URLs for security? (Public is simpler and performant; product photos are not sensitive.)

### Ready for Design
Yes — all decisions documented above. Tell the user to confirm the public bucket choice and single-photo assumption, then proceed to design.
