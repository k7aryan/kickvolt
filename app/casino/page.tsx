import type { Metadata } from "next";
import Lobby from "@/components/casino/Lobby";

export const metadata: Metadata = { title: "Arcade" };

export default function CasinoPage() {
  return <Lobby />;
}
