const userSafeMessagePatterns = [
  /^Ano inválido\.$/,
  /^Cliente .+/,
  /^Data .+/,
  /^Diretor .+/,
  /^E-mail inválido\.$/,
  /^Executivo, Diretor e Staff não recebem meta direta\.$/,
  /^Identificador .+/,
  /^Indústria .+/,
  /^Já existe .+/,
  /^Manager .+/,
  /^Margem .+/,
  /^Meta .+/,
  /^Nome .+/,
  /^Pessoa .+/,
  /^Receita .+/,
  /^Selecione .+/,
  /^Valor .+/,
];

export function getSafeCommandErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message && isUserSafeCommandMessage(error.message)) {
    return error.message;
  }
  return fallbackMessage;
}

function isUserSafeCommandMessage(message: string) {
  return userSafeMessagePatterns.some((pattern) => pattern.test(message));
}
