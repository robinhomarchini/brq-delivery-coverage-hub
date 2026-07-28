import { NextResponse } from "next/server";
import { DeliveryCommandAccessError } from "@/server/auth/delivery-command-access";
import { EmployeeImportParseError } from "@/server/employee-import/parser";

const maxFileSize = 10 * 1024 * 1024;

export function getWorkbookFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new EmployeeImportRequestError("Selecione uma planilha .xlsx.", 400);
  }
  if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
    throw new EmployeeImportRequestError("O arquivo precisa estar no formato .xlsx.", 415);
  }
  if (file.size === 0) {
    throw new EmployeeImportRequestError("A planilha selecionada está vazia.", 400);
  }
  if (file.size > maxFileSize) {
    throw new EmployeeImportRequestError("A planilha excede o limite de 10 MB.", 413);
  }
  return file;
}

export class EmployeeImportRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function handleEmployeeImportError(error: unknown) {
  if (error instanceof DeliveryCommandAccessError) {
    return NextResponse.json({ error: translateAccessError(error.status) }, { status: error.status });
  }
  if (error instanceof EmployeeImportRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof EmployeeImportParseError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Não foi possível processar a importação.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function translateAccessError(status: number) {
  if (status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  if (status === 403) return "Somente administradores autorizados a consultar remuneração podem importar funcionários.";
  return "A autenticação está temporariamente indisponível.";
}
