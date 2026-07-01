import type { Customer, CustomerTarget } from "@/data/mockData";

export const defaultTargetYear = 2026;

export function getAvailableTargetYears(customerTargets: CustomerTarget[], fallbackYear = defaultTargetYear) {
  return Array.from(new Set([fallbackYear, ...customerTargets.map((target) => target.year)]))
    .filter((year) => Number.isFinite(year))
    .sort((first, second) => second - first);
}

export function applyCustomerTargetsForYear(customers: Customer[], customerTargets: CustomerTarget[], year: number) {
  const targetsByCustomer = new Map(customerTargets
    .filter((target) => target.year === year)
    .map((target) => [target.customerId, target]));

  return customers.map((customer) => {
    const target = targetsByCustomer.get(customer.id);
    if (!target) return {
      ...customer,
      hunterTarget: 0,
      farmerRenewalTarget: 0,
      studioHunterTarget: 0,
      studioTarget: 0,
      revenue: 0,
    };
    return {
      ...customer,
      hunterTarget: target.hunterTarget,
      farmerRenewalTarget: target.farmerRenewalTarget,
      studioHunterTarget: target.studioHunterTarget,
      studioTarget: target.studioTarget,
      revenue: target.revenue,
    };
  });
}
