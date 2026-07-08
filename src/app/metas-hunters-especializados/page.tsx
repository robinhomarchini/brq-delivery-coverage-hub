import { SpecialistHunterTargetAssignment } from "@/components/targets/specialist-hunter-target-assignment";

type PageProps = {
  searchParams?: Promise<{
    personId?: string;
    year?: string;
  }>;
};

export default async function SpecialistHunterTargetsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <SpecialistHunterTargetAssignment
      initialPersonId={params?.personId ?? ""}
      initialYear={params?.year ? Number(params.year) : undefined}
    />
  );
}
