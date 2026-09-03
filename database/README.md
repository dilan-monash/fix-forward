# Neon migration and least-privilege checklist

Use a Neon development branch, not the only production branch. Take screenshots with passwords and full connection strings hidden.

## 1. Rotate the exposed owner credential

The owner connection string was shared in conversation. Treat it as compromised. Reset/rotate that role's password in Neon before continuing, then remove it from terminal history, screenshots and documents where possible.

## 2. Run migrations

In the Neon SQL Editor, run these files in order:

1. `001_i1_recall_matching.sql`
2. `002_seed_verified_mistral_vacuum.sql`

Both scripts use transactions and conflict handling, so they can be run again without creating duplicate seed rows.

Verify:

```sql
SELECT COUNT(*) AS ui_categories FROM ui_appliance_categories;
SELECT COUNT(*) AS reviewed_products FROM recall_products WHERE manually_reviewed = true;
SELECT identifier_type, identifier_value, normalized_value
FROM recall_identifiers
ORDER BY identifier_type, identifier_value;
```

Expected initial values: 19 UI categories, at least 1 reviewed product, and two seeded model identifiers (`BVC160`, `BVC165`).

## 3. Create a separate application role with SQL

Do **not** use Neon's Console **Add role** button for this account. Neon grants Console-created roles membership in `neon_superuser`. For a limited application role, Neon documents that the role must be created with SQL and then granted only the required privileges.

Generate a unique strong password in a password manager and substitute it locally. Do not save or screenshot the query containing its password, and never copy it to Git, LeanKit or the PGP. Check first that the role name is unused:

```sql
SELECT rolname FROM pg_roles WHERE rolname = 'fixforward_app';
```

If no row is returned, run:

```sql
CREATE ROLE fixforward_app WITH LOGIN PASSWORD 'REPLACE_WITH_A_UNIQUE_RANDOM_SECRET';
ALTER ROLE fixforward_app SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE neondb TO fixforward_app;
GRANT USAGE ON SCHEMA public TO fixforward_app;
REVOKE CREATE ON SCHEMA public FROM fixforward_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fixforward_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO fixforward_app;
```

If the role already exists, stop and inspect its privileges instead of deleting or recreating it.

## 4. Prove least privilege

First verify the role has no administrative membership and only the required table access:

```sql
SELECT
    rolname,
    rolcreatedb,
    rolcreaterole,
    rolsuper,
    rolbypassrls,
    pg_has_role(rolname, 'neon_superuser', 'member') AS neon_superuser_member
FROM pg_roles
WHERE rolname = 'fixforward_app';

SELECT
    has_table_privilege('fixforward_app', 'public.recalls', 'SELECT') AS can_select,
    has_table_privilege('fixforward_app', 'public.recalls', 'INSERT') AS can_insert,
    has_table_privilege('fixforward_app', 'public.recalls', 'UPDATE') AS can_update,
    has_table_privilege('fixforward_app', 'public.recalls', 'DELETE') AS can_delete;
```

Expected: `can_select = true`; the administrative membership and three write permissions are `false`.

After obtaining its connection string, connect as `fixforward_app` and confirm both reads succeed:

```sql
SELECT COUNT(*) FROM recalls;
SELECT COUNT(*) FROM recall_products;
```

An attempted INSERT should fail because of permissions/read-only mode. Do not test a write against production; use only the development branch. If it succeeds, do not deploy that credential.

## 5. Configure the application

Copy the pooled Neon connection string for `fixforward_app` into the hosting provider's protected `DATABASE_URL` environment variable. Do not place it in `src/config.js`, `.env.example`, README, LeanKit or client-side code.

## 6. Connected checks

- `/api/health` returns 200 and `database: available`.
- `/api/recalls` returns only manually reviewed records.
- `/api/sources`, `/api/repair-evidence` and `/api/locations` return valid arrays.
- The Mistral/BVC 160 journey produces a strong possible match.
- Rice cooker with no model produces insufficient information.
- An intentionally invalid database URL produces generic HTTP 503 without leaking connection details.
