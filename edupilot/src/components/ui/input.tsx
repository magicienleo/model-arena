"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "focus-ring flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring flex min-h-[88px] w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 disabled:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("focus-ring h-10 w-full rounded-xl border border-input bg-white px-3 text-sm shadow-sm disabled:bg-muted", className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
