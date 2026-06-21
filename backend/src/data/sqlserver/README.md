SQL Server repositories will live here when NHS SQL support is added.

The API routes should not import SQL Server clients directly. They should call the repository interfaces in
`../types.ts`, and `provider.ts` should select the SQL Server implementations when `DATA_PROVIDER=sqlserver`.
