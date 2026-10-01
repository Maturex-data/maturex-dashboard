import { redirect } from "next/navigation";

export default async function OldEcDriveSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ drive_connected?: string; drive_error?: string }>;
}) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  if (sp.drive_connected) query.set("drive_connected", sp.drive_connected);
  if (sp.drive_error) query.set("drive_error", sp.drive_error);
  const qStr = query.toString();
  redirect(`/ec/drive-sync${qStr ? `?${qStr}` : ""}`);
}
