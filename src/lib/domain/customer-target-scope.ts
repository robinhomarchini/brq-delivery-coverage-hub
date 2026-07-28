export type TargetScopeCustomer = object & {
  countsTowardTarget?: boolean;
};

export function customerCountsTowardTarget<T extends TargetScopeCustomer>(customer: T) {
  return customer.countsTowardTarget !== false;
}

export function customerBelongsToTargetScope<T extends TargetScopeCustomer>(customer: T, includeNewLogos: boolean) {
  return includeNewLogos || customerCountsTowardTarget(customer);
}

export function filterCustomersByTargetScope<T extends TargetScopeCustomer>(
  customers: readonly T[],
  includeNewLogos: boolean,
) {
  return customers.filter((customer) => customerBelongsToTargetScope(customer, includeNewLogos));
}
