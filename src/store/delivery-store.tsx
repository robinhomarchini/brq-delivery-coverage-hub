"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { areas as initialAreas, customers as initialCustomers, customerTargets as initialCustomerTargets, people as initialPeople, specialistHunterStudioAssignments as initialSpecialistHunterStudioAssignments, studioTargetAllocations as initialStudioTargetAllocations, subjects as initialSubjects, targetAllocations as initialTargetAllocations } from "@/data/mockData";
import type { Area, Customer, CustomerTarget, Person, PersonCompensation, SpecialistHunterStudioAssignment, StudioTargetAllocation, Subject, TargetAllocation } from "@/data/mockData";
import { boardTargetBaselineRows as initialBoardTargetBaselines, type BoardTargetBaselineRow } from "@/data/boardTargetBaseline";
import type { StudioBaselineSnapshot } from "@/lib/studio-baseline-import";
import { createDeliveryRepositorySelection } from "@/lib/repositories";
import type { AreaUsage, DeliveryData, PersonCustomerRemovalInput, PersonCustomerTargetsInput, SpecialistHunterStudioAssignmentsInput } from "@/lib/repositories";
import { buildAreaUsages } from "@/lib/area-usage";
import { getEligibleStudioRenewalAmountForPerson, getTargetOwnAmount } from "@/lib/studio-renewal-rollup";

