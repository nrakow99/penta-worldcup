"use client";

import { useState, useTransition } from "react";
import {
  applyTournamentUpdateJson,
  addSingleResult,
  addSingleFixture,
} from "@/lib/actions/tournament-update-actions";
import type { TournamentUpdateSummary } from "@/lib/import/tournament-update";

type Tab = "json" | "result" | "fixture";

interface Props {
  leagueId: string;
}

const EXAMPLE_JSON = `{
  "results": [
    {
      "date": "2026-06-15",
      "group": "A",
      "home_team": "Iran",
      "away_team": "New Zealand",
      "home_score": 2,
      "away_score": 2,
      "status": "final"
    }
  ],
  "fixtures": [
    {
      "date": "2026-06-18",
      "group": "B",
      "home_team": "Mexico",
      "away_team": "South Korea",
      "status": "scheduled"
    }
  ]
}`;

function SummaryBanner({
  summary,
  onClear,
}: {
  summary: TournamentUpdateSummary | { error: string };
  onClear: () => void;
}) {
  if ("error" in summary) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-950/40 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-red-400">Error</p>
            <p className="mt-1 text-sm text-red-300">{summary.error}</p>
          </div>
          <button onClick={onClear} className="text-red-400 hover:text-red-200 text-lg leading-none">×</button>
        </div>
      </div>
    );
  }

  const hasWarnings = summary.warnings.length > 0;

  return (
    <div className={`rounded-lg border p-4 ${hasWarnings ? "border-amber-700 bg-amber-950/40" : "border-emerald-700 bg-emerald-950/40"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`font-semibold ${hasWarnings ? "text-amber-400" : "text-emerald-400"}`}>
            Update applied
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="text-zinc-300">
              <span className="font-medium text-zinc-100">{summary.resultsApplied}</span> result{summary.resultsApplied !== 1 ? "s" : ""}
            </span>
            <span className="text-zinc-300">
              <span className="font-medium text-zinc-100">{summary.fixturesApplied}</span> fixture{summary.fixturesApplied !== 1 ? "s" : ""}
            </span>
            {summary.teamsCreated > 0 && (
              <span className="text-zinc-300">
                <span className="font-medium text-zinc-100">{summary.teamsCreated}</span> team{summary.teamsCreated !== 1 ? "s" : ""} created
              </span>
            )}
          </div>
          {hasWarnings && (
            <ul className="mt-3 space-y-1">
              {summary.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300">⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={onClear} className="text-zinc-400 hover:text-zinc-200 text-lg leading-none">×</button>
      </div>
    </div>
  );
}

function JsonTab({ leagueId }: { leagueId: string }) {
  const [json, setJson] = useState("");
  const [result, setResult] = useState<TournamentUpdateSummary | { error: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleApply = () => {
    const trimmed = json.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await applyTournamentUpdateJson(leagueId, trimmed);
      setResult(res);
      if ("success" in res && res.success) setJson("");
    });
  };

  const handleExample = () => {
    setJson(EXAMPLE_JSON);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {result && <SummaryBanner summary={result} onClear={() => setResult(null)} />}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">
            Paste tournament JSON
          </label>
          <button
            type="button"
            onClick={handleExample}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            load example
          </button>
        </div>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={`{\n  "results": [...],\n  "fixtures": [...]\n}`}
          rows={14}
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none resize-y"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={pending || !json.trim()}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {pending ? "Applying…" : "Apply Update"}
        </button>
        {json.trim() && (
          <button
            type="button"
            onClick={() => { setJson(""); setResult(null); }}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">JSON format reference</p>
        <pre className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{`{
  "results": [
    {
      "date": "2026-06-15",      // required
      "group": "A",              // optional, auto-detected
      "home_team": "Iran",       // required
      "away_team": "New Zealand",// required
      "home_score": 2,           // required
      "away_score": 2,           // required
      "status": "final"          // optional, defaults to "final"
    }
  ],
  "fixtures": [
    {
      "date": "2026-06-18",      // required
      "group": "B",              // optional, auto-detected
      "home_team": "Mexico",     // required
      "away_team": "South Korea",// required
      "status": "scheduled"      // optional, defaults to "upcoming"
    }
  ]
}`}</pre>
        <p className="mt-3 text-xs text-zinc-500">
          Teams are auto-created if they don&apos;t exist. Include <code className="text-zinc-400">group</code> for new teams.
          Results always take precedence. A fixture already marked <em>final</em> will not be overwritten.
        </p>
      </div>
    </div>
  );
}

function ResultTab({ leagueId }: { leagueId: string }) {
  const [result, setResult] = useState<TournamentUpdateSummary | { error: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    const data = {
      home_team: fd.get("home_team") as string,
      away_team: fd.get("away_team") as string,
      home_score: Number(fd.get("home_score")),
      away_score: Number(fd.get("away_score")),
      date: fd.get("date") as string,
      group: (fd.get("group") as string) || undefined,
      status: "final",
    };

    startTransition(async () => {
      const res = await addSingleResult(leagueId, data);
      setResult(res);
      if ("success" in res && res.success) form.reset();
    });
  };

  return (
    <div className="space-y-4">
      {result && <SummaryBanner summary={result} onClear={() => setResult(null)} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Team" name="home_team" placeholder="e.g. Brazil" required />
          <Field label="Away Team" name="away_team" placeholder="e.g. Argentina" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Score" name="home_score" type="number" placeholder="0" required min="0" />
          <Field label="Away Score" name="away_score" type="number" placeholder="0" required min="0" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Match Date" name="date" type="date" required />
          <Field label="Group (optional)" name="group" placeholder="A–L (auto-detected)" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save Result"}
        </button>
      </form>
    </div>
  );
}

function FixtureTab({ leagueId }: { leagueId: string }) {
  const [result, setResult] = useState<TournamentUpdateSummary | { error: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    const data = {
      home_team: fd.get("home_team") as string,
      away_team: fd.get("away_team") as string,
      date: fd.get("date") as string,
      group: (fd.get("group") as string) || undefined,
      status: (fd.get("status") as string) || "upcoming",
    };

    startTransition(async () => {
      const res = await addSingleFixture(leagueId, data);
      setResult(res);
      if ("success" in res && res.success) form.reset();
    });
  };

  return (
    <div className="space-y-4">
      {result && <SummaryBanner summary={result} onClear={() => setResult(null)} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Team" name="home_team" placeholder="e.g. Mexico" required />
          <Field label="Away Team" name="away_team" placeholder="e.g. South Korea" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Match Date" name="date" type="date" required />
          <Field label="Group (optional)" name="group" placeholder="A–L (auto-detected)" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">Status</label>
          <select
            name="status"
            defaultValue="upcoming"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Add Fixture"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-300">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        min={min}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}

export function TournamentUpdatePanel({ leagueId }: Props) {
  const [tab, setTab] = useState<Tab>("json");

  const tabs: { id: Tab; label: string; desc: string }[] = [
    { id: "json", label: "Paste JSON", desc: "Bulk import from screenshot data" },
    { id: "result", label: "Add Result", desc: "Enter a single completed match" },
    { id: "fixture", label: "Add Fixture", desc: "Schedule an upcoming match" },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-zinc-100">Tournament Update</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Paste JSON generated from screenshots, or enter individual results and fixtures.
          Standings are recalculated automatically.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-zinc-500">
        {tabs.find((t) => t.id === tab)?.desc}
      </p>

      {tab === "json" && <JsonTab leagueId={leagueId} />}
      {tab === "result" && <ResultTab leagueId={leagueId} />}
      {tab === "fixture" && <FixtureTab leagueId={leagueId} />}
    </div>
  );
}
