-- Non-destructive verification; run as the trusted database owner/operator.
-- Deliberate no-op UPDATEs must fail for both API roles. No rows are modified.
BEGIN;
DO $$
DECLARE
  target_table text;
  api_role text;
  privilege_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['documents', 'rule_sets', 'tool_context_bindings'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = target_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled for %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = target_table
    ) THEN
      RAISE EXCEPTION 'Unexpected direct-client policy for %', target_table;
    END IF;
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        RAISE EXCEPTION 'Cannot verify missing API role %', api_role;
      END IF;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(api_role, format('public.%I', target_table), privilege_name) THEN
          RAISE EXCEPTION 'Unexpected % privilege on % for %', privilege_name, target_table, api_role;
        END IF;
      END LOOP;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
        IF has_any_column_privilege(api_role, format('public.%I', target_table), privilege_name) THEN
          RAISE EXCEPTION 'Unexpected column % privilege on % for %', privilege_name, target_table, api_role;
        END IF;
      END LOOP;
      EXECUTE format('SET LOCAL ROLE %I', api_role);
      BEGIN
        EXECUTE format('UPDATE public.%I SET id = id WHERE false', target_table);
        RAISE EXCEPTION 'Direct write unexpectedly accepted on % for %', target_table, api_role;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL;
      END;
      RESET ROLE;
    END LOOP;
    -- Positive trusted-server read/write-permission probe; zero rows changed.
    EXECUTE format('SELECT id FROM public.%I LIMIT 1', target_table);
    EXECUTE format('UPDATE public.%I SET id = id WHERE false', target_table);
  END LOOP;
END $$;
ROLLBACK;
