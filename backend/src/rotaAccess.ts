import { pool } from "./db/pool.js";
// Preserve historical rota rows, but do not accept new or edited Home Care assignments.
export async function isHomeCareRotaLocation(organisationId: string, wardId: string): Promise<boolean> {
 const result = await pool.query(`select w.service_type from wards w join sites s on s.id=w.site_id where w.id=$1 and s.organisation_id=$2`, [wardId,organisationId]);
 return result.rows[0]?.service_type === "Home care";
}
