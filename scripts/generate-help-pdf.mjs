import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";

const root = resolve(import.meta.dirname, "..");
const publicPdf = resolve(root, "public/help/guia-rapido-brq-delivery-coverage-hub.pdf");
const outputPdf = resolve(root, "output/pdf/guia-rapido-brq-delivery-coverage-hub.pdf");

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function addWrapped(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function buildPdf(path) {
  ensureDir(path);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const purple = [127, 46, 201];
  const ink = [21, 23, 27];
  const slate = [71, 85, 105];
  const light = [248, 250, 252];
  const border = [203, 213, 225];
  const margin = 16;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...ink);
  doc.text("BRQ Delivery Coverage Hub", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...slate);
  y = addWrapped(doc, "Guia rapido de utilizacao para homologacao da estrutura de Delivery, clientes e metas da BU Financial.", margin, y, 175, 5);
  y += 4;

  y = section(doc, "Fluxo recomendado", y, margin, purple);
  [
    "1. Revise Pessoas: confirme perfil, cliente associado e se a pessoa pode receber meta direta.",
    "2. Revise Areas/Studios: cadastre Alianças, PX, Mobile, BA, IA, Dados ou outros grupos que apoiam Delivery.",
    "3. Revise Clientes: confirme diretor, managers, Hunter responsavel, metas Hunter/Renovacao/Areas-Studio por ano, margem-alvo 35,8% e conta estrategica.",
    "4. Use Metas por Pessoa: selecione a pessoa e o ano, informe valores Hunter, Renovacao + Ampliacao e Areas / Studios por cliente.",
    "5. Use Insights: importe a planilha baseline e aplique somente divergencias marcadas.",
    "6. Use Metas e Relatorio de Metas: acompanhe pendencias e valores por pessoa.",
  ].forEach((item) => {
    y = addWrapped(doc, item, margin, y, 175, 5);
    y += 1;
  });
  y += 4;

  y = section(doc, "Principais telas", y, margin, purple);
  const rows = [
    ["Tela", "Quando usar", "Resultado esperado"],
    ["Pessoas", "Cadastrar profissionais, perfil, Area/Studio e clientes vinculados.", "Cobertura correta para mapa, organograma e metas."],
    ["Areas/Studios", "Cadastrar grupos como Alianças, PX, Mobile, BA, IA e Dados.", "Classificacao reutilizavel, sem lista fixa no front."],
    ["Clientes", "Ajustar diretor, managers, Hunter, metas anuais e margem-alvo.", "Governanca e baseline financeiro atualizados."],
    ["Metas por Pessoa", "Lancar valores Hunter, Renovacao + Ampliacao e Areas / Studios.", "Distribuicao por pessoa, cliente e ano."],
    ["Metas", "Conferir conciliacao e usar o assistente.", "Pendencias visiveis e acionaveis."],
    ["Insights", "Comparar planilha Financial BU com a base.", "Atualizacao controlada por checkbox."],
  ];
  y = drawTable(doc, rows, margin, y, [35, 68, 70], light, border, purple);
  y += 8;

  y = section(doc, "Regras importantes", y, margin, purple);
  [
    "Robinson, Ane, CA e Staff nao recebem meta direta. Eles aparecem por consolidacao ou governanca.",
    "Renan nao deve carregar meta propria porque responde diretamente a Robinson.",
    "Managers no Cliente representam governanca Delivery; Studios/Areas classificam pessoas que podem participar da execucao.",
    "Renovacao + Ampliacao pode ser distribuida entre managers, farmers/delivery e pessoas dos Studios quando fizer sentido operacional.",
    "A meta total do cliente e composta por Hunter + Renovacao e Ampliacao + Areas / Studios.",
    "A margem e informativa nesta versao; o alvo padrao e 35,8%, sem apuracao automatica.",
    "A importacao respeita as colunas Target RL Hunter, Target RL Farmer e, quando existir, Areas / Studios. Se o sistema divergir, corrija Metas por Pessoa ou aplique o baseline.",
    "Se a soma das metas das pessoas ultrapassar a meta do cliente, o sistema pergunta se a meta do cliente deve ser aumentada.",
    "O Assistente de Metas mostra clientes sem meta, sem manager, sem hunter associado e divergencias de conciliacao.",
  ].forEach((item) => {
    y = addWrapped(doc, item, margin, y, 175, 5);
    y += 1;
  });
  y += 4;

  y = section(doc, "Dica para homologacao", y, margin, purple);
  addWrapped(doc, "Comece pelo Assistente de Metas. Clique no item de pendencia para abrir diretamente a tela correta de ajuste.", margin, y, 175, 5);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("BRQ Delivery Coverage Hub - Guia rapido", margin, 287);
  doc.text("1", 195, 287, { align: "right" });

  writeFileSync(path, Buffer.from(doc.output("arraybuffer")));
}

function section(doc, title, y, margin, color) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...color);
  doc.text(title, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  return y + 7;
}

function drawTable(doc, rows, x, y, widths, light, border, purple) {
  const rowHeight = 18;
  rows.forEach((row, rowIndex) => {
    let cellX = x;
    const isHeader = rowIndex === 0;
    doc.setFillColor(...(isHeader ? purple : light));
    doc.setDrawColor(...border);
    doc.rect(x, y, widths.reduce((sum, width) => sum + width, 0), rowHeight, "FD");
    row.forEach((cell, cellIndex) => {
      doc.setDrawColor(...border);
      doc.rect(cellX, y, widths[cellIndex], rowHeight);
      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(isHeader ? [255, 255, 255] : [51, 65, 85]));
      const lines = doc.splitTextToSize(cell, widths[cellIndex] - 4);
      doc.text(lines.slice(0, 3), cellX + 2, y + 5);
      cellX += widths[cellIndex];
    });
    y += rowHeight;
  });
  return y;
}

buildPdf(publicPdf);
buildPdf(outputPdf);
console.log(publicPdf);
console.log(outputPdf);
