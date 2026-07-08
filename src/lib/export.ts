"use client";

import type { Area, Customer, CustomerTarget, Person, StudioTargetAllocation, Subject, TargetAllocation } from "@/data/mockData";

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
    ["Nome", "Indústria", "Diretor", "Managers", "Receita", "Margem alvo", "Estratégica"],
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

export function exportAdminBaseWorkbook({
  year,
  people,
  customers,
  areas,
  subjects,
  customerTargets,
  targetAllocations,
  studioTargetAllocations,
}: {
  year: number;
  people: Person[];
  customers: Customer[];
  areas: Area[];
  subjects: Subject[];
  customerTargets: CustomerTarget[];
  targetAllocations: TargetAllocation[];
  studioTargetAllocations: StudioTargetAllocation[];
}) {
  const personNames = new Map(people.map((person) => [person.id, person.name]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const sheets: WorkbookSheet[] = [
    {
      name: "Leia-me",
      rows: [
        ["Base operacional BRQ Delivery Coverage Hub"],
        ["Ano", year],
        ["Gerado em", generatedAt],
        ["Observação", "Dados sensíveis de remuneração/salário não fazem parte desta exportação."],
      ],
    },
    {
      name: "Pessoas",
      rows: [
        ["ID", "Nome", "E-mail", "Cargo", "Perfil", "Diretor", "Manager", "Área", "Clientes vinculados", "Ativo", "Status", "Data desligamento", "Motivo desligamento", "É manager", "Nível"],
        ...people.map((person) => [
          person.id,
          person.name,
          person.email ?? "",
          person.jobTitle,
          person.roleType,
          person.directorId ? personNames.get(person.directorId) ?? person.directorId : "",
          person.managerId ? personNames.get(person.managerId) ?? person.managerId : "",
          person.areaId ? areaNames.get(person.areaId) ?? person.areaId : "",
          person.clientIds.map((customerId) => customerNames.get(customerId) ?? customerId).join(", "),
          person.active ? "Sim" : "Não",
          person.lifecycleStatus,
          person.closedAt ?? "",
          person.closedReason ?? "",
          person.isManager ? "Sim" : "Não",
          person.hierarchyLevel,
        ]),
      ],
    },
    {
      name: "Pessoas Clientes",
      rows: [
        ["Pessoa ID", "Pessoa", "Cliente ID", "Cliente"],
        ...people.flatMap((person) => person.clientIds.map((customerId) => [
          person.id,
          person.name,
          customerId,
          customerNames.get(customerId) ?? customerId,
        ])),
      ],
    },
    {
      name: "Clientes",
      rows: [
        ["ID", "Cliente", "Indústria", "Diretor responsável", "Managers responsáveis", "Meta Hunter vigente", "Renovação + Ampliação vigente", "Studio Hunter vigente", "Studio Manutenção vigente", "Meta Total vigente", "Margem", "Estratégica", "Status"],
        ...customers.map((customer) => [
          customer.id,
          customer.name,
          customer.industry,
          personNames.get(customer.directorResponsibleId) ?? customer.directorResponsibleId,
          customer.managerResponsibleIds.map((personId) => personNames.get(personId) ?? personId).join(", "),
          customer.hunterTarget,
          customer.farmerRenewalTarget,
          customer.studioHunterTarget,
          customer.studioTarget,
          customer.revenue,
          customer.margin,
          customer.strategicAccount ? "Sim" : "Não",
          customer.lifecycleStatus,
        ]),
      ],
    },
    {
      name: "Áreas",
      rows: [
        ["ID", "Área / Studio", "Descrição"],
        ...areas.map((area) => [area.id, area.name, area.description]),
      ],
    },
    {
      name: "Assuntos",
      rows: [
        ["ID", "Cliente", "Assunto", "Descrição", "Responsável", "Status", "Estratégico"],
        ...subjects.map((subject) => [
          subject.id,
          customerNames.get(subject.customerId) ?? subject.customerId,
          subject.name,
          subject.description,
          subject.ownerPersonId ? personNames.get(subject.ownerPersonId) ?? subject.ownerPersonId : "",
          subject.status,
          subject.strategic ? "Sim" : "Não",
        ]),
      ],
    },
    {
      name: "Metas Clientes",
      rows: [
        ["Cliente ID", "Cliente", "Ano", "Meta Hunter", "Renovação + Ampliação", "Studio Hunter", "Studio Manutenção", "Meta Total"],
        ...customerTargets
          .filter((target) => target.year === year)
          .map((target) => [
            target.customerId,
            customerNames.get(target.customerId) ?? target.customerId,
            target.year,
            target.hunterTarget,
            target.farmerRenewalTarget,
            target.studioHunterTarget,
            target.studioTarget,
            target.revenue,
          ]),
      ],
    },
    {
      name: "Metas Pessoas",
      rows: [
        ["ID", "Cliente", "Pessoa", "Tipo", "Ano", "Valor", "Observações"],
        ...targetAllocations
          .filter((allocation) => allocation.year === year)
          .map((allocation) => [
            allocation.id,
            customerNames.get(allocation.customerId) ?? allocation.customerId,
            personNames.get(allocation.personId) ?? allocation.personId,
            translateTargetAllocationType(allocation.type),
            allocation.year,
            allocation.amount,
            allocation.notes ?? "",
          ]),
      ],
    },
    {
      name: "Alocações Studios",
      rows: [
        ["ID", "Cliente", "Área / Studio", "Hunter Studio", "Ano", "Studio Hunter", "Studio Manutenção", "Total", "Observações"],
        ...studioTargetAllocations
          .filter((allocation) => allocation.year === year)
          .map((allocation) => [
            allocation.id,
            customerNames.get(allocation.customerId) ?? allocation.customerId,
            areaNames.get(allocation.areaId) ?? allocation.areaId,
            allocation.hunterPersonId ? personNames.get(allocation.hunterPersonId) ?? allocation.hunterPersonId : "",
            allocation.year,
            allocation.hunterAmount,
            allocation.maintenanceAmount,
            allocation.hunterAmount + allocation.maintenanceAmount,
            allocation.notes ?? "",
          ]),
      ],
    },
  ];

  const workbook = buildExcelXmlWorkbook(sheets);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `base-operacional-brq-${year}.xls`, true);
}

function sanitizeCsvCell(value: unknown) {
  const text = String(value ?? "").replaceAll("\"", "\"\"");
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

type WorkbookCell = string | number | boolean | null | undefined;
type WorkbookSheet = {
  name: string;
  rows: WorkbookCell[][];
};

function buildExcelXmlWorkbook(sheets: WorkbookSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/></Style>
  </Styles>
  ${sheets.map((sheet) => buildWorksheet(sheet)).join("\n")}
</Workbook>`;
}

function buildWorksheet(sheet: WorkbookSheet) {
  return `<Worksheet ss:Name="${escapeXml(sanitizeWorksheetName(sheet.name))}">
  <Table>
    ${sheet.rows.map((row, rowIndex) => `<Row>${row.map((cell) => buildWorkbookCell(cell, rowIndex === 0)).join("")}</Row>`).join("\n")}
  </Table>
</Worksheet>`;
}

function buildWorkbookCell(value: WorkbookCell, header: boolean) {
  const style = header ? " ss:StyleID=\"Header\"" : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  const text = typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value ?? "");
  return `<Cell${style}><Data ss:Type="String">${escapeXml(sanitizeSpreadsheetText(text))}</Data></Cell>`;
}

function sanitizeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function sanitizeWorksheetName(value: string) {
  return value.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31) || "Planilha";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function translateTargetAllocationType(type: TargetAllocation["type"]) {
  const labels: Record<TargetAllocation["type"], string> = {
    farmer_renewal: "Renovação + Ampliação",
    hunter: "Hunter",
    studio: "Área / Studio",
  };

  return labels[type] ?? type;
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
