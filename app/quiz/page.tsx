import type { Metadata } from "next";
import Quiz from "@/components/Quiz";

export const metadata: Metadata = { title: "Football Quiz" };

export default function QuizPage() {
  return <Quiz />;
}
