import { createLocalDeliveryRepository } from "@/lib/repositories/localDeliveryRepository";
import { runDeliveryRepositoryContractTests } from "./deliveryRepository.contract";

export function runLocalDeliveryRepositoryContractTests() {
  return runDeliveryRepositoryContractTests({
    providerName: "localDeliveryRepository",
    createRepository: createLocalDeliveryRepository,
  });
}
