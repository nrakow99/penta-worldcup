export type ImportType = "teams" | "fixtures" | "results";

export const IMPORT_TEMPLATES = {
  teams: {
    csv: `name,short_name,flag_emoji,group_name
USA,USA,🇺🇸,A
Mexico,MEX,🇲🇽,A
Canada,CAN,🇨🇦,A
Jamaica,JAM,🇯🇲,A
Brazil,BRA,🇧🇷,B
Argentina,ARG,🇦🇷,B`,
    json: JSON.stringify(
      {
        teams: [
          { name: "USA", short_name: "USA", flag_emoji: "🇺🇸", group_name: "A" },
          { name: "Mexico", short_name: "MEX", flag_emoji: "🇲🇽", group_name: "A" },
          { name: "Canada", short_name: "CAN", flag_emoji: "🇨🇦", group_name: "A" },
          { name: "Jamaica", short_name: "JAM", flag_emoji: "🇯🇲", group_name: "A" },
        ],
      },
      null,
      2
    ),
  },
  fixtures: {
    csv: `group_name,home_team,away_team,match_date,status
A,USA,Mexico,2026-06-15T18:00:00Z,upcoming
A,Canada,Jamaica,2026-06-16T20:00:00Z,upcoming
B,Brazil,Argentina,2026-06-17T18:00:00Z,upcoming`,
    json: JSON.stringify(
      {
        fixtures: [
          {
            group_name: "A",
            home_team: "USA",
            away_team: "Mexico",
            match_date: "2026-06-15T18:00:00Z",
            status: "upcoming",
          },
          {
            group_name: "A",
            home_team: "Canada",
            away_team: "Jamaica",
            match_date: "2026-06-16T20:00:00Z",
            status: "upcoming",
          },
        ],
      },
      null,
      2
    ),
  },
  results: {
    csv: `group_name,home_team,away_team,home_score,away_score,match_date
A,USA,Mexico,2,1,2026-06-15T18:00:00Z
A,Canada,Jamaica,1,1,2026-06-16T20:00:00Z`,
    json: JSON.stringify(
      {
        results: [
          {
            group_name: "A",
            home_team: "USA",
            away_team: "Mexico",
            home_score: 2,
            away_score: 1,
            match_date: "2026-06-15T18:00:00Z",
          },
          {
            group_name: "A",
            home_team: "Canada",
            away_team: "Jamaica",
            home_score: 1,
            away_score: 1,
            match_date: "2026-06-16T20:00:00Z",
          },
        ],
      },
      null,
      2
    ),
  },
} as const;

export const IMPORT_COLUMN_HINTS: Record<ImportType, string[]> = {
  teams: ["name", "short_name", "flag_emoji", "group_name"],
  fixtures: ["group_name", "home_team", "away_team", "match_date", "status"],
  results: ["group_name", "home_team", "away_team", "home_score", "away_score", "match_date"],
};
