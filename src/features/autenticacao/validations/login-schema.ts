import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha tem no mínimo 8 caracteres."),
});

export type LoginInput = z.infer<typeof loginSchema>;
