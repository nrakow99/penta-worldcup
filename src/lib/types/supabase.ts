export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      leagues: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          admin_id: string;
          status: "open" | "locked" | "in_progress" | "finished";
          lock_deadline: string | null;
          is_manually_locked: boolean;
          total_goals: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          admin_id: string;
          status?: "open" | "locked" | "in_progress" | "finished";
          lock_deadline?: string | null;
          is_manually_locked?: boolean;
          total_goals?: number;
        };
        Update: {
          name?: string;
          status?: "open" | "locked" | "in_progress" | "finished";
          lock_deadline?: string | null;
          is_manually_locked?: boolean;
          total_goals?: number;
        };
      };
      league_members: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          role: "admin" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          user_id: string;
          role?: "admin" | "member";
        };
        Update: {
          role?: "admin" | "member";
        };
      };
      teams: {
        Row: {
          id: string;
          league_id: string;
          name: string;
          short_name: string | null;
          flag_emoji: string | null;
          is_placeholder: boolean;
          placeholder_label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          name: string;
          short_name?: string | null;
          flag_emoji?: string | null;
          is_placeholder?: boolean;
          placeholder_label?: string | null;
        };
        Update: {
          name?: string;
          short_name?: string | null;
          flag_emoji?: string | null;
          is_placeholder?: boolean;
          placeholder_label?: string | null;
        };
      };
      matches: {
        Row: {
          id: string;
          league_id: string;
          round: "r32" | "r16" | "qf" | "sf" | "final" | "champion";
          match_number: number;
          team_a_id: string | null;
          team_b_id: string | null;
          team_a_placeholder: string | null;
          team_b_placeholder: string | null;
          winner_team_id: string | null;
          next_match_id: string | null;
          next_match_slot: "a" | "b" | null;
          team_a_score: number | null;
          team_b_score: number | null;
          scheduled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          round: "r32" | "r16" | "qf" | "sf" | "final" | "champion";
          match_number: number;
          team_a_id?: string | null;
          team_b_id?: string | null;
          team_a_placeholder?: string | null;
          team_b_placeholder?: string | null;
          winner_team_id?: string | null;
          next_match_id?: string | null;
          next_match_slot?: "a" | "b" | null;
          team_a_score?: number | null;
          team_b_score?: number | null;
          scheduled_at?: string | null;
        };
        Update: {
          team_a_id?: string | null;
          team_b_id?: string | null;
          team_a_placeholder?: string | null;
          team_b_placeholder?: string | null;
          winner_team_id?: string | null;
          team_a_score?: number | null;
          team_b_score?: number | null;
          scheduled_at?: string | null;
        };
      };
      brackets: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          is_complete: boolean;
          is_locked: boolean;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          user_id: string;
          is_complete?: boolean;
          is_locked?: boolean;
          submitted_at?: string | null;
        };
        Update: {
          is_complete?: boolean;
          is_locked?: boolean;
          submitted_at?: string | null;
        };
      };
      bracket_picks: {
        Row: {
          id: string;
          bracket_id: string;
          match_id: string;
          picked_team_id: string | null;
          round: "r32" | "r16" | "qf" | "sf" | "final" | "champion";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bracket_id: string;
          match_id: string;
          picked_team_id?: string | null;
          round: "r32" | "r16" | "qf" | "sf" | "final" | "champion";
        };
        Update: {
          picked_team_id?: string | null;
        };
      };
      actual_results: {
        Row: {
          id: string;
          league_id: string;
          match_id: string;
          winner_team_id: string;
          team_a_score: number;
          team_b_score: number;
          recorded_at: string;
          recorded_by: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          match_id: string;
          winner_team_id: string;
          team_a_score?: number;
          team_b_score?: number;
          recorded_by: string;
        };
        Update: {
          winner_team_id?: string;
          team_a_score?: number;
          team_b_score?: number;
        };
      };
      punishments: {
        Row: {
          id: string;
          league_id: string;
          description: string;
          set_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          description: string;
          set_by: string;
        };
        Update: {
          description?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          league_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          user_id: string;
          content: string;
        };
        Update: {
          content?: string;
        };
      };
    };
    Functions: {
      generate_invite_code: { Args: Record<string, never>; Returns: string };
      is_league_member: { Args: { p_league_id: string }; Returns: boolean };
      is_league_admin: { Args: { p_league_id: string }; Returns: boolean };
      is_bracket_locked: { Args: { p_league_id: string }; Returns: boolean };
    };
  };
}
