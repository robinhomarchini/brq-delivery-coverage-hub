import assert from "node:assert/strict";
import { formatCurrencyInput, formatCurrencyInputValue, parseCurrencyInput } from "../src/lib/currency-input";

const parseCases = [
  ["1.234,56", 1234.56],
  ["1234,56", 1234.56],
  ["1234.56", 1234.56],
  ["1.234", 1234],
  ["0,25", 0.25],
  ["R$ 15.285.394,75", 15285394.75],
] as const;

for (const [input, expected] of parseCases) {
  assert.equal(parseCurrencyInput(input), expected, `parseCurrencyInput(${input})`);
}

const formatCases = [
  ["1234,56", "1.234,56"],
  ["1234.56", "1.234,56"],
  ["1.234,", "1.234,"],
  ["0,25", "0,25"],
  ["15285394,75", "15.285.394,75"],
] as const;

for (const [input, expected] of formatCases) {
  assert.equal(formatCurrencyInput(input), expected, `formatCurrencyInput(${input})`);
}

assert.equal(formatCurrencyInputValue(1234), "1.234");
assert.equal(formatCurrencyInputValue(1234.56), "1.234,56");

console.log("Currency input checks passed.");
