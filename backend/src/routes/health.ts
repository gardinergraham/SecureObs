import { Router } from "express";

import { pool } from "../db/pool.js";

const router = Router();

router.get("/", (_request, response) => {
  response.json({ ok: true, service: "secureobs-backend" });
});

router.get("/db", async (_request, response) => {
  try {
    const ping = await pool.query("select now() as checked_at");
    const staffTable = await pool.query("select to_regclass('public.staff_members') as table_name");

    if (!staffTable.rows[0]?.table_name) {
      response.status(503).json({
        ok: false,
        database: "connected",
        migrations: "missing",
        checkedAt: ping.rows[0]?.checked_at
      });
      return;
    }

    const staffCount = await pool.query("select count(*)::int as count from staff_members");

    response.json({
      ok: true,
      database: "connected",
      migrations: "ready",
      staffCount: staffCount.rows[0]?.count ?? 0,
      checkedAt: ping.rows[0]?.checked_at
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    response.status(503).json({
      ok: false,
      database: "unavailable",
      error: message
    });
  }
});

export { router as healthRouter };
