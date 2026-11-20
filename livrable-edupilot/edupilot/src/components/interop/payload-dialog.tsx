"use client";

import { Braces } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PayloadDialog({ title, subtitle, payload }: { title: string; subtitle: string; payload: unknown }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="sm"><Braces className="size-4" /> JSON</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{subtitle}</DialogDescription></DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-navy-950 p-4 text-[11px] leading-relaxed text-emerald-200">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
