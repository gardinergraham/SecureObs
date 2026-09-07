import { catalogue, wardFeatures } from "./package-pricing.js";
import type { PackageSelection } from "./checkout.js";
export type OrderedItem = { key: string; price: string; quantity: number };
export type ActualItem = { price: string; quantity: number };

// Retain purchased features when unrelated items (such as tablet quantity)
// change. Removed items cannot continue granting features. Extra purchases are
// flagged for allocation, never assigned to an arbitrary ward.
export function reconcileFeatures(selection: PackageSelection, ordered: OrderedItem[], actual: ActualItem[]) {
  const quantities = new Map<string, number>();
  for (const line of ordered) quantities.set(line.key, actual.filter(item => item.price === line.price).reduce((total, item) => total + item.quantity, 0));
  const reviewRequired = ordered.length !== actual.length || ordered.some(line => !actual.some(item => item.price === line.price && item.quantity === line.quantity));
  function take(key: string) { const left = quantities.get(key) ?? 0; if (left > 0) quantities.set(key, left - 1); return left > 0; }
  const enterprisePaid = selection.enterprise && take('enterprise');
  const features = selection.wards.map(ward => {
    const features = wardFeatures(ward, selection.enterprise) as Record<string, boolean>;
    const basePaid = selection.enterprise ? enterprisePaid : take(ward.plan);
    if (!basePaid) for (const key of Object.keys(features)) features[key] = false;
    else if (!selection.enterprise && ward.plan === 'essential') {
      for (const module of catalogue.modules) if (features[module.id]) features[module.id] = take(module.id);
    }
    return features;
  });
  return {features, reviewRequired};
}
