# Design: Reporte Dinámico

## Technical Approach

A new full-page interactive form at `/reportes/dinamico` where admin users compose a custom PDF by selecting a company, adding store sections (each with establishment picker filtered by company products, photo uploads, and optional description), then downloading the generated PDF. Photos are ephemeral — compressed client-side, sent via multipart POST, embedded in PDF, never persisted.

The report appears as a card in the existing `/reportes` list, but its "Generar" button navigates to the form page instead of opening the shared `ExportReportButton` modal.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Form pattern | Single-page client component with local state (no multi-step router) | Next.js multi-step with URL segments, server actions per step | Simpler, no URL state needed. Form data is ephemeral — losing it on refresh is acceptable per spec. |
| Photo compression | Client-side via `<canvas>` + `toBlob()` (JPEG, quality 0.7, max 1200px width) | Server-side sharp compression, browser-image-compression library | Zero new dependencies. Canvas API is sufficient for JPEG compression. Matches sharp pipeline downstream. |
| Photo transport | FormData POST to dedicated route handler | Base64 in JSON, WebSocket streaming | FormData is the standard for multipart file uploads. Route handler returns PDF binary directly. |
| Establishment filtering | Dedicated GET API route `/reportes/dinamico/establecimientos?companyId=X` | Server action, inline in page | API route allows client-side fetching when company changes. Server action would require re-rendering the page. |
| PDF generation | New `lib/reports/dynamic-report-pdf.ts` using pdfkit + sharp | Reuse presentation-report.ts, use react-pdf | Follows existing pattern. Presentation report has different data shape (record-based vs store-section-based). |
| Dynamic report in list | Special-case in `page.tsx`: render as card with `<Link>` instead of `ExportReportButton` | Add to REPORT_TYPES + modify ExportReportButton | Cleaner than polluting the modal component with navigation logic. Keeps existing reports untouched. |
| Role access | `requireRole(["admin"])` on page + route handler | Add to reportsForRole() | Owner decision: admin only. Don't add to REPORT_TYPES/roles system since it's not a standard export. |

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  /reportes/dinamico (Client Component)                  │
│                                                         │
│  1. Select company                                      │
│  2. GET /reportes/dinamico/establecimientos?companyId=X │
│     ──→ Returns establishments with products for company│
│  3. Add store sections (establishment + photos + desc)  │
│     ──→ Photos compressed via canvas to JPEG blobs      │
│  4. Click "Descargar PDF"                               │
│     ──→ Build FormData: metadata + photo File objects   │
│     ──→ POST /reportes/dinamico                         │
│                                                         │
└───────────────────────┬─────────────────────────────────┘
                        │ FormData (multipart)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  POST /reportes/dinamico (Route Handler)                │
│                                                         │
│  1. Auth check (admin role)                             │
│  2. Parse FormData: companyId, description, sections[]  │
│  3. For each section: parse establishmentId, desc,      │
│     read photo buffers                                  │
│  4. sharp: rotate + resize each photo buffer            │
│  5. pdfkit: generate landscape A4 PDF                   │
│     - Cover page (company, description, date)           │
│     - One section per store (name, desc, photo grid)    │
│  6. Return PDF buffer as application/pdf                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/reportes/dinamico/page.tsx` | Create | Client component — full-page form with company selector, store sections, PDF download |
| `app/reportes/dinamico/route.ts` | Create | POST route handler — receives FormData, generates PDF, returns binary |
| `app/reportes/dinamico/establecimientos/route.ts` | Create | GET route handler — returns establishments filtered by company's products |
| `lib/reports/dynamic-report-pdf.ts` | Create | PDF generation with pdfkit/sharp — cover + store sections with photo grids |
| `lib/reports/dynamic-report-types.ts` | Create | Type definitions for dynamic report data structures |
| `app/reportes/page.tsx` | Modify | Add conditional rendering for "dinamico" card: `<Link>` instead of `ExportReportButton` |

## Interfaces / Contracts

### Dynamic Report Types (`lib/reports/dynamic-report-types.ts`)

```typescript
export type DynamicReportSection = {
  establishmentId: number;
  establishmentName: string;
  description: string;
  photoCount: number;
};

export type DynamicReportPayload = {
  companyId: number;
  companyName: string;
  description: string;
  sections: DynamicReportSection[];
};

