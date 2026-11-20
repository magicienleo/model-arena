"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { uploadAidDocumentAction } from "@/actions/aides";
import { Input } from "@/components/ui/input";

export function DocumentUpload({ aidId }: { aidId: string }) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    const fd = new FormData();
    fd.set("aidId", aidId);
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadAidDocumentAction(fd);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) { router.refresh(); if (fileRef.current) fileRef.current.value = ""; }
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-6 text-center transition hover:border-primary hover:bg-navy-50">
        <UploadCloud className="size-6 text-primary" />
        <span className="text-sm font-semibold text-navy-900">Déposer une pièce justificative</span>
        <span className="text-[11px] text-muted-foreground">PDF, JPEG ou PNG · 5 Mo max · stockage local</span>
        <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }} />
      </label>
      {pending && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Traitement et extraction OCR simulée…</p>}
      {message && <p className={`text-xs font-semibold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}
