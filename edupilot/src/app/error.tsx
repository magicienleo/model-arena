"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ÉduPilot]", error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="size-8" /></div>
      <p className="label-caps">Une erreur est survenue</p>
      <h1 className="mt-2 text-3xl font-black text-navy-950">Impossible d&apos;afficher cette page</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Vos données restent intactes dans la base locale. Réessayez ou contactez l&apos;administrateur.</p>
      <Button className="mt-6" onClick={reset}><RotateCcw className="size-4" /> Réessayer</Button>
    </div>
  );
}
