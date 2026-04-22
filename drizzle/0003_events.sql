-- ANALYTICS-001 / PLATFORM-DATA-001 — append-only platform events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  tool_key TEXT,
  role TEXT NOT NULL,
  session_id TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS events_tool_created_idx ON events (tool_key, created_at DESC);
CREATE INDEX IF NOT EXISTS events_event_type_created_idx ON events (event_type, created_at DESC);
