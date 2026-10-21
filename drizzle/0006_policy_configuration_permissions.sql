-- Policy configuration is server-only, not a Supabase Data API resource.
-- App roles (user/admin) are signed app sessions, NOT Supabase Auth roles.
-- Admin route handlers enforce role === "admin"; calculator reads use the
-- trusted server DATABASE_URL. Do not add an authenticated-wide write policy.
-- No business data, owner/service-role privileges, or credentials are changed.
BEGIN;

-- Fail closed if a future installation has policies requiring separate review.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('documents', 'rule_sets', 'tool_context_bindings')
  ) THEN
    RAISE EXCEPTION 'Review existing policy-configuration RLS policies before applying this migration';
  END IF;
END $$;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_context_bindings ENABLE ROW LEVEL SECURITY;

-- No RLS policies intentionally: deny direct client access. Table owners and
-- trusted BYPASSRLS roles retain their existing server/maintenance access.
REVOKE ALL PRIVILEGES ON TABLE public.documents, public.rule_sets,
  public.tool_context_bindings FROM PUBLIC;

-- Plain local Postgres need not contain Supabase's API roles.
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.documents, public.rule_sets, public.tool_context_bindings FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
