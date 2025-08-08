-- 00_auth_core.sql

-- UUID extension (if not already)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Uniques
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_code ON tenants(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_res_users_tenant_email ON res_users(tenant_id, email);

-- Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_token_hash text NOT NULL UNIQUE,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Auth tokens (verify/reset/magic)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  user_id uuid NOT NULL,
  kind varchar(32) NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

-- Helpful unique guards
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles ON user_roles(tenant_id, user_id, role_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_perm ON role_permissions(role_id, permission_id);
