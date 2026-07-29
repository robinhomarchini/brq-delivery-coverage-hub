import assert from "node:assert/strict";

const rows = [
  {
    customer_id: "customer-1",
    customer_name: "Cliente Teste",
    target_amount: "1000.50",
    allocated_total: 900,
    hunter_allocated: "300",
    delivery_farmer_allocated: 600,
    responsible_people_count: 2,
    people_delta: "-100.50",
    achievement_percentage: "89.96",
  },
];

function readNumber(record: Record<string, unknown>, camelKey: string, snakeKey: string) {
  const value = record[camelKey] ?? record[snakeKey];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

const mapped = rows
  .filter((row) => row.customer_id && row.customer_name)
  .map((row) => ({
    customerId: row.customer_id ?? "",
    customerName: row.customer_name ?? "",
    targetAmount: readNumber(row, "targetAmount", "target_amount"),
    allocatedTotal: readNumber(row, "allocatedTotal", "allocated_total"),
    hunterAllocated: readNumber(row, "hunterAllocated", "hunter_allocated"),
    deliveryFarmerAllocated: readNumber(row, "deliveryFarmerAllocated", "delivery_farmer_allocated"),
    responsiblePeopleCount: readNumber(row, "responsiblePeopleCount", "responsible_people_count"),
    peopleDelta: readNumber(row, "peopleDelta", "people_delta"),
    achievementPercentage: readNumber(row, "achievementPercentage", "achievement_percentage"),
  }));

assert.deepEqual(mapped, [
  {
    customerId: "customer-1",
    customerName: "Cliente Teste",
    targetAmount: 1000.5,
    allocatedTotal: 900,
    hunterAllocated: 300,
    deliveryFarmerAllocated: 600,
    responsiblePeopleCount: 2,
    peopleDelta: -100.5,
    achievementPercentage: 89.96,
  },
]);

console.log("Dashboard performance typed mapping checks passed.");
