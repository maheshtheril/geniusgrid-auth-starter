-- 01_auth_core_hardening.sql

-- 1) FKs (idempotent-ish: wrap in DO blocks to avoid duplicate constraint errors)
DO $$ BEGIN
  ALTER TABLE user_sessions
    ADD CONSTRAINT user_sessions_tenant_fk
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_sessions_user_fk
      FOREIGN KEY (user_id) REFERENCES res_users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE auth_tokens
    ADD CONSTRAINT auth_tokens_user_fk
      FOREIGN KEY (user_id) REFERENCES res_users(id) ON DELETE CASCADE,
    ADD CONSTRAINT auth_tokens_tenant_fk
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Assuming these tables exist; if your names differ, adjust accordingly.
DO $$ BEGIN
  ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_tenant_fk
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_roles_user_fk
      FOREIGN KEY (user_id) REFERENCES res_users(id) ON DELETE CASCADE,
    ADD CONSTRAINT user_roles_role_fk
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_role_fk
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    ADD CONSTRAINT role_permissions_permission_fk
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) RLS (Row-Level Security) per tenant for auth tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Use a session var strategy: app sets `app.tenant_id` each request
DO $$ BEGIN
  CREATE POLICY user_sessions_rls ON user_sessions
    USING  (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY auth_tokens_rls ON auth_tokens
    USING  (tenant_id = current_setting('app.tenant_id', true)::uuid OR tenant_id IS NULL)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid OR tenant_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY user_roles_rls ON user_roles
    USING  (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY role_permissions_rls ON role_permissions
    USING  (TRUE)  -- typically global; if tenant-scoped, adjust to include tenant_id
    WITH CHECK (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Operational indexes
CREATE INDEX IF NOT EXISTS user_sessions_tenant_user
  ON user_sessions (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_at
  ON user_sessions (expires_at);

CREATE INDEX IF NOT EXISTS auth_tokens_user_kind_active
  ON auth_tokens (user_id, kind, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_tokens_tenant_kind
  ON auth_tokens (tenant_id, kind);

-- 4) Guards / checks
-- (A) Token kind whitelist (use CHECK; or migrate to a dedicated ENUM later)
DO $$ BEGIN
  ALTER TABLE auth_tokens
    ADD CONSTRAINT auth_tokens_kind_chk
    CHECK (kind IN ('verify_email','reset_password','magic_link','invite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (B) Ensure expires_at is in the future on insert
-- NOTE: enforce at application layer for updates; DB check can be too strict for replays.
-- If you want a DB check, uncomment:
-- DO $$ BEGIN
--   ALTER TABLE auth_tokens
--     ADD CONSTRAINT auth_tokens_future_expiry_chk
--     CHECK (expires_at > now());
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (C) Basic sanity for stored hashes (lengthy enough; adjust threshold to your hash scheme)
DO $$ BEGIN
  ALTER TABLE user_sessions
    ADD CONSTRAINT user_sessions_hash_len_chk
    CHECK (length(session_token_hash) >= 32);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE auth_tokens
    ADD CONSTRAINT auth_tokens_hash_len_chk
    CHECK (length(token_hash) >= 32);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Timestamps/audit (optional)
ALTER TABLE IF EXISTS auth_tokens
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 6) Housekeeping helpers (optional)
-- You can schedule these via pg_cron / app jobs
-- DELETE FROM user_sessions WHERE expires_at < now();
-- DELETE FROM auth_tokens WHERE (used_at IS NOT NULL) OR (expires_at < now());
