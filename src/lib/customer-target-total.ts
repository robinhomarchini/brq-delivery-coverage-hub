import type { Customer } from "@/data/mockData";
import { roundCurrency } from "@/lib/utils";

export function getCustomerTotalTarget(customer: Pick<Customer, "hunterTarget" | "farmerRenewalTarget">) {
  return getCustomerTotalTargetFromParts(customer.hunterTarget, customer.farmerRenewalTarget);
}

export function getCustomerTotalTargetFromParts(hunterTarget: number, farmerRenewalTarget: number) {
  return roundCurrency(hunterTarget + farmerRenewalTarget);
}
