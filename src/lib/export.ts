"use client";

import type { Customer, Person } from "@/data/mockData";

export async function exportElementAsPng(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element "${elementId}" was not found.`);
  }

  await document.fonts.ready;
  await waitForPaint();

  const { toBlob } = await import("html-to-image");
  const width = element.scrollWidth;
  const height = element.scrollHeight;
  const pixelRatio = calculateSafePixelRatio(width, height);
  const blob = await toBlob(element, {
    cacheBust: true,
    backgroundColor: "#fafafa",
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
    },
  });

  if (!blob) {
    throw new Error("The organization chart image could not be generated.");
  }

  const objectUrl = URL.createObjectURL(blob);
  downloadDataUrl(objectUrl, filename);
  return objectUrl;
}

export async function exportElementAsPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const dataUrl = await toPng(element, {
    cacheBust: true,
    backgroundColor: "#f8fafc",
    pixelRatio: 1.5,
  });
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const orientation = image.width >= image.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [image.width, image.height] });
  pdf.addImage(dataUrl, "PNG", 0, 0, image.width, image.height);
  pdf.save(filename);
}

export function exportDeliveryDataAsCsv(
  people: Person[],
  customers: Customer[],
) {
  const sections = [
    ["PESSOAS"],
    ["Nome", "Email", "Cargo", "Tipo", "Ativo"],
    ...people.map((person) => [person.name, person.email ?? "", person.jobTitle, person.roleType, person.active ? "Sim" : "Não"]),
    [],
    ["CLIENTES"],
    ["Nome", "Indústria", "Diretor", "Managers", "Receita", "Margem", "Estratégica"],
    ...customers.map((customer) => [
      customer.name,
      customer.industry,
      customer.directorResponsibleId,
      customer.managerResponsibleIds.join(", "),
      customer.revenue,
      customer.margin,
      customer.strategicAccount ? "Sim" : "Não",
    ]),
  ];

  const csv = sections
    .map((row) => row.map((cell) => `"${sanitizeCsvCell(cell)}"`).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, "brq-delivery-coverage.csv", true);
}

function sanitizeCsvCell(value: unknown) {
  const text = String(value ?? "").replaceAll("\"", "\"\"");
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

function downloadDataUrl(url: string, filename: string, revoke = false) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (revoke) URL.revokeObjectURL(url);
}

function calculateSafePixelRatio(width: number, height: number) {
  const maxPixels = 16_000_000;
  return Math.min(2, Math.sqrt(maxPixels / (width * height)));
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
