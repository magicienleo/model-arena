import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureSeeded } from "@/lib/bootstrap";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  await ensureSeeded();
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return <LoginForm />;
}
