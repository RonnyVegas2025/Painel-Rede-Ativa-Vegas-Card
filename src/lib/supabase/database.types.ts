export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      absence_resolutions: {
        Row: {
          absent_from_import: string | null
          establishment_id: string
          id: string
          reason: string
          resolution: Database["public"]["Enums"]["absence_resolution"]
          resolved_at: string
          resolved_by: string | null
          was_absent_since: string | null
        }
        Insert: {
          absent_from_import?: string | null
          establishment_id: string
          id?: string
          reason: string
          resolution: Database["public"]["Enums"]["absence_resolution"]
          resolved_at?: string
          resolved_by?: string | null
          was_absent_since?: string | null
        }
        Update: {
          absent_from_import?: string | null
          establishment_id?: string
          id?: string
          reason?: string
          resolution?: Database["public"]["Enums"]["absence_resolution"]
          resolved_at?: string
          resolved_by?: string | null
          was_absent_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_resolutions_absent_from_import_fkey"
            columns: ["absent_from_import"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          changed_fields: string[] | null
          entity: string
          entity_id: string | null
          id: number
          ip_address: unknown
          new_value: Json | null
          occurred_at: string
          old_value: Json | null
          origin: Database["public"]["Enums"]["audit_origin"]
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          changed_fields?: string[] | null
          entity: string
          entity_id?: string | null
          id?: never
          ip_address?: unknown
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          origin?: Database["public"]["Enums"]["audit_origin"]
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          changed_fields?: string[] | null
          entity?: string
          entity_id?: string | null
          id?: never
          ip_address?: unknown
          new_value?: Json | null
          occurred_at?: string
          old_value?: Json | null
          origin?: Database["public"]["Enums"]["audit_origin"]
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      capture_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          source_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          source_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_products: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          eligibility_mode: Database["public"]["Enums"]["eligibility_mode"]
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          eligibility_mode?: Database["public"]["Enums"]["eligibility_mode"]
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          eligibility_mode?: Database["public"]["Enums"]["eligibility_mode"]
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      establishment_addresses: {
        Row: {
          address_hash: string | null
          cep: string | null
          city: string
          created_at: string
          district: string | null
          establishment_id: string
          id: string
          is_current: boolean
          latitude: number | null
          longitude: number | null
          normalized_address: string | null
          state: string
          street: string
          street_name: string | null
          street_number: string | null
          updated_at: string
        }
        Insert: {
          address_hash?: string | null
          cep?: string | null
          city: string
          created_at?: string
          district?: string | null
          establishment_id: string
          id?: string
          is_current?: boolean
          latitude?: number | null
          longitude?: number | null
          normalized_address?: string | null
          state: string
          street: string
          street_name?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          address_hash?: string | null
          cep?: string | null
          city?: string
          created_at?: string
          district?: string | null
          establishment_id?: string
          id?: string
          is_current?: boolean
          latitude?: number | null
          longitude?: number | null
          normalized_address?: string | null
          state?: string
          street?: string
          street_name?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_addresses_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_capture_points: {
        Row: {
          capture_method_id: string | null
          created_at: string
          establishment_id: string
          id: string
          inactivated_at: string | null
          inactivated_by_import: string | null
          is_primary: boolean | null
          status: Database["public"]["Enums"]["capture_point_status"]
          terminal_number: string | null
          updated_at: string
        }
        Insert: {
          capture_method_id?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          inactivated_at?: string | null
          inactivated_by_import?: string | null
          is_primary?: boolean | null
          status?: Database["public"]["Enums"]["capture_point_status"]
          terminal_number?: string | null
          updated_at?: string
        }
        Update: {
          capture_method_id?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          inactivated_at?: string | null
          inactivated_by_import?: string | null
          is_primary?: boolean | null
          status?: Database["public"]["Enums"]["capture_point_status"]
          terminal_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_capture_points_capture_method_id_fkey"
            columns: ["capture_method_id"]
            isOneToOne: false
            referencedRelation: "capture_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_capture_points_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_capture_points_inactivated_by_import_fkey"
            columns: ["inactivated_by_import"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          absent_from_import: string | null
          absent_since: string | null
          acquisition_channel: string | null
          assigned_consultants_raw: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          external_contract: string | null
          id: string
          is_active: boolean
          last_transaction_at: string | null
          legal_name: string
          never_transacted: boolean
          operational_status: Database["public"]["Enums"]["operational_status"]
          origin: string | null
          phone: string | null
          registration_status: Database["public"]["Enums"]["registration_status"]
          relationship_start_date: string | null
          segment_id: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          absent_from_import?: string | null
          absent_since?: string | null
          acquisition_channel?: string | null
          assigned_consultants_raw?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_contract?: string | null
          id?: string
          is_active?: boolean
          last_transaction_at?: string | null
          legal_name: string
          never_transacted?: boolean
          operational_status?: Database["public"]["Enums"]["operational_status"]
          origin?: string | null
          phone?: string | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          relationship_start_date?: string | null
          segment_id?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          absent_from_import?: string | null
          absent_since?: string | null
          acquisition_channel?: string | null
          assigned_consultants_raw?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          external_contract?: string | null
          id?: string
          is_active?: boolean
          last_transaction_at?: string | null
          legal_name?: string
          never_transacted?: boolean
          operational_status?: Database["public"]["Enums"]["operational_status"]
          origin?: string | null
          phone?: string | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          relationship_start_date?: string | null
          segment_id?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishments_absent_from_import_fkey"
            columns: ["absent_from_import"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segment_normalization_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        Insert: {
          addresses_without_number?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          conflict_count?: number
          created_at?: string
          created_count?: number
          derivado_de_id?: string | null
          duplicated_capture_methods?: number
          error_count?: number
          error_message?: string | null
          file_name: string
          finished_at?: string | null
          id?: string
          missing_count?: number
          requires_confirmation?: boolean
          scope_card_product_id?: string | null
          scope_city?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows?: number
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
          uploaded_by?: string | null
        }
        Update: {
          addresses_without_number?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          conflict_count?: number
          created_at?: string
          created_count?: number
          derivado_de_id?: string | null
          duplicated_capture_methods?: number
          error_count?: number
          error_message?: string | null
          file_name?: string
          finished_at?: string | null
          id?: string
          missing_count?: number
          requires_confirmation?: boolean
          scope_card_product_id?: string | null
          scope_city?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["import_job_status"]
          storage_path?: string
          total_rows?: number
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_derivado_de_id_fkey"
            columns: ["derivado_de_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_scope_card_product_id_fkey"
            columns: ["scope_card_product_id"]
            isOneToOne: false
            referencedRelation: "card_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          error_message: string | null
          establishment_id: string | null
          id: string
          import_id: string
          line_number: number
          raw_data: Json
          status: Database["public"]["Enums"]["import_row_status"]
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          establishment_id?: string | null
          id?: string
          import_id: string
          line_number: number
          raw_data: Json
          status: Database["public"]["Enums"]["import_row_status"]
        }
        Update: {
          created_at?: string
          error_message?: string | null
          establishment_id?: string | null
          id?: string
          import_id?: string
          line_number?: number
          raw_data?: Json
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_segments: {
        Row: {
          card_product_id: string
          created_at: string
          created_by: string | null
          id: string
          rule_type: Database["public"]["Enums"]["segment_rule_type"]
          segment_id: string
        }
        Insert: {
          card_product_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule_type: Database["public"]["Enums"]["segment_rule_type"]
          segment_id: string
        }
        Update: {
          card_product_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule_type?: Database["public"]["Enums"]["segment_rule_type"]
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_segments_card_product_id_fkey"
            columns: ["card_product_id"]
            isOneToOne: false
            referencedRelation: "card_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segment_normalization_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          aponta_canonico: boolean | null
          canonical_segment_id: string | null
          category: string
          cnae_hint: string | null
          created_at: string
          eh_canonico: boolean | null
          id: string
          is_active: boolean
          normalized_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_name: string
          updated_at: string
        }
        Insert: {
          aponta_canonico?: boolean | null
          canonical_segment_id?: string | null
          category?: string
          cnae_hint?: string | null
          created_at?: string
          eh_canonico?: boolean | null
          id?: string
          is_active?: boolean
          normalized_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_name: string
          updated_at?: string
        }
        Update: {
          aponta_canonico?: boolean | null
          canonical_segment_id?: string | null
          category?: string
          cnae_hint?: string | null
          created_at?: string
          eh_canonico?: boolean | null
          id?: string
          is_active?: boolean
          normalized_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_alias_um_nivel"
            columns: ["canonical_segment_id", "aponta_canonico"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "eh_canonico"]
          },
          {
            foreignKeyName: "segments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string
          key: string
          max_value: number | null
          min_role: Database["public"]["Enums"]["user_role"]
          min_value: number | null
          unit: string | null
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          description: string
          key: string
          max_value?: number | null
          min_role?: Database["public"]["Enums"]["user_role"]
          min_value?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type: string
        }
        Update: {
          description?: string
          key?: string
          max_value?: number | null
          min_role?: Database["public"]["Enums"]["user_role"]
          min_value?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_supervisor_fk"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      segment_normalization_queue: {
        Row: {
          canonical_segment_id: string | null
          category: string | null
          cnae_hint: string | null
          establishments_hidden: number | null
          id: string | null
          is_active: boolean | null
          normalized_name: string | null
          source_name: string | null
        }
        Insert: {
          canonical_segment_id?: string | null
          category?: string | null
          cnae_hint?: string | null
          establishments_hidden?: never
          id?: string | null
          is_active?: boolean | null
          normalized_name?: string | null
          source_name?: string | null
        }
        Update: {
          canonical_segment_id?: string | null
          category?: string | null
          cnae_hint?: string | null
          establishments_hidden?: never
          id?: string | null
          is_active?: boolean | null
          normalized_name?: string | null
          source_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      address_hash_input: {
        Args: {
          p_district: string
          p_street_name: string
          p_street_number: string
        }
        Returns: string
      }
      apply_segment_rules: {
        Args: { p_allow: string[]; p_deny: string[]; p_segment_id: string }
        Returns: undefined
      }
      assert_usuario_identificado: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_team_id: { Args: never; Returns: string }
      calculate_transaction_status: {
        Args: {
          p_action_days?: number
          p_attention_days?: number
          p_last_transaction_at: string
          p_recent_days?: number
        }
        Returns: Database["public"]["Enums"]["transaction_status"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      eligible_segment_ids: {
        Args: {
          p_mode: Database["public"]["Enums"]["eligibility_mode"]
          p_rules: Json
          p_segments: Json
        }
        Returns: string[]
      }
      eligible_segments: {
        Args: { p_card_product_id: string }
        Returns: {
          segment_id: string
        }[]
      }
      has_role: {
        Args: { p_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      import_absent_establishments: {
        Args: { p_import_id: string }
        Returns: string[]
      }
      import_absent_summary: { Args: { p_import_id: string }; Returns: Json }
      import_cities: {
        Args: { p_import_id: string }
        Returns: {
          cidade: string
          linhas: number
        }[]
      }
      import_commit: {
        Args: { p_import_id: string }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_create_preview: {
        Args: { p_file_name: string; p_scope_city: string }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_discard: {
        Args: { p_import_id: string; p_motivo: string }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_finalize_preview: {
        Args: {
          p_duplicados?: number
          p_import_id: string
          p_sem_numero?: number
          p_total_lido: number
        }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_finish_redeclaration: {
        Args: { p_novo_id: string }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_redeclare_scope: {
        Args: {
          p_import_id: string
          p_observacao?: string
          p_scope_city: string
        }
        Returns: {
          addresses_without_number: number
          confirmed_at: string | null
          confirmed_by: string | null
          conflict_count: number
          created_at: string
          created_count: number
          derivado_de_id: string | null
          duplicated_capture_methods: number
          error_count: number
          error_message: string | null
          file_name: string
          finished_at: string | null
          id: string
          missing_count: number
          requires_confirmation: boolean
          scope_card_product_id: string | null
          scope_city: string | null
          started_at: string
          status: Database["public"]["Enums"]["import_job_status"]
          storage_path: string
          total_rows: number
          unchanged_count: number
          updated_at: string
          updated_count: number
          uploaded_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_segment_eligible: {
        Args: {
          p_mode: Database["public"]["Enums"]["eligibility_mode"]
          p_rule: Database["public"]["Enums"]["segment_rule_type"]
        }
        Returns: boolean
      }
      normalize_address: {
        Args: { p_cep?: string; p_raw: string }
        Returns: string
      }
      request_ip: { Args: never; Returns: unknown }
      resolve_absences: {
        Args: {
          p_confirmada_quantidade?: number
          p_ids: string[]
          p_reason: string
          p_resolution: Database["public"]["Enums"]["absence_resolution"]
        }
        Returns: number
      }
      resolve_segment_confirm: {
        Args: { p_allow?: string[]; p_deny?: string[]; p_segment_id: string }
        Returns: undefined
      }
      resolve_segment_create: {
        Args: {
          p_allow?: string[]
          p_category: string
          p_deny?: string[]
          p_normalized_name: string
          p_segment_id: string
        }
        Returns: undefined
      }
      resolve_segment_deactivate: {
        Args: { p_segment_id: string }
        Returns: undefined
      }
      resolve_segment_map: {
        Args: {
          p_canonical_id: string
          p_discard?: string[]
          p_migrate?: string[]
          p_segment_id: string
        }
        Returns: undefined
      }
      segment_alias_blockers: {
        Args: { p_segment_id: string }
        Returns: {
          card_product_id: string
          card_product_name: string
          establishments_afetados: number
          rule_type: Database["public"]["Enums"]["segment_rule_type"]
        }[]
      }
    }
    Enums: {
      absence_resolution:
        | "voltou_a_operar"
        | "escopo_incorreto"
        | "nao_opera_mais"
      audit_action: "insert" | "update" | "delete" | "login" | "custom"
      audit_origin: "web" | "import" | "system" | "edge_function"
      capture_point_status:
        | "ativo"
        | "inativo"
        | "em_homologacao"
        | "com_erro"
        | "substituido"
        | "cancelado"
      eligibility_mode: "all" | "allowlist" | "denylist"
      import_job_status:
        | "processando"
        | "previa"
        | "aplicando"
        | "concluida"
        | "cancelada"
        | "falhou"
      import_row_status:
        | "novo"
        | "atualizado"
        | "inalterado"
        | "conflito"
        | "erro"
        | "ausente"
      occurrence_status:
        | "aberta"
        | "em_analise"
        | "aguardando_informacao"
        | "aprovada"
        | "rejeitada"
        | "resolvida"
        | "cancelada"
      operational_status:
        | "apto"
        | "problema_tecnico"
        | "fechado_temporariamente"
        | "encerrado"
        | "mudanca_proprietario"
        | "mudanca_endereco"
        | "equipamento_indisponivel"
        | "bloqueio_solicitado"
        | "suspenso"
        | "em_reativacao"
      registration_status: "ativo" | "bloqueado" | "cancelado" | "em_analise"
      segment_rule_type: "allow" | "deny"
      transaction_status:
        | "recente"
        | "atencao"
        | "acao_necessaria"
        | "critico"
        | "nunca_transacionou"
      user_role:
        | "gestor_master"
        | "administrativo"
        | "supervisor_rede"
        | "consultor_campo"
        | "suporte_tecnico"
        | "comercial"
        | "consulta"
      visit_status:
        | "reservada"
        | "em_deslocamento"
        | "checkin_realizado"
        | "em_atendimento"
        | "concluida"
        | "cancelada"
        | "expirada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      absence_resolution: [
        "voltou_a_operar",
        "escopo_incorreto",
        "nao_opera_mais",
      ],
      audit_action: ["insert", "update", "delete", "login", "custom"],
      audit_origin: ["web", "import", "system", "edge_function"],
      capture_point_status: [
        "ativo",
        "inativo",
        "em_homologacao",
        "com_erro",
        "substituido",
        "cancelado",
      ],
      eligibility_mode: ["all", "allowlist", "denylist"],
      import_job_status: [
        "processando",
        "previa",
        "aplicando",
        "concluida",
        "cancelada",
        "falhou",
      ],
      import_row_status: [
        "novo",
        "atualizado",
        "inalterado",
        "conflito",
        "erro",
        "ausente",
      ],
      occurrence_status: [
        "aberta",
        "em_analise",
        "aguardando_informacao",
        "aprovada",
        "rejeitada",
        "resolvida",
        "cancelada",
      ],
      operational_status: [
        "apto",
        "problema_tecnico",
        "fechado_temporariamente",
        "encerrado",
        "mudanca_proprietario",
        "mudanca_endereco",
        "equipamento_indisponivel",
        "bloqueio_solicitado",
        "suspenso",
        "em_reativacao",
      ],
      registration_status: ["ativo", "bloqueado", "cancelado", "em_analise"],
      segment_rule_type: ["allow", "deny"],
      transaction_status: [
        "recente",
        "atencao",
        "acao_necessaria",
        "critico",
        "nunca_transacionou",
      ],
      user_role: [
        "gestor_master",
        "administrativo",
        "supervisor_rede",
        "consultor_campo",
        "suporte_tecnico",
        "comercial",
        "consulta",
      ],
      visit_status: [
        "reservada",
        "em_deslocamento",
        "checkin_realizado",
        "em_atendimento",
        "concluida",
        "cancelada",
        "expirada",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

