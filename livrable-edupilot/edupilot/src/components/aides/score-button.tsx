"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { scoreAidAction } from "@/actions/aides";
import { Button } from "@/components/ui/button";

export function ScoreButton({ aidId, compact = false }: { aidId: string; compact?: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");
  const router = useRouter();
  return (
    <div>
      <Button
        size={compact ? "sm" : "default"}
        variant={compact ? "outline" : "default"}
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await scoreAidAction((() => { const fd = new FormData(); fd.set("aidId", aidId); return fd; })());
          if (result.ok) router.refresh(); else setError(result.message);
        })}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? "Scoring…" : "Scorer avec l'IA"}
      </Button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
