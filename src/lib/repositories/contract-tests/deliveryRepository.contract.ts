import type { Person, StudioTargetAllocation } from "@/data/mockData";
import type { DeliveryData, DeliveryRepository } from "@/lib/repositories/types";

type RepositoryFactory = () => DeliveryRepository | Promise<DeliveryRepository>;

export async function runDeliveryRepositoryContractTests({
  providerName,
  createRepository,
}: {
  providerName: string;
  createRepository: RepositoryFactory;
}) {
  await runContractTest(providerName, "getAll returns a complete isolated read model", async () => {
    const repository = await createRepository();
    const firstRead = await repository.getAll();

    assert(firstRead.people.length > 0, "Expected people in read model.");
    assert(firstRead.customers.length > 0, "Expected customers in read model.");
    assert(firstRead.customerTargets.length > 0, "Expected customerTargets in read model.");
    assert(Array.isArray(firstRead.targetAllocations), "Expected targetAllocations array.");
    assert(Array.isArray(firstRead.studioTargetAllocations), "Expected studioTargetAllocations array.");
    assert(Array.isArray(firstRead.targetBaselineSnapshots), "Expected targetBaselineSnapshots array.");

    const originalName = firstRead.people[0]?.name;
    firstRead.people[0] = { ...firstRead.people[0]!, name: "Mutated outside repository" };

    const secondRead = await repository.getAll();
    assertEqual(secondRead.people[0]?.name, originalName, "getAll must not expose mutable repository state.");
  });

  await runContractTest(providerName, "savePersonCustomerTargets persists own Hunter, current Hunter and Renewal facts", async () => {
    const repository = await createRepository();
    const { customer, hunter } = await seedHunter(repository);

    const data = await repository.savePersonCustomerTargets({
      customerId: customer.id,
      personId: hunter.id,
      year: 2026,
      hunterAmount: 120,
      hunterOwnAmount: 120,
      farmerRenewalAmount: 35,
      studioAmount: 0,
      increaseCustomerTarget: false,
      notes: "Contract test target.",
    });

    const hunterAllocation = findTargetAllocation(data, customer.id, hunter.id, "hunter");
    assertEqual(hunterAllocation.amount, 120, "Hunter current target should match own amount without Studio Hunter.");
    assertEqual(hunterAllocation.ownAmount, 120, "Hunter own amount should be persisted separately.");

    const renewalAllocation = findTargetAllocation(data, customer.id, hunter.id, "farmer_renewal");
    assertEqual(renewalAllocation.amount, 35, "Renewal/Amplification target should be persisted.");

    const assignedHunter = data.people.find((person) => person.id === hunter.id);
    assert(assignedHunter?.clientIds.includes(customer.id), "Saving Hunter target should create the person/customer assignment.");
  });

  await runContractTest(providerName, "savePersonCustomerTargets allows Specialist Hunter only as customer Hunter", async () => {
    const repository = await createRepository();
    const data = await repository.getAll();
    const customer = data.customers[0];
    const area = data.areas[0];

    assert(customer, "Contract test requires at least one customer fixture.");
    assert(area, "Contract test requires at least one area fixture.");

    const specialistHunter: Person = {
      id: `contract-specialist-hunter-${customer.id}`,
      name: "Contract Specialist Hunter",
      email: `contract-specialist-hunter-${customer.id}@brq.com`,
      jobTitle: "Hunter Especializado",
      directorId: undefined,
      managerId: undefined,
      roleType: "Hunter Especializado",
      areaId: area.id,
      clientIds: [],
      photoUrl: undefined,
      notes: undefined,
      active: true,
      lifecycleStatus: "active",
      closedAt: undefined,
      closedReason: undefined,
      isManager: false,
      hierarchyLevel: 3,
    };

    await repository.savePerson(specialistHunter);

    let blocked = false;
    try {
      await repository.savePersonCustomerTargets({
        customerId: customer.id,
        personId: specialistHunter.id,
        year: 2026,
        hunterAmount: 100,
        hunterOwnAmount: 100,
        farmerRenewalAmount: 0,
        studioAmount: 0,
        increaseCustomerTarget: false,
        notes: "Contract test blocked specialist direct target.",
      });
    } catch {
      blocked = true;
    }
    assert(blocked, "Specialist Hunter must remain blocked without the customer Hunter override.");

    const saved = await repository.savePersonCustomerTargets({
      customerId: customer.id,
      personId: specialistHunter.id,
      year: 2026,
      hunterAmount: 100,
      hunterOwnAmount: 100,
      farmerRenewalAmount: 0,
      studioAmount: 0,
      increaseCustomerTarget: false,
      allowSpecialistHunterAsCustomerHunter: true,
      notes: "Contract test customer Hunter specialist target.",
    });

    const allocation = findTargetAllocation(saved, customer.id, specialistHunter.id, "hunter");
    assertEqual(allocation.amount, 100, "Specialist Hunter should work as customer Hunter when explicitly selected in customer flow.");
    const assignedSpecialist = saved.people.find((person) => person.id === specialistHunter.id);
    assert(assignedSpecialist?.clientIds.includes(customer.id), "Customer Hunter override should create the person/customer assignment.");
  });

  await runContractTest(providerName, "saveCustomer accepts Farmer/Delivery responsible people even when isManager is stale", async () => {
    const repository = await createRepository();
    const data = await repository.getAll();
    const customer = data.customers[0];
    const area = data.areas[0];

    assert(customer, "Contract test requires at least one customer fixture.");
    assert(area, "Contract test requires at least one area fixture.");

    const farmer: Person = {
      id: `contract-responsible-farmer-${customer.id}`,
      name: "Contract Responsible Farmer",
      email: `contract-responsible-farmer-${customer.id}@brq.com`,
      jobTitle: "Farmer",
      directorId: undefined,
      managerId: undefined,
      roleType: "Farmer",
      areaId: area.id,
      clientIds: [],
      photoUrl: undefined,
      notes: undefined,
      active: true,
      lifecycleStatus: "active",
      closedAt: undefined,
      closedReason: undefined,
      isManager: false,
      hierarchyLevel: 3,
    };

    await repository.savePerson(farmer);
    const nextData = await repository.saveCustomer({
      ...customer,
      managerResponsibleIds: [farmer.id],
    }, 2026);

    const savedCustomer = nextData.customers.find((item) => item.id === customer.id);
    const savedFarmer = nextData.people.find((item) => item.id === farmer.id);
    assert(savedCustomer?.managerResponsibleIds.includes(farmer.id), "Customer should include the Farmer responsible person.");
    assert(savedFarmer?.clientIds.includes(customer.id), "Farmer responsible person should include the customer assignment.");
  });

  await runContractTest(providerName, "saveStudioTargetAllocation preserves own Hunter and refreshes current Hunter total", async () => {
    const repository = await createRepository();
    const { area, customer, hunter } = await seedHunter(repository);

    await repository.savePersonCustomerTargets({
      customerId: customer.id,
      personId: hunter.id,
      year: 2026,
      hunterAmount: 100,
      hunterOwnAmount: 100,
      farmerRenewalAmount: 0,
      studioAmount: 0,
      increaseCustomerTarget: false,
      notes: "Contract test own Hunter target.",
    });

    const studioAllocation: StudioTargetAllocation = {
      id: `contract-studio-${customer.id}-${hunter.id}`,
      customerId: customer.id,
      areaId: area.id,
      hunterPersonId: hunter.id,
      year: 2026,
      hunterAmount: 40,
      maintenanceAmount: 15,
      notes: "Contract test Studio allocation.",
    };

    const savedStudioAllocation = await repository.saveStudioTargetAllocation(studioAllocation);
    assertEqual(savedStudioAllocation.hunterAmount, 40, "Studio Hunter amount should be saved.");
    assertEqual(savedStudioAllocation.maintenanceAmount, 15, "Studio maintenance amount should be saved.");

    const data = await repository.getAll();
    const hunterAllocation = findTargetAllocation(data, customer.id, hunter.id, "hunter");
    assertEqual(hunterAllocation.ownAmount, 100, "Studio save must preserve editable own Hunter amount.");
    assertEqual(hunterAllocation.amount, 140, "Hunter current target should equal own Hunter plus Studio Hunter.");

    const savedStudioRows = data.studioTargetAllocations.filter((allocation) =>
      allocation.customerId === customer.id
      && allocation.areaId === area.id
      && allocation.hunterPersonId === hunter.id
      && allocation.year === 2026
    );
    assertEqual(savedStudioRows.length, 1, "Studio allocation grain should be unique by customer, area, hunter and year.");
  });

  await runContractTest(providerName, "saveStudioTargetAllocation allows Specialist Hunter as Studio Hunter", async () => {
    const repository = await createRepository();
    const data = await repository.getAll();
    const customer = data.customers[0];
    const area = data.areas[0];

    assert(customer, "Contract test requires at least one customer fixture.");
    assert(area, "Contract test requires at least one area fixture.");

    const specialistHunter: Person = {
      id: `contract-studio-specialist-${customer.id}`,
      name: "Contract Studio Specialist Hunter",
      email: `contract-studio-specialist-${customer.id}@brq.com`,
      jobTitle: "Hunter Especializado",
      directorId: undefined,
      managerId: undefined,
      roleType: "Hunter Especializado",
      areaId: area.id,
      clientIds: [],
      photoUrl: undefined,
      notes: undefined,
      active: true,
      lifecycleStatus: "active",
      closedAt: undefined,
      closedReason: undefined,
      isManager: false,
      hierarchyLevel: 3,
    };

    await repository.savePerson(specialistHunter);

    const savedStudioAllocation = await repository.saveStudioTargetAllocation({
      id: `contract-studio-specialist-${customer.id}-${specialistHunter.id}`,
      customerId: customer.id,
      areaId: area.id,
      hunterPersonId: specialistHunter.id,
      year: 2026,
      hunterAmount: 50,
      maintenanceAmount: 0,
      notes: "Contract test Specialist Hunter Studio allocation.",
    });

    assertEqual(savedStudioAllocation.hunterAmount, 50, "Specialist Hunter Studio amount should be saved.");
    const saved = await repository.getAll();
    const hunterAllocation = findTargetAllocation(saved, customer.id, specialistHunter.id, "hunter");
    assertEqual(hunterAllocation.amount, 50, "Specialist Hunter should receive the derived Hunter target when associated as Studio Hunter.");
  });

  await runContractTest(providerName, "saveStudioTargetAllocation rolls Studio renewal into declared Farmer/Delivery responsibility", async () => {
    const repository = await createRepository();
    const data = await repository.getAll();
    const customer = data.customers[0];
    const renewalArea = data.areas.find((area) => area.name !== "PX");
    const pxArea = data.areas.find((area) => area.name === "PX");

    assert(customer, "Contract test requires at least one customer fixture.");
    assert(renewalArea, "Contract test requires a non-PX Studio fixture.");
    assert(pxArea, "Contract test requires a PX Studio fixture.");

    const farmer: Person = {
      id: `contract-farmer-${customer.id}`,
      name: "Contract Farmer Delivery",
      email: `contract-farmer-${customer.id}@brq.com`,
      jobTitle: "Manager de Delivery",
      directorId: undefined,
      managerId: undefined,
      roleType: "Farmer + Delivery",
      areaId: renewalArea.id,
      clientIds: [],
      photoUrl: undefined,
      notes: undefined,
      active: true,
      lifecycleStatus: "active",
      closedAt: undefined,
      closedReason: undefined,
      isManager: true,
      hierarchyLevel: 3,
    };

    await repository.savePerson(farmer);
    await repository.savePersonCustomerTargets({
      customerId: customer.id,
      personId: farmer.id,
      year: 2026,
      hunterAmount: 0,
      hunterOwnAmount: 0,
      farmerRenewalAmount: 30,
      studioAmount: 0,
      increaseCustomerTarget: false,
      notes: "Contract test own renewal target.",
    });

    await repository.saveStudioTargetAllocation({
      id: `contract-studio-renewal-${customer.id}-${farmer.id}`,
      customerId: customer.id,
      areaId: renewalArea.id,
      hunterPersonId: farmer.id,
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 20,
      notes: "Contract test eligible Studio renewal.",
    });

    let nextData = await repository.getAll();
    let renewalAllocation = findTargetAllocation(nextData, customer.id, farmer.id, "farmer_renewal");
    assertEqual(renewalAllocation.ownAmount, 30, "Studio renewal save must preserve editable own Farmer/Delivery amount.");
    assertEqual(renewalAllocation.amount, 50, "Farmer/Delivery current target should equal own renewal plus eligible Studio renewal.");

    await repository.saveStudioTargetAllocation({
      id: `contract-studio-px-${customer.id}-${farmer.id}`,
      customerId: customer.id,
      areaId: pxArea.id,
      hunterPersonId: farmer.id,
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 40,
      notes: "Contract test PX Studio renewal.",
    });

    nextData = await repository.getAll();
    renewalAllocation = findTargetAllocation(nextData, customer.id, farmer.id, "farmer_renewal");
    assertEqual(renewalAllocation.ownAmount, 30, "PX Studio save must preserve editable own Farmer/Delivery amount.");
    assertEqual(renewalAllocation.amount, 90, "PX Studio renewal should roll into the declared Farmer/Delivery target.");
  });
}

