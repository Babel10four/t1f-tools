-- CONTENT-001 / PLATFORM-DATA-001 — documents metadata (PDF bytes in object storage)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  version_label TEXT NOT NULL,
  effective_date DATE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  byte_size BIGINT,
  original_filename TEXT,
  extracted_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by_role TEXT
);

CREATE INDEX IF NOT EXISTS documents_series_id_idx ON documents (series_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents (created_at DESC);
