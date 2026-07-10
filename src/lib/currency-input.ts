export function formatCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d,.]/g, "").trim();
  if (!sanitized) return "";

  const decimalIndex = getCurrencyDecimalSeparatorIndex(sanitized);
  if (decimalIndex < 0) {
    return formatIntegerDigits(sanitized.replace(/\D/g, ""));
  }

  const integerDigits = sanitized.slice(0, decimalIndex).replace(/\D/g, "") || "0";
  const decimalDigits = sanitized.slice(decimalIndex + 1).replace(/\D/g, "").slice(0, 2);
  const formattedInteger = formatIntegerDigits(integerDigits);

  if (/[,.]$/.test(sanitized) && !decimalDigits) {
    return `${formattedInteger},`;
  }

  return decimalDigits ? `${formattedInteger},${decimalDigits}` : formattedInteger;
}

export function formatCurrencyInputValue(value: number) {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "0";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
  if (!sanitized) return 0;

  const decimalIndex = getCurrencyDecimalSeparatorIndex(sanitized);
  const normalized = decimalIndex < 0
    ? sanitized.replace(/[^\d-]/g, "")
    : [
      sanitized.slice(0, decimalIndex).replace(/[^\d-]/g, "") || "0",
      sanitized.slice(decimalIndex + 1).replace(/\D/g, ""),
    ].join(".");

  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getCurrencyDecimalSeparatorIndex(value: string) {
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    return Math.max(lastComma, lastDot);
  }

  if (lastComma >= 0) {
    return lastComma;
  }

  if (lastDot < 0) {
    return -1;
  }

  const integerDigits = value.slice(0, lastDot).replace(/\D/g, "");
  const fractionDigits = value.slice(lastDot + 1).replace(/\D/g, "");
  if (integerDigits && fractionDigits.length === 3 && isThousandSeparatedAmount(value)) {
    return -1;
  }

  return fractionDigits.length <= 2 ? lastDot : -1;
}

function formatIntegerDigits(value: string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(amount);
}

function isThousandSeparatedAmount(value: string) {
  return /^\d{1,3}(\.\d{3})+$/.test(value);
}
