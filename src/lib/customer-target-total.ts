import type { Customer } from "@/data/mockData";
import { customerCountsTowardTarget } from "@/lib/domain/customer-target-scope";
import { roundCurrency } from "@/lib/utils";

export function getCustomerTotalTarget(customer: Pick<Customer, "hunterTarget" | "farmerRenewalTarget">) {
  return getCustomerTotalTargetFromParts(customer.hunterTarget, customer.farmerRenewalTarget);
}

export function getCustomerEffectiveTotalTarget(customer: Pick<Customer, "hunterTarget" | "farmerRenewalTarget" | "countsTowardTarget">) {
  if (!customerCountsTowardTarget(customer)) return 0;
  return getCustomerTotalTarget(customer);
}

export function getCustomerTotalTargetFromParts(hunterTarget: number, farmerRenewalTarget: number) {
  return roundCurrency(hunterTarget + farmerRenewalTarget);
}

export { customerCountsTowardTarget } from "@/lib/domain/customer-target-scope";
