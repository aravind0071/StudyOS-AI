"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KnowledgeGraphPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="card p-8 text-center max-w-md mx-auto">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Redirecting to Dashboard...</p>
      </div>
    </div>
  );
}
