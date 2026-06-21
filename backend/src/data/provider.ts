import { config } from "../config.js";
import { postgresStaffRepository } from "./postgres/staffRepository.js";
import type { DataProvider } from "./types.js";

export function createDataProvider(): DataProvider {
  if (config.dataProvider === "postgres") {
    return {
      staff: postgresStaffRepository
    };
  }

  throw new Error(`DATA_PROVIDER ${config.dataProvider} is not implemented yet`);
}

export const dataProvider = createDataProvider();
