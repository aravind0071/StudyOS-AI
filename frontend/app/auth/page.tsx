"use client";

import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";

export default function Auth() {
  return (
    <Suspense fallback={<div className="min-h-screen hero-gradient flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>}>
      <AuthPage />
    </Suspense>
  );
}
