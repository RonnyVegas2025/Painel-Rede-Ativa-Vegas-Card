"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHelp, Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 h-[50px] w-full" loading={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const errorId = useId();

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          invalid={state.error !== null}
          aria-describedby={state.error ? errorId : undefined}
        />
      </div>

      <div>
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            invalid={state.error !== null}
            aria-describedby={state.error ? errorId : undefined}
            className="pr-24"
          />
          {/* §7: botão Mostrar senha. */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-[var(--vg-radius-sm)] px-2 text-[length:var(--vg-text-body)] text-[var(--vg-brand-500)] transition-colors hover:bg-[var(--vg-brand-50)]"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {/* §12: erro no mesmo lugar da ajuda contextual, em linguagem objetiva. */}
      {state.error && (
        <FieldHelp id={errorId} error>
          {state.error}
        </FieldHelp>
      )}

      <SubmitButton />
    </form>
  );
}
