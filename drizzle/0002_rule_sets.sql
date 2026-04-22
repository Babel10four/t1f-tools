-- CONFIG-001 / PLATFORM-DATA-001 — structured rule sets (jsonb payload)
CREATE TABLE IF NOT EXISTS rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('rates', 'calculator_assumptions', 'rural_rules')),
  version_label TEXT NOT NULL,
  effective_date DATE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  json_payload JSONB NOT NULL,
  source_document_id UUID REFERENCES documents (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by_role TEXT
);

CREATE INDEX IF NOT EXISTS rule_sets_rule_type_idx ON rule_sets (rule_type);
CREATE INDEX IF NOT EXISTS rule_sets_status_idx ON rule_sets (status);
CREATE INDEX IF NOT EXISTS rule_sets_series_id_idx ON rule_sets (series_id);
CREATE INDEX IF NOT EXISTS rule_sets_created_at_idx ON rule_sets (created_at DESC);

-- At most one published row per rule_type (CONFIG-001 resolution).
CREATE UNIQUE INDEX IF NOT EXISTS rule_sets_one_published_per_type
  ON rule_sets (rule_type)
  WHERE status = 'published';