interface DeliveryStoreValue {
  people: Person[];
  personCompensations: PersonCompensation[];
  customers: Customer[];
  customerTargets: CustomerTarget[];
  subjects: Subject[];
  areas: Area[];
  areaUsages: AreaUsage[];
  targetAllocations: TargetAllocation[];
  studioTargetAllocations: StudioTargetAllocation[];
  specialistHunterStudioAssignments: SpecialistHunterStudioAssignment[];
  boardTargetBaselines: BoardTargetBaselineRow[];
  studioBaselineSnapshots: StudioBaselineSnapshot[];
  loading: boolean;
  error: string;
  clearError: () => void;
  saveArea: (area: Area) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;
  savePerson: (person: Person) => Promise<void>;
  savePersonCompensation: (compensation: PersonCompensation) => Promise<void>;
  deletePersonCompensation: (personId: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  saveCustomer: (customer: Customer, targetYear?: number) => Promise<void>;
  saveCustomers: (customers: Customer[], targetYear?: number) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  saveSubject: (subject: Subject) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveTargetAllocation: (allocation: TargetAllocation) => Promise<void>;
  deleteTargetAllocation: (id: string) => Promise<void>;
  saveStudioTargetAllocation: (allocation: StudioTargetAllocation) => Promise<void>;
  deleteStudioTargetAllocation: (id: string) => Promise<void>;
  saveSpecialistHunterStudioAssignments: (input: SpecialistHunterStudioAssignmentsInput) => Promise<void>;
  saveStudioBaselineSnapshot: (snapshot: Omit<StudioBaselineSnapshot, "id" | "createdAt">) => Promise<StudioBaselineSnapshot>;
  savePersonCustomerTargets: (input: PersonCustomerTargetsInput) => Promise<void>;
  removePersonCustomerTargets: (input: PersonCustomerRemovalInput) => Promise<void>;
}

const DeliveryStoreContext = createContext<DeliveryStoreValue | null>(null);

export function DeliveryStoreProvider({ children }: { children: React.ReactNode }) {
  const repositorySelection = useMemo(() => createDeliveryRepositorySelection(), []);
  const useEmptyInitialData = repositorySelection.useEmptyInitialData;
  const [people, setPeople] = useState<Person[]>(useEmptyInitialData ? [] : initialPeople);
  const [personCompensations, setPersonCompensations] = useState<PersonCompensation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(useEmptyInitialData ? [] : initialCustomers);
  const [customerTargets, setCustomerTargets] = useState<CustomerTarget[]>(useEmptyInitialData ? [] : initialCustomerTargets);
  const [subjects, setSubjects] = useState<Subject[]>(useEmptyInitialData ? [] : initialSubjects);
  const [areas, setAreas] = useState<Area[]>(useEmptyInitialData ? [] : initialAreas);
  const [areaUsages, setAreaUsages] = useState<AreaUsage[]>(useEmptyInitialData ? [] : buildAreaUsages(initialPeople));
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>(useEmptyInitialData ? [] : initialTargetAllocations);
  const [studioTargetAllocations, setStudioTargetAllocations] = useState<StudioTargetAllocation[]>(useEmptyInitialData ? [] : initialStudioTargetAllocations);
  const [specialistHunterStudioAssignments, setSpecialistHunterStudioAssignments] = useState<SpecialistHunterStudioAssignment[]>(useEmptyInitialData ? [] : initialSpecialistHunterStudioAssignments);
  const [boardTargetBaselines, setBoardTargetBaselines] = useState<BoardTargetBaselineRow[]>(useEmptyInitialData ? [] : initialBoardTargetBaselines);
  const [studioBaselineSnapshots, setStudioBaselineSnapshots] = useState<StudioBaselineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const repository = repositorySelection.repository;
  const applyDeliveryData = useCallback((data: DeliveryData) => {
    setPeople(data.people);
    setPersonCompensations(data.personCompensations);
    setCustomers(data.customers);
    setCustomerTargets(data.customerTargets);
    setSubjects(data.subjects);
    setAreas(data.areas);
    setAreaUsages(data.areaUsages);
    setTargetAllocations(data.targetAllocations);
    setStudioTargetAllocations(data.studioTargetAllocations);
    setSpecialistHunterStudioAssignments(data.specialistHunterStudioAssignments);
    setBoardTargetBaselines(data.boardTargetBaselines);
    setStudioBaselineSnapshots(data.studioBaselineSnapshots);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    repository.getAll()
      .then((data) => {
        if (!active) return;
        applyDeliveryData(data);
      })
      .catch((error) => setError(`Não foi possível carregar os dados persistidos. Nenhuma alteração será considerada salva. ${getErrorMessage(error)}`))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [applyDeliveryData, repository]);

  const value = useMemo<DeliveryStoreValue>(() => ({
    people,
    personCompensations,
    customers,
    customerTargets,
    subjects,
    areas,
    areaUsages,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
    boardTargetBaselines,
    studioBaselineSnapshots,
    loading,
    error,
    clearError: () => setError(""),
    saveArea: async (area) => {
      try {
        const data = await repository.saveArea(area);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar a área/studio. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteArea: async (id) => {
      try {
        const data = await repository.deleteArea(id);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível excluir a área/studio. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    savePerson: async (person) => {
      try {
        const data = await repository.savePerson(person);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar a pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    savePersonCompensation: async (compensation) => {
      try {
        const data = await repository.savePersonCompensation(compensation);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar a remuneração. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deletePersonCompensation: async (personId) => {
      try {
        const data = await repository.deletePersonCompensation(personId);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível remover a remuneração. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deletePerson: async (id) => {
      try {
        await repository.deletePerson(id);
        setPeople((current) => current.filter((item) => item.id !== id));
        setPersonCompensations((current) => current.filter((item) => item.personId !== id));
        setTargetAllocations((current) => current.filter((item) => item.personId !== id));
        setStudioTargetAllocations((current) => current.map((item) =>
          item.hunterPersonId === id || item.maintenancePersonId === id
            ? {
              ...item,
              hunterPersonId: item.hunterPersonId === id ? undefined : item.hunterPersonId,
              maintenancePersonId: item.maintenancePersonId === id ? undefined : item.maintenancePersonId,
            }
            : item
        ));
        setSpecialistHunterStudioAssignments((current) => current.filter((item) => item.personId !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir a pessoa. Verifique vínculos e permissões. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveCustomer: async (customer, targetYear) => {
      try {
        const data = await repository.saveCustomer(customer, targetYear);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar o cliente. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveCustomers: async (items, targetYear) => {
      try {
        const data = await repository.saveCustomers(items, targetYear);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível atualizar os clientes. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteCustomer: async (id) => {
      try {
        const removedStudioAllocationIds = new Set(studioTargetAllocations
          .filter((item) => item.customerId === id)
          .map((item) => item.id));
        await repository.deleteCustomer(id);
        setCustomers((current) => current.filter((item) => item.id !== id));
        setCustomerTargets((current) => current.filter((item) => item.customerId !== id));
        setSubjects((current) => current.filter((item) => item.customerId !== id));
        setTargetAllocations((current) => current.filter((item) => item.customerId !== id));
        setStudioTargetAllocations((current) => current.filter((item) => item.customerId !== id));
        setSpecialistHunterStudioAssignments((current) => current.filter((item) => !removedStudioAllocationIds.has(item.studioTargetAllocationId)));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir o cliente. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveSubject: async (subject) => {
      try {
        const saved = await repository.saveSubject(subject);
        setSubjects((current) => upsert(current, saved));
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar o assunto. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteSubject: async (id) => {
      try {
        await repository.deleteSubject(id);
        setSubjects((current) => current.filter((item) => item.id !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir o assunto. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveTargetAllocation: async (allocation) => {
      try {
        const saved = await repository.saveTargetAllocation(allocation);
        setTargetAllocations((current) => upsert(current, saved));
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar a meta. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteTargetAllocation: async (id) => {
      try {
        await repository.deleteTargetAllocation(id);
        setTargetAllocations((current) => current.filter((item) => item.id !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir a meta. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveStudioTargetAllocation: async (allocation) => {
      try {
        const saved = await repository.saveStudioTargetAllocation(allocation);
        const previous = studioTargetAllocations.find((item) => item.id === saved.id);
        const nextStudioTargetAllocations = upsert(studioTargetAllocations, saved);
        setStudioTargetAllocations(nextStudioTargetAllocations);
        setTargetAllocations((current) => syncStudioDerivedTargetsFromStudioAllocations(
          current,
          nextStudioTargetAllocations,
          areas,
          people,
          getAffectedStudioHunterKeys(saved, previous),
        ));
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar a meta de área/studio. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteStudioTargetAllocation: async (id) => {
      try {
        const previous = studioTargetAllocations.find((item) => item.id === id);
        const nextStudioTargetAllocations = studioTargetAllocations.filter((item) => item.id !== id);
        await repository.deleteStudioTargetAllocation(id);
        setStudioTargetAllocations(nextStudioTargetAllocations);
        setTargetAllocations((current) => syncStudioDerivedTargetsFromStudioAllocations(
          current,
          nextStudioTargetAllocations,
          areas,
          people,
          getAffectedStudioHunterKeys(undefined, previous),
        ));
        setSpecialistHunterStudioAssignments((current) => current.filter((item) => item.studioTargetAllocationId !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir a meta de área/studio. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveSpecialistHunterStudioAssignments: async (input) => {
      try {
        const data = await repository.saveSpecialistHunterStudioAssignments(input);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar a meta do Hunter Especializado. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveStudioBaselineSnapshot: async (snapshot) => {
      try {
        const saved = await repository.saveStudioBaselineSnapshot(snapshot);
        setStudioBaselineSnapshots((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setError("");
        return saved;
      } catch (error) {
        const message = `Não foi possível salvar a foto do baseline de studios. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    savePersonCustomerTargets: async (input) => {
      try {
        const data = await repository.savePersonCustomerTargets(input);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível salvar as metas da pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    removePersonCustomerTargets: async (input) => {
      try {
        const data = await repository.removePersonCustomerTargets(input);
        applyDeliveryData(data);
      } catch (error) {
        const message = `Não foi possível remover o cliente da pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
  }), [applyDeliveryData, areaUsages, areas, boardTargetBaselines, customerTargets, customers, error, loading, people, personCompensations, repository, specialistHunterStudioAssignments, studioBaselineSnapshots, studioTargetAllocations, subjects, targetAllocations]);

  return <DeliveryStoreContext.Provider value={value}>{children}</DeliveryStoreContext.Provider>;
}

export function useDeliveryStore() {
  const context = useContext(DeliveryStoreContext);
  if (!context) {
    throw new Error("useDeliveryStore must be used inside DeliveryStoreProvider");
  }
  return context;
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}

interface StudioHunterSyncKey {
  customerId: string;
  personId: string;
  year: number;
}

function getAffectedStudioHunterKeys(
  saved: StudioTargetAllocation | undefined,
  previous: StudioTargetAllocation | undefined,
) {
  const byKey = new Map<string, StudioHunterSyncKey>();
  for (const allocation of [saved, previous]) {
    if (!allocation) continue;
    for (const personId of [allocation.hunterPersonId, allocation.maintenancePersonId]) {
      if (!personId) continue;
      const key = `${allocation.customerId}|${personId}|${allocation.year}`;
      byKey.set(key, {
        customerId: allocation.customerId,
        personId,
        year: allocation.year,
      });
    }
  }
  return Array.from(byKey.values());
}

function syncStudioDerivedTargetsFromStudioAllocations(
  targetAllocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  areas: Area[],
  people: Person[],
  affectedKeys: StudioHunterSyncKey[],
) {
  if (!affectedKeys.length) return targetAllocations;
  let nextTargetAllocations = targetAllocations;

  for (const key of affectedKeys) {
    nextTargetAllocations = syncDerivedTargetFromStudioAllocations(nextTargetAllocations, studioAllocations, areas, people, key, "hunter");
    nextTargetAllocations = syncDerivedTargetFromStudioAllocations(nextTargetAllocations, studioAllocations, areas, people, key, "farmer_renewal");
  }

  return nextTargetAllocations;
}

function syncDerivedTargetFromStudioAllocations(
  targetAllocations: TargetAllocation[],
  studioAllocations: StudioTargetAllocation[],
  areas: Area[],
  people: Person[],
  key: StudioHunterSyncKey,
  type: "hunter" | "farmer_renewal",
) {
  const existing = targetAllocations.find((allocation) =>
    allocation.customerId === key.customerId
    && allocation.personId === key.personId
    && allocation.type === type
    && allocation.year === key.year
  );
  const derivedAmount = type === "hunter"
    ? roundCurrency(studioAllocations
      .filter((allocation) =>
        allocation.customerId === key.customerId
        && allocation.hunterPersonId === key.personId
        && allocation.year === key.year
      )
      .reduce((total, allocation) => total + allocation.hunterAmount, 0))
    : getEligibleStudioRenewalAmountForPerson({
      allocations: studioAllocations,
      areas,
      people,
      customerId: key.customerId,
      personId: key.personId,
      year: key.year,
    });
  const ownAmount = getTargetOwnAmount(existing, derivedAmount);
  const totalAmount = roundCurrency(ownAmount + derivedAmount);

  if (totalAmount <= 0.01) {
    return existing
      ? targetAllocations.filter((allocation) => allocation.id !== existing.id)
      : targetAllocations;
  }

  return upsert(targetAllocations, {
    id: existing?.id ?? `target-${key.customerId}-${key.personId}-${type.replace("_", "-")}-${key.year}`,
    customerId: key.customerId,
    personId: key.personId,
    type,
    year: key.year,
    amount: totalAmount,
    ownAmount,
    notes: existing?.notes ?? (type === "hunter"
      ? "Meta Hunter total recalculada a partir da meta própria e dos Studios."
      : "Meta Renovação total recalculada a partir da meta própria e dos Studios elegíveis."),
  });
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message.toLowerCase().includes("row-level security policy")) {
    return "Seu usuário ainda não tem permissão de edição no Supabase. Execute a correção de RLS no SQL Editor do projeto.";
  }
  if (message.toLowerCase().includes("foreign key constraint")) {
    return "Este registro ainda está vinculado a outros dados. Reclassifique ou desvincule os itens dependentes antes de excluir.";
  }
  if (message) return message;
  return "Verifique os dados, permissões e conexão.";
}
