import type Stripe from "stripe";
import { config } from "../config.js";
import { catalogue, pricePackage } from "./package-pricing.js";

export type WardPackage = { name: string; site: string; serviceType?: string; plan: "essential" | "professional"; modules: string[] };
export type PackageSelection = { interval: "monthly" | "yearly"; enterprise: boolean; tablets: number; wards: WardPackage[] };

export function configuredPriceId(key: string, interval: string): string | undefined {
  if (key === "essential" || key === "professional" || key === "enterprise") {
    return config.stripePriceIds[key][interval as "monthly" | "yearly"];
  }
  return interval === "monthly" ? config.stripeExtraPriceIds[key] : config.stripeExtraYearlyPriceIds[key];
}

export async function checkoutLines(client: Stripe, selection: PackageSelection) {
  const quote = pricePackage(selection);
  const lineItems = await Promise.all(quote.lines.map(async (line: {key: string; label: string; unitAmount: number; inclusive: boolean; quantity: number}) => {
    const id = configuredPriceId(line.key, selection.interval);
    if (!id) throw new Error(`${line.label} is not yet available for online payment. Please contact SecureObs.`);
    const price = await client.prices.retrieve(id);
    if (!price.active || price.currency !== catalogue.currency || price.unit_amount !== line.unitAmount
      || price.recurring?.interval !== (selection.interval === "monthly" ? "month" : "year")
      || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed"
      || price.tax_behavior !== (line.inclusive ? "inclusive" : "exclusive")) {
      throw new Error(`The payment price for ${line.label} needs updating. Please contact SecureObs.`);
    }
    return {price: id, quantity: line.quantity};
  }));
  return { quote, lineItems };
}
