"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { syncMockAction } from "@/actions/interop";
import { Button } from "@/components/ui/button";

export function SyncButton({ source, entity, label }: { source: string; entity: string; label?: string }) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => {
        setMessage(null);
        const fd = new FormData();
        fd.set("source", source);
        fd.set("entity", entity);
        startTransition(async () => {
          const result = await syncMockAction(fd);
          setMessage({ ok: result.ok, text: result.message });
          if (result.ok) router.refresh();
        });
      }}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        {label ?? "Synchroniser"}
      </Button>
      {message && <span className={`text-[10px] font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</span>}
    </div>
  );
}