async function runContractTest(providerName: string, testName: string, testBody: () => Promise<void>) {
  try {
    await testBody();
    console.log(`ok - ${providerName} - ${testName}`);
  } catch (error) {
    throw new Error(`not ok - ${providerName} - ${testName}\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
}

async function seedHunter(repository: DeliveryRepository) {
  const data = await repository.getAll();
  const customer = data.customers[0];
  const area = data.areas[0];

  assert(customer, "Contract test requires at least one customer fixture.");
  assert(area, "Contract test requires at least one area fixture.");

  const hunter: Person = {
    id: `contract-hunter-${customer.id}`,
    name: "Contract Hunter",
    email: `contract-hunter-${customer.id}@brq.com`,
    jobTitle: "Executivo de Negócios",
    directorId: undefined,
    managerId: undefined,
    roleType: "Hunter",
    areaId: area.id,
    clientIds: [],
    photoUrl: undefined,
    notes: undefined,
    active: true,
    lifecycleStatus: "active",
    closedAt: undefined,
    closedReason: undefined,
    isManager: false,
    hierarchyLevel: 3,
  };

  await repository.savePerson(hunter);
  return { area, customer, hunter };
}

function findTargetAllocation(
  data: DeliveryData,
  customerId: string,
  personId: string,
  type: "hunter" | "farmer_renewal" | "studio",
) {
  const allocation = data.targetAllocations.find((item) =>
    item.customerId === customerId
    && item.personId === personId
    && item.type === type
    && item.year === 2026
  );
  assert(allocation, `Expected ${type} allocation for ${customerId}/${personId}.`);
  return allocation;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${String(expected)}, received ${String(actual)}.`);
  }
}
