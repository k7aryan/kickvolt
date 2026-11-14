import type { Metadata } from "next";
import FootballBets from "@/components/casino/FootballBets";

export const metadata: Metadata = { title: "Football Bets" };

export default function Page() {
  return <FootballBets />;
}
