import { z } from "zod";
import type { Area, Customer, Person, Subject, TargetAllocation } from "@/data/mockData";

const safeText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(max, `${label} excede ${max} caracteres.`);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

const optionalEmail = z.union([
  z.email("E-mail inválido.").max(254),
  z.literal(""),
  z.undefined(),
]).transform((value) => value ? value.toLowerCase() : undefined);

const personSchema = z.object({
  id: safeText("Identificador", 120),
  name: safeText("Nome", 120),
  email: optionalEmail,
  jobTitle: safeText("Cargo", 120),
  directorId: optionalText(120),
  managerId: optionalText(120),
  roleType: z.enum(["Executive", "Director", "Farmer + Delivery", "Delivery", "Hunter", "Farmer", "Hunter + Farmer", "Staff"]),
  areaId: optionalText(120),
  clientIds: z.array(safeText("Cliente", 120)).max(100),
  photoUrl: z.union([
    z.url("URL da foto inválida.").refine((value) => value.startsWith("https://"), "A foto deve usar HTTPS."),
    z.literal(""),
    z.undefined(),
  ]).transform((value) => value || undefined),
  notes: optionalText(2000),
  active: z.boolean(),
  isManager: z.boolean(),
  hierarchyLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const areaSchema = z.object({
  id: safeText("Identificador", 120),
  name: safeText("Nome", 120),
  description: z.string().trim().max(500, "Descrição excede 500 caracteres."),
});

const customerSchema = z.object({
  id: safeText("Identificador", 120),
  name: safeText("Nome", 160),
  industry: safeText("Indústria", 120),
  directorResponsibleId: safeText("Diretor", 120),
  managerResponsibleIds: z.array(safeText("Manager", 120)).max(20),
  hunterTarget: z.number().finite().min(0, "Meta Hunter não pode ser negativa.").max(999999999999),
  farmerRenewalTarget: z.number().finite().min(0, "Meta Renovação + Ampliação não pode ser negativa.").max(999999999999),
  studioTarget: z.number().finite().min(0, "Meta Áreas / Studios não pode ser negativa.").max(999999999999),
  revenue: z.number().finite().min(0, "Receita não pode ser negativa.").max(999999999999),
  margin: z.number().finite().min(0, "Margem não pode ser negativa.").max(100, "Margem não pode exceder 100%."),
  strategicAccount: z.boolean(),
});

const subjectSchema = z.object({
  id: safeText("Identificador", 120),
  customerId: safeText("Cliente", 120),
  name: safeText("Nome", 160),
  description: z.string().trim().max(2000, "Descrição excede 2.000 caracteres."),
  ownerPersonId: optionalText(120),
  status: z.enum(["Ativo", "Em evolução", "Atenção", "Planejado"]),
  strategic: z.boolean(),
});

const targetAllocationSchema = z.object({
  id: safeText("Identificador", 180),
  customerId: safeText("Cliente", 120),
  personId: safeText("Pessoa", 120),
  type: z.enum(["hunter", "farmer_renewal", "studio"]),
  year: z.number().int("Ano deve ser inteiro.").min(2020, "Ano inválido.").max(2100, "Ano inválido."),
  amount: z.number().finite().min(0, "Valor da meta não pode ser negativo.").max(999999999999),
  notes: optionalText(2000),
});

export function validatePerson(value: Person) {
  return parse(personSchema, value);
}

export function validateArea(value: Area) {
  return parse(areaSchema, value);
}

export function validateCustomer(value: Customer) {
  return parse(customerSchema, value);
}

export function validateSubject(value: Subject) {
  return parse(subjectSchema, value);
}

export function validateTargetAllocation(value: TargetAllocation) {
  return parse(targetAllocationSchema, value);
}

function parse<T>(schema: z.ZodType<T>, value: T): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? "Dados inválidos.");
}
