import { strict as assert } from "node:assert";
import {
  customerBelongsToTargetScope,
  customerCountsTowardTarget,
  filterCustomersByTargetScope,
} from "../src/lib/domain/customer-target-scope";

const regularCustomer = { id: "regular", countsTowardTarget: true };
const implicitRegularCustomer = { id: "implicit" };
const newLogoCustomer = { id: "new-logo", countsTowardTarget: false };

assert.equal(customerCountsTowardTarget(regularCustomer), true);
assert.equal(customerCountsTowardTarget(implicitRegularCustomer), true);
assert.equal(customerCountsTowardTarget(newLogoCustomer), false);

assert.equal(customerBelongsToTargetScope(newLogoCustomer, false), false);
assert.equal(customerBelongsToTargetScope(newLogoCustomer, true), true);

assert.deepEqual(
  filterCustomersByTargetScope([regularCustomer, implicitRegularCustomer, newLogoCustomer], false).map((customer) => customer.id),
  ["regular", "implicit"],
  "Default target scope must exclude New Logo customers.",
);

assert.deepEqual(
  filterCustomersByTargetScope([regularCustomer, implicitRegularCustomer, newLogoCustomer], true).map((customer) => customer.id),
  ["regular", "implicit", "new-logo"],
  "Explicit New Logo scope must preserve all customers.",
);

console.log("Customer target scope contract checks passed.");
