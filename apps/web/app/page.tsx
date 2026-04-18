"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-6 text-sm text-muted">
      Redirecting...
    </div>
  );
}
