"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { clockAction } from "@/actions/planning";
import { Button } from "@/components/ui/button";

export function ClockButton({ shiftId, action, label }: { shiftId: string; action: "IN" | "OUT"; label: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");
  const router = useRouter();
  return (
    <div>
      <Button size="sm" variant={action === "IN" ? "default" : "outline"} disabled={pending} onClick={() => {
        const fd = new FormData();
        fd.set("shiftId", shiftId);
        fd.set("action", action);
        startTransition(async () => {
          const result = await clockAction(fd);
          if (result.ok) router.refresh(); else setError(result.message);
        });
      }}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : action === "IN" ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
        {label}
      </Button>
      {error && <span className="block text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
