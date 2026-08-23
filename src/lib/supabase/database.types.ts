/**
 * Tipos do banco.
 *
 * Este arquivo e GERADO. Depois de qualquer migration:
 *   npm run db:types
 *
 * O conteudo abaixo e um esqueleto escrito a mao para a Sprint 0 compilar antes
 * do primeiro `supabase start`. Ele sera sobrescrito pela geracao real.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole =
  | "gestor_master" | "administrativo" | "supervisor_rede"
  | "consultor_campo" | "suporte_tecnico" | "comercial" | "consulta";

export type EligibilityModeDb = "all" | "allowlist" | "denylist";
export type SegmentRuleTypeDb = "allow" | "deny";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; full_name: string; email: string; role: UserRole;
          team_id: string | null; phone: string | null; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id: string; full_name: string; email: string; role?: UserRole;
          team_id?: string | null; phone?: string | null; is_active?: boolean;
        };
        Update: {
          full_name?: string; phone?: string | null;
          role?: UserRole; team_id?: string | null; is_active?: boolean;
        };
      };
      teams: {
        Row: {
          id: string; name: string; supervisor_id: string | null;
          is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: { name: string; supervisor_id?: string | null; is_active?: boolean };
        Update: { name?: string; supervisor_id?: string | null; is_active?: boolean };
      };
      card_products: {
        Row: {
          id: string; name: string; slug: string; eligibility_mode: EligibilityModeDb;
          description: string | null; display_order: number; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          name: string; slug: string; eligibility_mode?: EligibilityModeDb;
          description?: string | null; display_order?: number; is_active?: boolean;
        };
        Update: {
          name?: string; eligibility_mode?: EligibilityModeDb;
          description?: string | null; display_order?: number; is_active?: boolean;
        };
      };
      segments: {
        Row: {
          id: string; source_name: string; normalized_name: string; category: string;
          cnae_hint: string | null; is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          source_name: string; normalized_name: string; category?: string;
          cnae_hint?: string | null; is_active?: boolean;
        };
        Update: { normalized_name?: string; category?: string; cnae_hint?: string | null; is_active?: boolean };
      };
      product_segments: {
        Row: {
          id: string; card_product_id: string; segment_id: string;
          rule_type: SegmentRuleTypeDb; created_by: string | null; created_at: string;
        };
        Insert: {
          card_product_id: string; segment_id: string;
          rule_type: SegmentRuleTypeDb; created_by?: string | null;
        };
        Update: { rule_type?: SegmentRuleTypeDb };
      };
      system_settings: {
        Row: {
          key: string; value: Json; value_type: string; unit: string | null;
          min_value: number | null; max_value: number | null; description: string;
          min_role: UserRole; updated_by: string | null; updated_at: string;
        };
        Insert: never;
        Update: { value?: Json; updated_by?: string | null };
      };
      audit_logs: {
        Row: {
          id: number; occurred_at: string; actor_id: string | null;
          actor_role: UserRole | null; action: string; entity: string;
          entity_id: string | null; old_value: Json | null; new_value: Json | null;
          changed_fields: string[] | null; origin: string;
          ip_address: string | null; user_agent: string | null; reason: string | null;
        };
        Insert: never;  // apenas via fn_audit
        Update: never;  // log editavel nao e log
      };
    };
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      calculate_transaction_status: {
        Args: {
          p_last_transaction_at: string | null;
          p_recent_days?: number; p_attention_days?: number; p_action_days?: number;
        };
        Returns: string;
      };
      is_segment_eligible: {
        Args: { p_mode: EligibilityModeDb; p_rule: SegmentRuleTypeDb | null };
        Returns: boolean;
      };
      eligible_segments: { Args: { p_card_product_id: string }; Returns: { segment_id: string }[] };
    };
    Enums: { user_role: UserRole; eligibility_mode: EligibilityModeDb; segment_rule_type: SegmentRuleTypeDb };
  };
}
