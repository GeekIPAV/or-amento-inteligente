export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      centro_custo_projetos: {
        Row: {
          centro_custo: string
          created_at: string
          id: string
          nome_projeto: string
          updated_at: string
        }
        Insert: {
          centro_custo: string
          created_at?: string
          id?: string
          nome_projeto: string
          updated_at?: string
        }
        Update: {
          centro_custo?: string
          created_at?: string
          id?: string
          nome_projeto?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conta_rubricas: {
        Row: {
          conta: string
          created_at: string
          id: string
          rubrica: string
          updated_at: string
        }
        Insert: {
          conta: string
          created_at?: string
          id?: string
          rubrica: string
          updated_at?: string
        }
        Update: {
          conta?: string
          created_at?: string
          id?: string
          rubrica?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamento_versoes: {
        Row: {
          ano: number
          ativa: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ano: number
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ano?: number
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          mes: number
          projeto: string
          rubrica: string | null
          tipo: Database["public"]["Enums"]["tipo_orcamento"]
          updated_at: string
          valor: number
          versao_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          mes: number
          projeto: string
          rubrica?: string | null
          tipo: Database["public"]["Enums"]["tipo_orcamento"]
          updated_at?: string
          valor?: number
          versao_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          mes?: number
          projeto?: string
          rubrica?: string | null
          tipo?: Database["public"]["Enums"]["tipo_orcamento"]
          updated_at?: string
          valor?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "orcamento_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_extrato: {
        Row: {
          centro_custo: string | null
          conta: string | null
          credito: number
          data: string | null
          debito: number
          descricao_conta: string | null
          diario: string | null
          id: string
          importado_em: string
          importado_por: string | null
          mes_referencia: string
          movimento: string | null
          num_documento: string | null
        }
        Insert: {
          centro_custo?: string | null
          conta?: string | null
          credito?: number
          data?: string | null
          debito?: number
          descricao_conta?: string | null
          diario?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          mes_referencia: string
          movimento?: string | null
          num_documento?: string | null
        }
        Update: {
          centro_custo?: string | null
          conta?: string | null
          credito?: number
          data?: string | null
          debito?: number
          descricao_conta?: string | null
          diario?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          mes_referencia?: string
          movimento?: string | null
          num_documento?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anos_transacoes_disponiveis: {
        Args: never
        Returns: {
          ano: number
        }[]
      }
      atribuir_centros_custo_projeto: {
        Args: { p_centros: string[]; p_projeto: string }
        Returns: undefined
      }
      atribuir_contas_rubrica: {
        Args: { p_contas: string[]; p_rubrica: string }
        Returns: undefined
      }
      centros_custo_disponiveis: {
        Args: never
        Returns: {
          centro_custo: string
          linhas: number
          projeto: string
        }[]
      }
      centros_custo_listagem: {
        Args: never
        Returns: {
          centro_custo: string
          linhas: number
          nome_projeto: string
        }[]
      }
      contas_disponiveis: {
        Args: never
        Returns: {
          conta: string
          descricao_conta: string
          rubrica: string
        }[]
      }
      contas_listagem: {
        Args: never
        Returns: {
          conta: string
          descricao_conta: string
          linhas: number
          rubrica: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      projetos_disponiveis: {
        Args: never
        Returns: {
          projeto: string
        }[]
      }
      projetos_listagem: {
        Args: never
        Returns: {
          centros_custo: string[]
          num_centros: number
          projeto: string
        }[]
      }
      resumo_transacoes_mensal: {
        Args: { p_ano: number }
        Returns: {
          despesa: number
          linhas: number
          mes: number
          receita: number
        }[]
      }
      resumo_transacoes_projeto: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          despesa: number
          linhas: number
          nome_projeto: string
          projeto: string
          receita: number
        }[]
      }
      resumo_transacoes_rubrica: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          despesa: number
          linhas: number
          receita: number
          rubrica: string
        }[]
      }
      rubricas_disponiveis: {
        Args: never
        Returns: {
          rubrica: string
        }[]
      }
      rubricas_listagem: {
        Args: never
        Returns: {
          contas: string[]
          num_contas: number
          rubrica: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      tipo_orcamento: "RECEITA" | "DESPESA"
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
      app_role: ["admin", "user"],
      tipo_orcamento: ["RECEITA", "DESPESA"],
    },
  },
} as const
