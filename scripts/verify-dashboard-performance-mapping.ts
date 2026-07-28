import assert from "node:assert/strict";
import { mapCustomerPerformanceResult } from "../src/lib/repositories/supabaseDeliveryRepository";

const mapped = mapCustomerPerformanceResult({
  items: [{
    customer_id: "customer-1",
    customer_name: "Cliente Teste",
    target_amount: "1000.50",
    allocated_total: 900,
    hunter_allocated: "300",
    delivery_farmer_allocated: 600,
    responsible_people_count: 2,
    people_delta: "-100.50",
    achievement_percentage: "89.96",
  }],
});

assert.deepEqual(mapped, {
  items: [{
    customerId: "customer-1",
    customerName: "Cliente Teste",
    targetAmount: 1000.5,
    allocatedTotal: 900,
    hunterAllocated: 300,
    deliveryFarmerAllocated: 600,
    responsiblePeopleCount: 2,
    peopleDelta: -100.5,
    achievementPercentage: 89.96,
  }],
});

assert.deepEqual(mapCustomerPerformanceResult(null), { items: [] });
assert.deepEqual(mapCustomerPerformanceResult({ items: [{ customer_id: "", customer_name: "" }] }), { items: [] });

console.log("Dashboard performance RPC mapping checks passed.");
