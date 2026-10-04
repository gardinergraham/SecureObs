import { pricePackage } from '../billing/package-pricing.js';
export const SHOW_TERMS_VERSION = 'care-show-2026-10-04-v1';
export function showQuote(input: unknown) {
  const regular = pricePackage(input);
  if (regular.selection.tablets > regular.selection.wards.length * 2) throw new Error('The show offer includes up to two tablets per ward. Contact us for additional tablets.');
  const software = pricePackage({ ...regular.selection, tablets: 0 });
  return { selection: regular.selection, software, tabletMonthly: regular.selection.tablets * 3799,
    freeTabletMonths: 6, initialMonths: 12, termsVersion: SHOW_TERMS_VERSION, dueToday: 0 };
}
export function addCalendarMonths(date: string, months: number) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return Math.floor(d.getTime() / 1000);
}
export function validateStartDate(date: string, now = Date.now()) {
  const time = Date.parse(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date
    || time < now + 86400000 || time > now + 365 * 86400000) throw new Error('Choose a valid activation date at least 24 hours and no more than one year ahead.');
  return Math.floor(time / 1000);
}
