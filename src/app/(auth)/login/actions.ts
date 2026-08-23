"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/constants/routes";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha tem no mínimo 8 caracteres."),
});

export interface LoginState {
  error: string | null;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Mensagem unica de proposito: distinguir "e-mail nao existe" de "senha
    // errada" entrega ao atacante a lista de quem tem conta.
    return { error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(ROUTES.DASHBOARD);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(ROUTES.LOGIN);
}
