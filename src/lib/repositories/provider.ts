import { isSupabaseConfigured } from "@/lib/supabase/client";
import { localDeliveryRepository } from "./localDeliveryRepository";
import { createSupabaseDeliveryRepository } from "./supabaseDeliveryRepository";
import type { DeliveryRepository } from "./types";

export type PersistenceProvider = "supabase" | "local-dev" | "unavailable";

export interface DeliveryRepositorySelection {
  provider: PersistenceProvider;
  repository: DeliveryRepository;
  useEmptyInitialData: boolean;
}

export const productionConfigurationError = "Supabase não está configurado para produção. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel antes de usar a aplicação.";

export function resolvePersistenceProvider() {
  if (isSupabaseConfigured()) return "supabase";
  if (process.env.NODE_ENV === "production") return "unavailable";
  return "local-dev";
}

export function createDeliveryRepositorySelection(): DeliveryRepositorySelection {
  const provider = resolvePersistenceProvider();
  if (provider === "supabase") {
    return {
      provider,
      repository: createSupabaseDeliveryRepository() ?? unavailableProductionRepository,
      useEmptyInitialData: false,
    };
  }
  if (provider === "unavailable") {
    return {
      provider,
      repository: unavailableProductionRepository,
      useEmptyInitialData: true,
    };
  }
  return {
    provider,
    repository: localDeliveryRepository,
    useEmptyInitialData: false,
  };
}

const unavailableProductionRepository: DeliveryRepository = {
  async getAll() {
    throw new Error(productionConfigurationError);
  },
  async findCustomerById() {
    throw new Error(productionConfigurationError);
  },
  async findPersonById() {
    throw new Error(productionConfigurationError);
  },
  async saveArea() {
    throw new Error(productionConfigurationError);
  },
  async deleteArea() {
    throw new Error(productionConfigurationError);
  },
  async savePerson() {
    throw new Error(productionConfigurationError);
  },
  async savePersonCompensation() {
    throw new Error(productionConfigurationError);
  },
  async deletePersonCompensation() {
    throw new Error(productionConfigurationError);
  },
  async deletePerson() {
    throw new Error(productionConfigurationError);
  },
  async saveCustomer() {
    throw new Error(productionConfigurationError);
  },
  async saveCustomers() {
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
  async saveStudioTargetAllocation() {
    throw new Error(productionConfigurationError);
  },
  async deleteStudioTargetAllocation() {
    throw new Error(productionConfigurationError);
  },
  async saveSpecialistHunterStudioAssignments() {
    throw new Error(productionConfigurationError);
  },
  async saveStudioBaselineSnapshot() {
    throw new Error(productionConfigurationError);
  },
  async saveTargetBaselineSnapshot() {
    throw new Error(productionConfigurationError);
  },
  async savePersonCustomerTargets() {
    throw new Error(productionConfigurationError);
  },
  async removePersonCustomerTargets() {
    throw new Error(productionConfigurationError);
  },
  async getDashboardSummary() {
    throw new Error(productionConfigurationError);
  },
};
