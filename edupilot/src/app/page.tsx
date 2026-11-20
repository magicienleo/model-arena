import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureSeeded } from "@/lib/bootstrap";

export default async function Home() {
  await ensureSeeded();
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}
