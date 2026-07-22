import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  const displayValue = Math.abs(value) < 0.5 ? 0 : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(displayValue);
}

export function formatCompactCurrency(value: number) {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1_000_000_000) {
    return `${sign}R$ ${formatCompactNumber(absValue / 1_000_000_000)} bi`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}R$ ${formatCompactNumber(absValue / 1_000_000)} mi`;
  }

  if (absValue >= 1_000) {
    return `${sign}R$ ${formatCompactNumber(absValue / 1_000)} mil`;
  }

  return formatCurrency(value);
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeBusinessName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toFileSlug(value: string) {
  return normalizeBusinessName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "arquivo";
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value >= 10 ? 1 : 2,
    minimumFractionDigits: 0,
  }).format(value);
}
