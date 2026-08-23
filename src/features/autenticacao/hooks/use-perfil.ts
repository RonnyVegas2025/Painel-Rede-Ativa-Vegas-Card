"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/user";

interface UsePerfilResult {
  perfil: Profile | null;
  carregando: boolean;
  erro: string | null;
}

/**
 * Perfil no cliente, para componentes interativos.
 *
 * Sempre que der, prefira passar o perfil por prop a partir de um Server
 * Component: e uma ida a menos ao banco e evita o piscar do estado de carga.
 */
export function usePerfil(): UsePerfilResult {
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (ativo) {
          setPerfil(null);
          setCarregando(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, team_id, phone, is_active, created_at, updated_at")
        .eq("id", user.id)
        .single();

      if (!ativo) return;

      if (error || !data) {
        setErro("Não foi possível carregar seu perfil.");
      } else {
        setPerfil({
          id: data.id,
          fullName: data.full_name,
          email: data.email,
          role: data.role,
          teamId: data.team_id,
          phone: data.phone,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, []);

  return { perfil, carregando, erro };
}
