import pg from "pg";

import { config } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});
