import type { Metadata } from "next";
import Blackjack from "@/components/casino/Blackjack";

export const metadata: Metadata = { title: "Blackjack" };

export default function Page() {
  return <Blackjack />;
}
