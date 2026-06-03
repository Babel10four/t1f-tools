-- INTEL-001 — Intelligence Layer (Firecrawl + GPT) permanent store.
-- Borrower snapshots, property dossiers, and competitor snapshots.

CREATE TABLE IF NOT EXISTS intel_borrower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_name TEXT NOT NULL,
  entity_name TEXT,
  website TEXT,
  snapshot JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intel_borrower_created_idx
  ON intel_borrower_snapshots (created_at DESC);
CREATE INDEX IF NOT EXISTS intel_borrower_name_idx
  ON intel_borrower_snapshots (borrower_name);

CREATE TABLE IF NOT EXISTS intel_property_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  dossier JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intel_property_created_idx
  ON intel_property_dossiers (created_at DESC);
CREATE INDEX IF NOT EXISTS intel_property_address_idx
  ON intel_property_dossiers (address);

CREATE TABLE IF NOT EXISTS intel_competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_markdown TEXT,
  parsed JSONB,
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS intel_competitor_captured_idx
  ON intel_competitor_snapshots (competitor, captured_at DESC);
