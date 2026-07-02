-- Create the test database alongside the dev database.
--
-- PostgreSQL's official image runs every *.sql file in
-- `/docker-entrypoint-initdb.d/` once, on first boot, after the
-- POSTGRES_DB from the environment is created. This script
-- runs in that hook and creates the test DB. Pytest will use this
-- separate database so tests never touch real data.
--
-- The docker-compose.yml binds ./db/init as
-- /docker-entrypoint-initdb.d, so this file becomes
-- `00-create-test-db.sql` inside the container.

CREATE DATABASE toolsharing_test
    OWNER ics613user
    ENCODING 'UTF8';
