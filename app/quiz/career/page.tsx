import type { Metadata } from "next";
import CareerGame from "@/components/CareerGame";

export const metadata: Metadata = { title: "Guess the Player" };

export default function Page() {
  return <CareerGame />;
}
