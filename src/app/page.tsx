export const instant = false;

import ActivityPage from "@/components/activity/ActivityPage";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const shareCode = typeof params.c === "string" ? params.c : undefined;
  const inviterId = typeof params.i === "string" ? params.i : undefined;

  return <ActivityPage shareCode={shareCode} inviterId={inviterId} />;
}
