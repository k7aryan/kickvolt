import { Suspense } from "react";
import type { Metadata } from "next";
import Chat from "@/components/Chat";

export const metadata: Metadata = { title: "Ask AI" };

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={null}>
        <Chat />
      </Suspense>
    </div>
  );
}
