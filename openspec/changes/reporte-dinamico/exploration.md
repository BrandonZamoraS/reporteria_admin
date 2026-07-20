## Molecular Spec: Reporte Dinámico (Dynamic Report)

### Source Inputs
- **Issue/request**: Feature request — new report type "Reporte Dinámico" that creates a custom PDF with selected company, establishments, uploaded photos, and descriptions
- **Primary docs**: `current_schema.sql` (DB schema), `lib/reports/` (existing report patterns), `app/reportes/` (reports UI/route), `app/home/_components/sidebar-nav.tsx` (navigation)
- **Targeted code checked**: `app/reportes/page.tsx`, `app/reportes/_components/export-report-button.tsx`, `app/reportes/export/route.ts`, `lib/reports/presentation-report.ts`, `lib/reports/complete-report-pdf.ts`, `lib/reports/evidence-storage.ts`, `lib/reports/types.ts`, `lib/reports/export-core.ts`

### Intended Behavior

The "Reporte Dinámico" is a new report type accessible from the reports listing page (`/reportes`). Unlike existing reports that query `check_record` data, this report is a **custom composition tool**:

1. User selects a company (empresa) and optionally adds a description
2. User adds one or more store sections (tiendas/establecimientos) to the report
3. For each store added:
   - The establishment picker ONLY shows establishments that have products belonging to the selected company (via `products_establishment` + `product.company_id` join)
   - User uploads photos directly from their device (photos are NOT persisted to storage — only held in memory for the PDF)
   - User can add an optional description for that store
   - Multiple stores can be added with photos and descriptions
4. Final action: download a generated PDF containing all store sections with their photos and descriptions

**Key difference from existing reports**: This is NOT querying `check_record` data. It's a brand-new interactive form that collects data client-side and renders a custom PDF. Photos are ephemeral — never stored in Supabase Storage, only embedded in the PDF output.

### Capability / Domain

- **Module**: Reports (`app/reportes/`)
- **New sub-page**: `/reportes/reporte-dinamico` or `/reportes/dinamico`
- **Affects**: UI layer (new page + form + PDF generation)
- **No DB changes needed**: No new tables, no new columns, no storage buckets

### Acceptance Scenarios

**Scenario 1**: Basic report creation
- GIVEN an admin/editor user on the reports page
- WHEN they click "Reporte Dinámico" from the report list
- THEN they navigate to a new form page showing a company selector and an empty store list

**Scenario 2**: Company selection filters establishments
- GIVEN the user has selected a company
- WHEN they click "Agregar tienda"
- THEN the establishment dropdown ONLY shows establishments that have at least one product from the selected company (via `products_establishment` join with `product.company_id`)

**Scenario 3**: Add store with photos and description
- GIVEN the user selected a company and opened the add-store form
- WHEN they pick an establishment, upload 1+ photos, and type a description
- THEN the store section appears in the list with a thumbnail preview, establishment name, and description text

**Scenario 4**: Multiple stores
- GIVEN the user has added one store section
- WHEN they click "Agregar otra tienda"
- THEN they can repeat the process for another establishment
- And each store section is listed in order

**Scenario 5**: Download PDF
- GIVEN at least one store has been added with photos
- WHEN the user clicks "Descargar PDF"
- THEN a PDF is generated containing:
  - Cover page with report title, company name, description
  - One page or section per store with establishment name, optional description, and embedded photos
  - Photos are full-quality or appropriately compressed for PDF

**Scenario 6**: Photos are not persisted
- GIVEN the user has uploaded photos in the form
- WHEN the PDF is generated and the page is refreshed
- THEN no photos remain in any storage bucket — they were only held client-side during the session

**Scenario 7**: Optional description at report level
- GIVEN the user has typed a description in the top section
- WHEN the PDF is generated
- THEN the description appears on the cover/title section of the PDF

### Minimal Affected Areas

**New files to create**:
- `app/reportes/dinamico/page.tsx` — New page route, client component with the dynamic report form
- `lib/reports/dynamic-report-pdf.ts` — PDF generation function using pdfkit/sharp (following `presentation-report.ts` pattern)
- `app/reportes/dinamico/route.ts` — Route handler that receives form data and returns PDF (following `export/route.ts` pattern)

**Files to modify**:
- `lib/reports/types.ts` — Add `"dinamico"` to `REPORT_TYPES`, add `REPORT_DEFINITIONS` entry, update `reportsForRole()` if needed
- `app/reportes/page.tsx` — Pass dynamic report definition so it renders in the report list (or handle differently since it's a navigable page, not an export modal)
- `lib/reports/export-core.ts` — Add `"dinamico"` to `reportTitle()`, `pdfName()` if needed

**Files to check (may need minor updates)**:
- `app/reports/_components/export-report-button.tsx` — May need to handle `"dinamico"` type specially (or skip since it uses a full-page form, not a modal)
- `app/app-shell.tsx` — No changes needed; sidebar nav stays at `/reportes`, the new page is a sub-route

### Risks

1. **PDF memory pressure**: Photos are uploaded client-side and must be sent to the server for PDF generation. Large photos or many photos could exceed request size limits. Need a strategy: compress client-side before sending, or use a streaming/form-data approach.
2. **Implementation complexity**: This is the only report that requires a multi-step form with dynamic store sections. It does NOT fit the existing `ExportReportButton` modal pattern — it needs its own full-page interactive UI.
3. **Photo format/size**: Uploaded photos may be HEIC or other formats not supported by sharp. Need client-side conversion or rejection of unsupported formats.
4. **Route handler payload**: The existing export route uses GET with query params. This feature needs POST with multipart data (photos). A separate dedicated route handler is safer.
5. **No persistence = no recovery**: If the user accidentally navigates away, all entered data is lost. Consider a draft save mechanism (localStorage) as a future enhancement.

### Owner Questions

1. Should the "Reporte Dinámico" appear as a card in the existing report list (like all other reports), or as a separate navigation item? The behavior is different (full-page form vs. modal), so it likely needs its own entry that navigates to a sub-page.
2. PDF orientation preference: Should it be portrait (like the complete report) or landscape (like the presentation report)? Landscape is better for photo-heavy pages.
3. Photo count limit per store? The evidence table enforces 6 per `check_record` — but this report has no such constraint. Should we impose a limit?
4. Should `visitante` role have access to this report? By default they see: completo, presentacion, ajustes, productividad_empresa.

### Ready for Design

**Yes** — The discovery is sufficient to begin design. The core patterns (PDF generation with pdfkit/sharp, route handler architecture, Supabase query patterns) are well-established in the codebase. The main design decisions are around the form UI architecture and the photo upload/handling strategy (client-side compression, multipart POST to route handler).
