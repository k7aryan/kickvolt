import type { Metadata } from "next";
import Roulette from "@/components/casino/Roulette";

export const metadata: Metadata = { title: "Roulette" };

export default function Page() {
  return <Roulette />;
}
