"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { areas as initialAreas, customers as initialCustomers, people as initialPeople, subjects as initialSubjects, targetAllocations as initialTargetAllocations } from "@/data/mockData";
import type { Area, Customer, Person, Subject, TargetAllocation } from "@/data/mockData";
import { createSupabaseDeliveryRepository, localDeliveryRepository } from "@/lib/repositories";
import type { DeliveryRepository, PersonCustomerRemovalInput, PersonCustomerTargetsInput } from "@/lib/repositories";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface DeliveryStoreValue {
  people: Person[];
  customers: Customer[];
  subjects: Subject[];
  areas: Area[];
  targetAllocations: TargetAllocation[];
  loading: boolean;
  error: string;
  clearError: () => void;
  savePerson: (person: Person) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  saveCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  saveSubject: (subject: Subject) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveTargetAllocation: (allocation: TargetAllocation) => Promise<void>;
  deleteTargetAllocation: (id: string) => Promise<void>;
  savePersonCustomerTargets: (input: PersonCustomerTargetsInput) => Promise<void>;
  removePersonCustomerTargets: (input: PersonCustomerRemovalInput) => Promise<void>;
}

const DeliveryStoreContext = createContext<DeliveryStoreValue | null>(null);

export function DeliveryStoreProvider({ children }: { children: React.ReactNode }) {
  const productionWithoutSupabase = process.env.NODE_ENV === "production" && !isSupabaseConfigured();
  const [people, setPeople] = useState<Person[]>(productionWithoutSupabase ? [] : initialPeople);
  const [customers, setCustomers] = useState<Customer[]>(productionWithoutSupabase ? [] : initialCustomers);
  const [subjects, setSubjects] = useState<Subject[]>(productionWithoutSupabase ? [] : initialSubjects);
  const [areas, setAreas] = useState<Area[]>(productionWithoutSupabase ? [] : initialAreas);
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>(productionWithoutSupabase ? [] : initialTargetAllocations);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const repository = useMemo(
    () => createSupabaseDeliveryRepository() ?? (productionWithoutSupabase ? unavailableProductionRepository : localDeliveryRepository),
    [productionWithoutSupabase],
  );

  useEffect(() => {
    let active = true;
    repository.getAll()
      .then((data) => {
        if (!active) return;
        setPeople(data.people);
        setCustomers(data.customers);
        setSubjects(data.subjects);
        setAreas(data.areas);
        setTargetAllocations(data.targetAllocations);
        setError("");
      })
      .catch((error) => setError(`Não foi possível carregar os dados persistidos. Nenhuma alteração será considerada salva. ${getErrorMessage(error)}`))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [repository]);

  const value = useMemo<DeliveryStoreValue>(() => ({
    people,
    customers,
    subjects,
    areas,
    targetAllocations,
    loading,
    error,
    clearError: () => setError(""),
    savePerson: async (person) => {
      try {
        const data = await repository.savePerson(person);
        setPeople(data.people);
        setCustomers(data.customers);
        setSubjects(data.subjects);
        setAreas(data.areas);
        setTargetAllocations(data.targetAllocations);
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar a pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deletePerson: async (id) => {
      try {
        await repository.deletePerson(id);
        setPeople((current) => current.filter((item) => item.id !== id));
        setTargetAllocations((current) => current.filter((item) => item.personId !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir a pessoa. Verifique vínculos e permissões. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveCustomer: async (customer) => {
      try {
        const data = await repository.saveCustomer(customer);
        setPeople(data.people);
        setCustomers(data.customers);
        setSubjects(data.subjects);
        setAreas(data.areas);
        setTargetAllocations(data.targetAllocations);
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar o cliente. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    deleteCustomer: async (id) => {
      try {
        await repository.deleteCustomer(id);
        setCustomers((current) => current.filter((item) => item.id !== id));
        setSubjects((current) => current.filter((item) => item.customerId !== id));
        setTargetAllocations((current) => current.filter((item) => item.customerId !== id));
        setError("");
      } catch (error) {
        const message = `Não foi possível excluir o cliente. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    saveSubject: async (subject) => {
      try {
        await repository.saveSubject(subject);
        setSubjects((current) => upsert(current, subject));
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
    savePersonCustomerTargets: async (input) => {
      try {
        const data = await repository.savePersonCustomerTargets(input);
        setPeople(data.people);
        setCustomers(data.customers);
        setSubjects(data.subjects);
        setAreas(data.areas);
        setTargetAllocations(data.targetAllocations);
        setError("");
      } catch (error) {
        const message = `Não foi possível salvar as metas da pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
    removePersonCustomerTargets: async (input) => {
      try {
        const data = await repository.removePersonCustomerTargets(input);
        setPeople(data.people);
        setCustomers(data.customers);
        setSubjects(data.subjects);
        setAreas(data.areas);
        setTargetAllocations(data.targetAllocations);
        setError("");
      } catch (error) {
        const message = `Não foi possível remover o cliente da pessoa. ${getErrorMessage(error)}`;
        setError(message);
        throw new Error(message);
      }
    },
  }), [areas, customers, error, loading, people, repository, subjects, targetAllocations]);

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

function getErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message.toLowerCase().includes("row-level security policy")) {
    return "Seu usuário ainda não tem permissão de edição no Supabase. Execute a correção de RLS no SQL Editor do projeto.";
  }
  if (message) return message;
  return "Verifique os dados, permissões e conexão.";
}

const productionConfigurationError = "Supabase não está configurado para produção. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel antes de usar a aplicação.";

const unavailableProductionRepository: DeliveryRepository = {
  async getAll() {
    throw new Error(productionConfigurationError);
  },
  async savePerson() {
    throw new Error(productionConfigurationError);
  },
  async deletePerson() {
    throw new Error(productionConfigurationError);
  },
  async saveCustomer() {
    throw new Error(productionConfigurationError);
  },
  async deleteCustomer() {
    throw new Error(productionConfigurationError);
  },
  async saveSubject() {
    throw new Error(productionConfigurationError);
  },
  async deleteSubject() {
    throw new Error(productionConfigurationError);
  },
  async saveTargetAllocation() {
    throw new Error(productionConfigurationError);
  },
  async deleteTargetAllocation() {
    throw new Error(productionConfigurationError);
  },
  async savePersonCustomerTargets() {
    throw new Error(productionConfigurationError);
  },
  async removePersonCustomerTargets() {
    throw new Error(productionConfigurationError);
  },
};
