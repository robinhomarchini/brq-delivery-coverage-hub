import { useMemo } from "react";
import type { Person } from "@/data/mockData";

export interface TreeNode {
  id: string;
  level: number; // 0 = executive, 1 = director, 2 = manager, 3 = ic
  person: Person;
  children: TreeNode[];
  collapsed: boolean;
  directReportCount: number;
  parentId: string | null;
}

interface UseOrganizationTreeOptions {
  people: Person[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function useOrganizationTree({ people, expanded, onToggle }: UseOrganizationTreeOptions) {
  const tree = useMemo(() => {
    const executive = people.find((person) => person.roleType === "Executive");
    const directors = people.filter((person) => person.roleType === "Director");
    const nodes = new Map<string, TreeNode>();

    const getLevel = (roleType: Person["roleType"]): number => {
      if (roleType === "Executive") return 0;
      if (roleType === "Director") return 1;
      if (roleType === "Staff") return 2;
      if (["Manager", "Delivery", "Farmer + Delivery", "Hunter", "Hunter Especializado", "Farmer", "Hunter + Farmer"].includes(roleType)) return 2;
      return 3;
    };

    const buildNode = (person: Person, parentId: string | null): TreeNode => {
      const key = `${person.id}-${parentId ?? "root"}`;
      if (nodes.has(key)) {
        return nodes.get(key)!;
      }

      const level = getLevel(person.roleType);
      const directReports = people.filter((p) => p.id !== person.id && (p.directorId === person.id || p.managerId === person.id));
      const node: TreeNode = {
        id: person.id,
        level,
        person,
        children: [],
        collapsed: !(expanded[person.id] ?? level < 2),
        directReportCount: directReports.length,
        parentId,
      };

      nodes.set(key, node);
      node.children = directReports.map((report) => buildNode(report, person.id));
      return node;
    };

    const rootNodes: TreeNode[] = [];

    if (executive) {
      rootNodes.push(buildNode(executive, null));
    }

    directors.forEach((director) => {
      const exists = rootNodes.some((node) => node.id === director.id);
      if (!exists) {
        rootNodes.push(buildNode(director, null));
      }
    });

    return { rootNodes, nodes };
  }, [people, expanded]);

  const toggle = (personId: string) => {
    onToggle(personId);
  };

  return {
    tree,
    toggle,
  };
}
