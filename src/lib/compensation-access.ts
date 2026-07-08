import type { Person } from "@/data/mockData";
import type { AccessUser } from "@/lib/access-control";

const vpPatterns = [
  /\bvp\b/i,
  /vice[-\s]?presidente/i,
  /vice president/i,
];

export function isVpJobTitle(jobTitle: string) {
  return vpPatterns.some((pattern) => pattern.test(jobTitle));
}

export function canManageCompensation(accessUser: AccessUser | null | undefined, people: Person[]) {
  if (!accessUser?.active || accessUser.role !== "admin") return false;
  const accessEmail = accessUser.email.toLowerCase();
  const matchingPerson = people.find((person) => person.email?.toLowerCase() === accessEmail);

  return Boolean(matchingPerson && isVpJobTitle(matchingPerson.jobTitle));
}
