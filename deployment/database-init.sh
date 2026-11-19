#!/bin/sh

psql --no-psqlrc --no-password --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 <<'SQL'
\getenv migration_password POSTGRES_MIGRATION_PASSWORD
\getenv app_password POSTGRES_APP_PASSWORD

BEGIN;

CREATE ROLE elat_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migration_password';
CREATE ROLE elat_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

REVOKE ALL ON DATABASE elat FROM PUBLIC;
GRANT CONNECT ON DATABASE elat TO elat_migrator, elat_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO elat_migrator;
GRANT USAGE ON SCHEMA public TO elat_app;

COMMIT;
SQL