// FormData field names for POST /reportes/dinamico
// "companyId"       → string (number)
// "companyName"     → string
// "description"     → string
// "sectionCount"    → string (number)
// "section.{i}.establishmentId"   → string
// "section.{i}.establishmentName" → string
// "section.{i}.description"       → string
// "section.{i}.photo.{j}"         → File (JPEG blob)
```

### GET /reportes/dinamico/establecimientos

```
Query: ?companyId=<number>
Response: { establishments: Array<{ id: number; name: string }> }
```

Query pattern (from existing codebase):
```sql
SELECT DISTINCT e.establishment_id, e.name
FROM establishment e
JOIN products_establishment pe ON pe.establishment_id = e.establishment_id
JOIN product p ON p.product_id = pe.product_id
WHERE p.company_id = $companyId
  AND p.is_active = true
  AND e.is_active = true
ORDER BY e.name
```

Implemented via Supabase client:
1. Fetch product IDs where `company_id = X AND is_active = true`
2. Fetch `products_establishment` rows for those product IDs
3. Fetch establishments by those IDs where `is_active = true`

### POST /reportes/dinamico

```
Content-Type: multipart/form-data
Body: FormData with fields per contract above
Response: Content-Type: application/pdf, Content-Disposition: attachment
Error: 400 (validation), 401 (auth), 403 (role)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `dynamic-report-pdf.ts` — PDF buffer generation with mock photo buffers | Call `buildDynamicReportPdf()` with stub data, verify Buffer output is non-empty and starts with `%PDF` |
| Unit | Photo compression utility — canvas mock | Verify output is JPEG, dimensions capped, quality reduced |
| Integration | Route handler receives FormData, returns PDF | Use Next.js test client or manual `fetch` with constructed FormData |
| E2E | Full flow: navigate → select company → add store → upload photo → download PDF | Playwright test with file chooser mock |

## Implementation Handoff

### Execution Order

1. Create types file (`lib/reports/dynamic-report-types.ts`)
2. Create establishment filter API route (`app/reportes/dinamico/establecimientos/route.ts`)
3. Create PDF generator (`lib/reports/dynamic-report-pdf.ts`)
4. Create POST route handler (`app/reportes/dinamico/route.ts`)
5. Create form page (`app/reportes/dinamico/page.tsx`)
6. Modify reports list page (`app/reportes/page.tsx`) to render dynamic report card

### Apply Slices

| Slice | Goal | Files | Acceptance | Verification |
|-------|------|-------|------------|--------------|
| 1 | Types + establishment API | `lib/reports/dynamic-report-types.ts`, `app/reportes/dinamico/establecimientos/route.ts` | GET returns filtered establishments for a companyId | `curl /reportes/dinamico/establecimientos?companyId=1` returns JSON array |
| 2 | PDF generator | `lib/reports/dynamic-report-pdf.ts` | Produces valid PDF buffer from section data + photo buffers | Unit test: buffer starts with `%PDF`, length > 0 |
| 3 | POST route handler | `app/reportes/dinamico/route.ts` | Accepts FormData, returns PDF binary | `curl -X POST` with FormData returns PDF content-type |
| 4 | Form page | `app/reportes/dinamico/page.tsx` | Full interactive form: company select → add stores → upload photos → download | Manual: navigate to `/reportes/dinamico`, complete flow, verify PDF downloads |
| 5 | Reports list integration | `app/reportes/page.tsx` | "Reporte Dinámico" card appears for admin, links to `/reportes/dinamico` | Visual: card renders in list, button navigates (not modal) |

### Constraints for Apply

- Do NOT add "dinamico" to `REPORT_TYPES` or `reportsForRole()` — it's a special case, not a standard export
- Do NOT modify `ExportReportButton` — the dynamic report uses navigation, not modal
- Follow existing brand colors from `export/route.ts` BRAND constant for PDF styling
- Photo compression must happen client-side BEFORE adding to FormData
- Route handler must validate admin role independently (don't trust client)
- Max 6 photos per store section (matching evidence limit)
- PDF layout: landscape A4, following `presentation-report.ts` margins and grid patterns

## Migration / Rollout

No migration required. No database changes. Feature is additive — new routes and page only.

## Open Questions

- None. All owner questions resolved (UI pattern, orientation, photo limit, access role).
