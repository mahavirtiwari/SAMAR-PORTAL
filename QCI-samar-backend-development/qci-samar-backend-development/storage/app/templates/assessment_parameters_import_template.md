# Assessment Parameters Bulk Import Template

## File Format
Excel (`.xlsx`, `.xls`) or CSV (`.csv`). Max 5MB.

A sample CSV is in this folder: `assessment_parameters_sample.csv`.

## Endpoint
`POST /api/v1/assessment-parameters/bulk-import` (multipart/form-data)

### Body fields
| Field | Required | Values |
|-------|----------|--------|
| `file` | Yes | The spreadsheet (xlsx/xls/csv) |
| `sector` | Yes | `manufacturing` or `service` |
| `enterprise_size` | Yes | `startup`, `micro`, `small`, `medium`, `large` |
| `service_provider_type` | If `sector=service` | `annual_maintenance_contract` or `critical_service_provider` |
| `vendor_category_id` | Yes | ID from `manufacturing_vendor_categories` (when manufacturing) or `service_vendor_categories` (when service) |

## Spreadsheet Columns
All columns are required. Header row is matched **by name** (case-insensitive, after trimming), so column order in the file does not matter — but the names must match exactly.

| Column | Type | Notes |
|--------|------|-------|
| `Discipline` | string | Auto-created if it does not exist |
| `Parameter Name` | string | Groups rows; one parameter spans multiple rows (one per question) |
| `Parameter Type` | enum | `Mandatory` or `Optional` |
| `Question Category` | enum | `Planning`, `Deployment`, or `Monitoring` |
| `Question Text` | string | Must be unique within a parameter |
| `Weightage (%)` | integer (1–100) | Sum across all questions of a parameter **must equal 100** |
| `Option 1 Text` | string | Score = 1 (lowest maturity) |
| `Option 2 Text` | string | Score = 2 |
| `Option 3 Text` | string | Score = 3 |
| `Option 4 Text` | string | Score = 4 |
| `Option 5 Text` | string | Score = 5 (highest maturity) |

## Grouping Rule
Multiple rows that share the same `Parameter Name` are grouped into one parameter. Every row for the same parameter must repeat the **same** `Discipline` and `Parameter Type` — mismatches are rejected (no silent overwrites).

## UPSERT Behaviour
- **Discipline**: matched by `name`. Auto-created if missing.
- **Parameter**: matched by (`name`, `sector`, `enterprise_size`, `service_provider_type`, `vendor_category_id`). Restored from soft-delete if previously trashed.
- **Question**: matched by (`question_text`, `parameter_id`). Restored from soft-delete if previously trashed.
- **Options**: hard-deleted and recreated on every import (scores 1–5 fixed by column order).

The whole import runs inside a single transaction — all-or-nothing.

## Response

### Success (200)
```json
{
  "success": true,
  "message": "Import completed successfully",
  "data": {
    "disciplines": { "created": 1, "existing": 2 },
    "parameters":  { "created": 3, "updated": 0 },
    "questions":   { "created": 8, "updated": 0 },
    "options":     { "created": 40 }
  }
}
```

### Validation failure (400)
```json
{
  "success": false,
  "message": "Import failed with validation errors",
  "errors": [
    {
      "row": 5,
      "parameter_name": "Quality Management System",
      "question_text": "Are quality objectives defined...",
      "errors": ["Weightage (%) must be between 1 and 100"]
    },
    {
      "row": "N/A",
      "parameter_name": "Process Capability Assessment",
      "errors": ["Weightage sums to 95%, must be 100%"]
    }
  ]
}
```

## Common Errors
- **Missing required columns** — header names must match exactly (case-insensitive).
- **Weightage (%) must be a whole number** — decimals are rejected; the DB column is `unsignedTinyInteger`.
- **Weightage sums to N%, must be 100%** — sum per parameter must be exactly 100.
- **Discipline / Parameter Type does not match the value set on row X** — repeat the same values on every row for the same parameter.
- **Duplicate question text within parameter** — two rows for the same parameter use the same `Question Text`.
- **Vendor category does not exist / does not match the service type** — `vendor_category_id` must belong to the table implied by `sector` (and match `type` for service).

## Authorization
Restricted to `system_admin` (handled by the controller / policy).

## cURL example
```bash
curl -X POST "http://localhost:8000/api/v1/assessment-parameters/bulk-import" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@assessment_parameters_sample.csv" \
  -F "sector=manufacturing" \
  -F "enterprise_size=medium" \
  -F "vendor_category_id=1"
```
