# CONFIG-001 — v1 JSON payload shapes

All payloads require **`schemaVersion`: 1**.

## `rates`

```json
{
  "schemaVersion": 1,
  "rateTables": [
    {
      "id": "prime_based",
      "label": "Prime + margin",
      "rows": [{ "term": "12m", "rate": 9.25 }]
    }
  ]
}
```

## `calculator_assumptions`

```json
{
  "schemaVersion": 1,
  "assumptions": {
    "maxLtv": 75,
    "minFico": 620
  }
}
```

## `rural_rules`

```json
{
  "schemaVersion": 1,
  "rules": [
    { "id": "usda_eligible", "description": "USDA boundary", "threshold": 1 }
  ]
}
```

Validation is enforced server-side in `src/lib/rule-sets/validate-payload.ts`.
