import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-navy-100 text-primary"><Compass className="size-8" /></div>
      <p className="label-caps">Erreur 404</p>
      <h1 className="mt-2 text-3xl font-black text-navy-950">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Le lien est peut-être obsolète ou la ressource n&apos;est pas accessible à votre caisse.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Retour au tableau de bord</Link></Button>
    </div>
  );
}
