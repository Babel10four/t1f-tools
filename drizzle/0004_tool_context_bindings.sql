-- CONTENT-002 / PLATFORM-DATA-001 — published tool context bindings (resolver authority)
CREATE TABLE IF NOT EXISTS tool_context_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_key TEXT NOT NULL,
  binding_type TEXT NOT NULL CHECK (binding_type IN (
    'credit_policy_document',
    'rural_policy_document',
    'rates_rule_set',
    'calculator_assumptions_rule_set',
    'rural_rules_rule_set'
  )),
  document_id UUID REFERENCES documents (id) ON DELETE RESTRICT,
  rule_set_id UUID REFERENCES rule_sets (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  superseded_by_binding_id UUID REFERENCES tool_context_bindings (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_role TEXT,
  CONSTRAINT tool_context_bindings_one_target CHECK (
    (document_id IS NOT NULL AND rule_set_id IS NULL) OR
    (document_id IS NULL AND rule_set_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tool_context_bindings_tool_key_idx ON tool_context_bindings (tool_key);
CREATE INDEX IF NOT EXISTS tool_context_bindings_status_idx ON tool_context_bindings (status);

-- At most one published row per (tool_key, binding_type).
CREATE UNIQUE INDEX IF NOT EXISTS tool_context_bindings_one_published_per_slot
  ON tool_context_bindings (tool_key, binding_type)
  WHERE status = 'published';
