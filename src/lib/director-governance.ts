export const OTHER_DIRECTOR_ID = "director-other";
export const OTHER_DIRECTOR_NAME = "Outros";

export function isOtherDirectorId(value?: string | null) {
  return value === OTHER_DIRECTOR_ID;
}

export function displayDirectorName(nameOrId: string) {
  if (isOtherDirectorId(nameOrId) || nameOrId === OTHER_DIRECTOR_NAME) return OTHER_DIRECTOR_NAME;
  return nameOrId.startsWith("Ane Knust") ? "Ane Knust" : nameOrId;
}
