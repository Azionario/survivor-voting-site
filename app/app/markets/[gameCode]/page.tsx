import { redirect } from "next/navigation";

export default function RemovedMarketsPage({
  params,
}: {
  params: { gameCode: string };
}) {
  redirect(`/betting/${params.gameCode}`);
}
