/**
 * World Cup 2026 Round of 32 seed data.
 * These 32 teams and 16 R32 matchups are automatically inserted into every
 * new league — admin never has to type team names or matchups manually.
 */

export interface SeededTeam {
  name: string;
  flagEmoji: string;
}

export const WORLD_CUP_2026_TEAMS: SeededTeam[] = [
  // Left half of bracket (match numbers 1-8)
  { name: "Germany", flagEmoji: "🇩🇪" },
  { name: "Paraguay", flagEmoji: "🇵🇾" },
  { name: "France", flagEmoji: "🇫🇷" },
  { name: "Sweden", flagEmoji: "🇸🇪" },
  { name: "South Africa", flagEmoji: "🇿🇦" },
  { name: "Canada", flagEmoji: "🇨🇦" },
  { name: "Netherlands", flagEmoji: "🇳🇱" },
  { name: "Morocco", flagEmoji: "🇲🇦" },
  { name: "Portugal", flagEmoji: "🇵🇹" },
  { name: "Croatia", flagEmoji: "🇭🇷" },
  { name: "Spain", flagEmoji: "🇪🇸" },
  { name: "Austria", flagEmoji: "🇦🇹" },
  { name: "United States", flagEmoji: "🇺🇸" },
  { name: "Bosnia", flagEmoji: "🇧🇦" },
  { name: "Belgium", flagEmoji: "🇧🇪" },
  { name: "Senegal", flagEmoji: "🇸🇳" },
  // Right half of bracket (match numbers 9-16)
  { name: "Brazil", flagEmoji: "🇧🇷" },
  { name: "Japan", flagEmoji: "🇯🇵" },
  { name: "Ivory Coast", flagEmoji: "🇨🇮" },
  { name: "Norway", flagEmoji: "🇳🇴" },
  { name: "Mexico", flagEmoji: "🇲🇽" },
  { name: "Ecuador", flagEmoji: "🇪🇨" },
  { name: "England", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Congo DR", flagEmoji: "🇨🇩" },
  { name: "Argentina", flagEmoji: "🇦🇷" },
  { name: "Cape Verde", flagEmoji: "🇨🇻" },
  { name: "Australia", flagEmoji: "🇦🇺" },
  { name: "Egypt", flagEmoji: "🇪🇬" },
  { name: "Switzerland", flagEmoji: "🇨🇭" },
  { name: "Algeria", flagEmoji: "🇩🇿" },
  { name: "Colombia", flagEmoji: "🇨🇴" },
  { name: "Ghana", flagEmoji: "🇬🇭" },
];

/**
 * R32 matchups keyed by internal match_number (1–16).
 * Value is [teamA_name, teamB_name].
 *
 * Left bracket half (visible on left side of bracket display):
 *   1: Germany vs Paraguay
 *   2: France vs Sweden
 *   3: South Africa vs Canada
 *   4: Netherlands vs Morocco
 *   5: Portugal vs Croatia
 *   6: Spain vs Austria
 *   7: United States vs Bosnia
 *   8: Belgium vs Senegal
 *
 * Right bracket half (visible on right side):
 *   9:  Brazil vs Japan
 *   10: Ivory Coast vs Norway
 *   11: Mexico vs Ecuador
 *   12: England vs Congo DR
 *   13: Argentina vs Cape Verde
 *   14: Australia vs Egypt
 *   15: Switzerland vs Algeria
 *   16: Colombia vs Ghana
 */
export const SEEDED_R32_MATCHUPS: Record<number, [string, string]> = {
  1: ["Germany", "Paraguay"],
  2: ["France", "Sweden"],
  3: ["South Africa", "Canada"],
  4: ["Netherlands", "Morocco"],
  5: ["Portugal", "Croatia"],
  6: ["Spain", "Austria"],
  7: ["United States", "Bosnia"],
  8: ["Belgium", "Senegal"],
  9: ["Brazil", "Japan"],
  10: ["Ivory Coast", "Norway"],
  11: ["Mexico", "Ecuador"],
  12: ["England", "Congo DR"],
  13: ["Argentina", "Cape Verde"],
  14: ["Australia", "Egypt"],
  15: ["Switzerland", "Algeria"],
  16: ["Colombia", "Ghana"],
};
