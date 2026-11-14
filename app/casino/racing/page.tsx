import type { Metadata } from "next";
import Racing from "@/components/casino/Racing";

export const metadata: Metadata = { title: "Horse Racing" };

export default function Page() {
  return <Racing />;
}
