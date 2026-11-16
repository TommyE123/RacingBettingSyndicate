// Shapes returned by the backend API (app/schemas.py and app/ledger.py).

export type Role = 'admin' | 'member';

export interface ApiUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
}

export interface CompetitionSummary {
  id: number;
  name: string;
  budget_pence: number;
  entered: boolean;
}

export interface Day {
  id: number;
  date: string;
  label: string | null;
}

export interface Entrant {
  user_id: number;
  display_name: string;
}

export interface CompetitionDetail extends CompetitionSummary {
  days: Day[];
  entrants: Entrant[];
}

export interface BetType {
  key: string;
  label: string;
  min_selections: number;
  max_selections: number;
  fixed_lines: number | null;
  description: string;
}

export interface Selection {
  position: number;
  day_id: number;
  race_time: string;
  horse_name: string;
  note: string | null;
}

export interface Slip {
  id: number;
  user_id: number;
  display_name: string;
  day_id: number;
  settle_day_id: number;
  sheet_id: number | null;
  bet_type: string;
  bet_label: string;
  fold_size: number | null;
  each_way: boolean;
  unit_stake_pence: number;
  line_count: number;
  stake_pence: number;
  return_pence: number | null;
  profit_pence: number | null;
  note: string | null;
  selections: Selection[];
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  void_reason: string | null;
  over_budget: boolean;
}

export interface SelectionInput {
  day_id: number;
  race_time: string;
  horse_name: string;
  note?: string | null;
}

export interface SlipInput {
  day_id: number;
  bet_type: string;
  fold_size?: number | null;
  each_way: boolean;
  unit_stake_pence?: number | null;
  stake_pence?: number | null;
  selections: SelectionInput[];
  note?: string | null;
  sheet_id?: number | null;
  user_id?: number | null;
  confirm_over_budget?: boolean;
}

export interface Sheet {
  id: number;
  user_id: number;
  display_name: string;
  day_id: number;
  content_type: string;
  size_bytes: number;
  stated_total_pence: number | null;
  entered_total_pence: number;
  slip_count: number;
  note: string | null;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor_user_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  detail: Record<string, unknown>;
}

export interface StandingDay {
  day_id: number;
  staked_pence: number;
  returned_pence: number;
  profit_pence: number;
  cumulative_profit_pence: number;
  cumulative_staked_pence: number;
  rank: number;
}

export type BudgetStatus = 'under' | 'complete' | 'over';

export interface StandingRow {
  user_id: number;
  display_name: string;
  rank: number;
  staked_pence: number;
  returned_pence: number;
  profit_pence: number;
  remaining_pence: number;
  budget_status: BudgetStatus;
  pending_returns: number;
  slip_count: number;
  days_won: number;
  days: StandingDay[];
}

export interface DailyWinner {
  day_id: number;
  profit_pence: number;
  user_ids: number[];
}

export interface Standings {
  budget_pence: number;
  rows: StandingRow[];
  daily_winners: DailyWinner[];
  bob_addis_user_ids: number[];
  jfk_user_ids: number[];
  totals: { staked_pence: number; returned_pence: number; pending_returns: number; slip_count: number };
}

export interface SlipRef {
  slip_id: number;
  user_id: number;
  bet_type: string;
  stake_pence: number;
  return_pence: number | null;
  multiple?: number;
}

export interface DayRecord {
  user_id: number;
  day_id: number;
  profit_pence: number;
}

export interface PersonStats {
  user_id: number;
  slip_count: number;
  settled_count: number;
  winning_count: number;
  strike_rate: number | null;
  longest_winning_run: number;
  longest_losing_run: number;
  favourite_bet_type: string | null;
  average_stake_pence: number;
  each_way_share: number | null;
  biggest_stake_share_of_budget: number | null;
}

export interface BetTypeStats {
  bet_type: string;
  label: string;
  slip_count: number;
  staked_pence: number;
  returned_pence: number;
  settled_staked_pence: number;
  settled_returned_pence: number;
  winning_count: number;
  settled_count: number;
}

export interface HorseStats {
  horse_name: string;
  backer_count: number;
  slip_count: number;
  user_ids: number[];
  spellings: string[];
}

export interface Stats {
  records: {
    biggest_return: SlipRef | null;
    best_multiple: SlipRef | null;
    biggest_losing_stake: SlipRef | null;
    best_day: DayRecord | null;
    worst_day: DayRecord | null;
    biggest_single_stake: SlipRef | null;
  };
  people: PersonStats[];
  bet_types: BetTypeStats[];
  styles: { each_way: boolean; slip_count: number; staked_pence: number; returned_pence: number }[];
  horses: HorseStats[];
  lone_picks: HorseStats[];
  copycats: { user_ids: [number, number]; shared_count: number; overlap: number }[];
  comebacks: { user_id: number; places_climbed: number }[];
  horse_count: number;
}
