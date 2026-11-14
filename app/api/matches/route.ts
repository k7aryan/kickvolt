import { connection } from "next/server";
import { getMatchesForDay, todayKey } from "@/lib/data";

export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const day = url.searchParams.get("day") || todayKey();
  const comp = url.searchParams.get("comp") || undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Response.json({ error: "bad day" }, { status: 400 });
  return Response.json(await getMatchesForDay(day, comp));
}
