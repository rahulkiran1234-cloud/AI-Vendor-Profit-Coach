// Hand-written to match supabase/migrations/*.sql. If you change the schema, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type Language = "hindi" | "marathi" | "english";
export type VendorType = "street_food" | "retail" | "multi_location" | "other";
export type InsightType = "trend" | "cost_anomaly" | "pattern" | "recommendation" | "waste";
export type RecommendationType =
  | "cost_optimization"
  | "waste_reduction"
  | "stock_adjustment"
  | "seasonal";
export type KissthStatus = "pending" | "approved" | "rejected" | "processing";
export type ExpenseUnit = "kg" | "g" | "l" | "ml" | "piece" | "dozen" | "packet" | "other";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          language: Language;
          vendor_type: VendorType | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          language?: Language;
          vendor_type?: VendorType | null;
        };
        Update: Partial<{
          id: string;
          email: string;
          full_name: string;
          language: Language;
          vendor_type: VendorType | null;
        }>;
        Relationships: [];
      };
      profit_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          revenue: number;
          costs: number;
          profit: number;
          waste_loss: number | null;
          notes: string | null;
          voice_transcription: string | null;
          confidence_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          revenue: number;
          costs: number;
          waste_loss?: number | null;
          notes?: string | null;
          voice_transcription?: string | null;
          confidence_score?: number | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          date: string;
          revenue: number;
          costs: number;
          waste_loss: number | null;
          notes: string | null;
          voice_transcription: string | null;
          confidence_score: number | null;
        }>;
        Relationships: [];
      };
      insights: {
        Row: {
          id: string;
          user_id: string;
          profit_log_id: string;
          insight_type: InsightType;
          insight_text: string;
          recommendation_type: RecommendationType | null;
          estimated_savings: number | null;
          viewed_at: string | null;
          acted_upon: boolean;
          action_date: string | null;
          action_description: string | null;
          confidence_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profit_log_id: string;
          insight_type: InsightType;
          insight_text: string;
          recommendation_type?: RecommendationType | null;
          estimated_savings?: number | null;
          confidence_score?: number | null;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          profit_log_id: string;
          insight_type: InsightType;
          insight_text: string;
          recommendation_type: RecommendationType | null;
          estimated_savings: number | null;
          viewed_at: string | null;
          acted_upon: boolean;
          action_date: string | null;
          action_description: string | null;
          confidence_score: number | null;
        }>;
        Relationships: [];
      };
      loan_records: {
        Row: {
          id: string;
          user_id: string;
          avg_daily_profit: number | null;
          consistency_score: number | null;
          avg_profit_30_days: number | null;
          loan_eligibility_amount: number | null;
          loan_eligibility_confidence: number | null;
          kissth_application_sent: boolean;
          kissth_application_date: string | null;
          kissth_status: KissthStatus | null;
          kissth_approved_amount: number | null;
          kissth_application_id: string | null;
          kissth_response: unknown;
          loan_interest_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          avg_daily_profit: number | null;
          consistency_score: number | null;
          avg_profit_30_days: number | null;
          loan_eligibility_amount: number | null;
          loan_eligibility_confidence: number | null;
          kissth_application_sent: boolean;
          kissth_application_date: string | null;
          kissth_status: KissthStatus | null;
          kissth_approved_amount: number | null;
          kissth_application_id: string | null;
          kissth_response: unknown;
          loan_interest_at: string | null;
        }> & {
          user_id: string;
        };
        Update: Partial<{
          user_id: string;
          avg_daily_profit: number | null;
          consistency_score: number | null;
          avg_profit_30_days: number | null;
          loan_eligibility_amount: number | null;
          loan_eligibility_confidence: number | null;
          kissth_application_sent: boolean;
          kissth_application_date: string | null;
          kissth_status: KissthStatus | null;
          kissth_approved_amount: number | null;
          kissth_application_id: string | null;
          kissth_response: unknown;
          loan_interest_at: string | null;
        }>;
        Relationships: [];
      };
      expense_items: {
        Row: {
          id: string;
          user_id: string;
          profit_log_id: string | null;
          date: string;
          item_name: string;
          item_name_normalized: string;
          // Trigger-populated (0003_ingredient_canonicalization.sql) — resolves
          // item_name through ingredient_synonyms so variants across
          // languages/spelling group together. Not settable on insert/update.
          canonical_item_key: string | null;
          supplier_name: string | null;
          amount: number;
          quantity: number | null;
          unit: ExpenseUnit | null;
          unit_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profit_log_id?: string | null;
          date: string;
          item_name: string;
          supplier_name?: string | null;
          amount: number;
          quantity?: number | null;
          unit?: ExpenseUnit | null;
        };
        Update: Partial<{
          profit_log_id: string | null;
          date: string;
          item_name: string;
          supplier_name: string | null;
          amount: number;
          quantity: number | null;
          unit: ExpenseUnit | null;
        }>;
        Relationships: [];
      };
      coach_messages: {
        Row: {
          id: string;
          user_id: string;
          question: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question: string;
          answer: string;
        };
        Update: Partial<{ question: string; answer: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_item_price_benchmark: {
        Args: { p_item_name: string; p_unit: string };
        Returns: { avg_unit_price: number; vendor_count: number }[];
      };
    };
  };
}
