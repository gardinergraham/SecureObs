SQL Server repositories will live here when NHS SQL support is added.

The API routes should not import SQL Server clients directly. They should call the repository interfaces in
`../types.ts`, and `provider.ts` should select the SQL Server implementations when `DATA_PROVIDER=sqlserver`.

SQL Server migration scripts live in `backend/sqlserver-migrations`. They mirror the current Postgres schema using
T-SQL types and JSON text columns where Postgres currently uses arrays. Once the `mssql` driver is added, the SQL
Server provider should run those scripts through the same `schema_migrations` table pattern used by Postgres.
