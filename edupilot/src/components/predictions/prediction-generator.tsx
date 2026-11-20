"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { generatePredictionsAction } from "@/actions/predictions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function PredictionGenerator({ canGenerate }: { canGenerate: boolean }) {
  const [days, setDays] = React.useState("7");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  if (!canGenerate) return null;
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <Select value={days} onChange={(e) => setDays(e.target.value)} className="h-10 w-[110px]" aria-label="Horizon de prévision">
        <option value="7">7 jours</option>
        <option value="14">14 jours</option>
      </Select>
      <Button
        disabled={pending}
        onClick={() => {
          setMessage(null);
          const fd = new FormData();
          fd.set("days", days);
          startTransition(async () => {
            const result = await generatePredictionsAction(fd);
            setMessage({ ok: result.ok, text: result.message });
            if (result.ok) router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {pending ? "Calcul en cours…" : "Recalculer les prévisions"}
      </Button>
      {message && (
        <span className={`self-center text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
          {message.text}
        </span>
      )}
    </div>
  );
}
