"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  updateLeagueSettings,
  setPunishment,
  resetBracketData,
  deleteLeague,
  setBracketOpen,
} from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import type { League, Punishment } from "@/lib/types/database";

interface AdminPanelProps {
  league: League;
  punishment: Punishment | null;
  submittedCount?: number;
  memberCount?: number;
}

export function AdminPanel({
  league,
  punishment,
  submittedCount = 0,
  memberCount = 0,
}: AdminPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      {/* ── Step 1: Lock deadline ── */}
      <StepCard
        step={1}
        title="Set Bracket Lock Deadline"
        done={!!league.lock_deadline}
        status={
          league.lock_deadline
            ? `Locks at ${new Date(league.lock_deadline).toLocaleString()}`
            : "No deadline set — brackets stay open until you lock manually"
        }
      >
        <LockDeadlineForm
          league={league}
          isPending={isPending}
          startTransition={startTransition}
        />
      </StepCard>

      {/* ── Step 2: Open bracket ── */}
      <StepCard
        step={2}
        title="Open Bracket for Players"
        done={league.bracket_open}
        status={
          league.bracket_open
            ? `Open · ${submittedCount}/${memberCount} brackets submitted`
            : "Players see \u201CBracket not open yet\u201D until you open it"
        }
      >
        <OpenBracketControl
          leagueId={league.id}
          bracketOpen={league.bracket_open}
          isPending={isPending}
          startTransition={startTransition}
        />
      </StepCard>

      {/* ── Step 3: Enter results ── */}
      <StepCard
        step={3}
        title="Enter Actual Match Results"
        done={false}
        status="Enter winners as real games finish"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/league/${league.id}/admin/results`}>
            <Button>Open Results Entry →</Button>
          </Link>
          <p className="text-xs text-zinc-500">
            Select the actual winner for each match. Winners advance automatically.
          </p>
        </div>
      </StepCard>

      {/* ── Invite code ── */}
      <InviteCodeDisplay
        inviteCode={league.invite_code}
        memberCount={memberCount}
        submittedCount={submittedCount}
      />

      {/* ── League settings (collapsible) ── */}
      <details className="group rounded-xl border border-zinc-800 bg-zinc-950">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-zinc-300 hover:text-zinc-100">
          <span>League Settings</span>
          <span className="text-zinc-600 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-6 border-t border-zinc-800 px-5 py-4">
          <LeagueSettingsForm
            league={league}
            isPending={isPending}
            startTransition={startTransition}
          />
          <PunishmentForm
            leagueId={league.id}
            punishment={punishment}
            isPending={isPending}
            startTransition={startTransition}
          />
        </div>
      </details>

      {/* ── Danger zone ── */}
      <details className="group rounded-xl border border-red-900/40 bg-zinc-950">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-red-400 hover:text-red-300">
          <span>Danger Zone</span>
          <span className="text-red-700 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-5 border-t border-red-900/30 px-5 py-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-300">Reset bracket data</p>
            <p className="text-xs text-zinc-500">
              Permanently deletes all bracket picks and recorded results. R32 matchups stay in place. Cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (
                  confirm(
                    "Reset ALL bracket data?\n\nThis permanently deletes every player's picks and all recorded results. This cannot be undone."
                  )
                ) {
                  startTransition(() => {
                    void resetBracketData(league.id);
                  });
                }
              }}
            >
              Reset All Bracket Data
            </Button>
          </div>

          <div className="border-t border-red-900/20 pt-5 space-y-2">
            <p className="text-xs font-medium text-red-300">Delete this league</p>
            <p className="text-xs text-zinc-500">
              Permanently removes the league and all its data — members, picks, results, comments. This cannot be undone.
            </p>
            <DeleteLeagueButton league={league} />
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  title,
  done,
  status,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {done ? "✓" : step}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-zinc-100">{title}</p>
          <p
            className={`mt-0.5 text-xs ${done ? "text-emerald-500" : "text-zinc-500"}`}
          >
            {status}
          </p>
        </div>
      </div>
      <div className="border-t border-zinc-800 px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Lock deadline ────────────────────────────────────────────────────────────

function LockDeadlineForm({
  league,
  isPending,
  startTransition,
}: {
  league: League;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
        action={(formData) => {
          startTransition(async () => {
            await updateLeagueSettings(league.id, {
              lockDeadline: (formData.get("lockDeadline") as string) || null,
              isManuallyLocked: formData.get("isManuallyLocked") === "on",
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          });
        }}
    >
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs text-zinc-500">
          Date &amp; time (your local time)
        </label>
        <Input
          name="lockDeadline"
          type="datetime-local"
          defaultValue={
            league.lock_deadline
              ? new Date(league.lock_deadline).toISOString().slice(0, 16)
              : ""
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Save Deadline
        </Button>
        {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
      </div>
      <label className="flex w-full items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          name="isManuallyLocked"
          defaultChecked={league.is_manually_locked}
          className="rounded border-zinc-600"
        />
        Lock brackets immediately (ignores deadline)
      </label>
    </form>
  );
}

// ─── Open / close bracket ─────────────────────────────────────────────────────

function OpenBracketControl({
  leagueId,
  bracketOpen,
  isPending,
  startTransition,
}: {
  leagueId: string;
  bracketOpen: boolean;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  if (bracketOpen) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-emerald-300">Bracket is open</p>
          <p className="text-xs text-emerald-700">
            Players can fill out their predictions
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (
              confirm(
                "Close the bracket? Players will see \"Bracket not open yet\" again."
              )
            ) {
              startTransition(() => void setBracketOpen(leagueId, false));
            }
          }}
        >
          Close Bracket
        </Button>
      </div>
    );
  }

  return (
    <Button
      disabled={isPending}
      onClick={() => {
        startTransition(() => void setBracketOpen(leagueId, true));
      }}
    >
      Open Bracket for Players
    </Button>
  );
}

// ─── Invite code ──────────────────────────────────────────────────────────────

function InviteCodeDisplay({
  inviteCode,
  memberCount,
  submittedCount,
}: {
  inviteCode: string;
  memberCount: number;
  submittedCount: number;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4">
      <p className="mb-3 text-sm font-semibold text-zinc-300">Invite Players</p>
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <code className="flex-1 text-xl font-bold tracking-widest text-emerald-400">
          {inviteCode}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(inviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {memberCount} member{memberCount !== 1 ? "s" : ""} ·{" "}
        {submittedCount} bracket{submittedCount !== 1 ? "s" : ""} submitted
      </p>
    </div>
  );
}

// ─── League settings ──────────────────────────────────────────────────────────

function LeagueSettingsForm({
  league,
  isPending,
  startTransition,
}: {
  league: League;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-zinc-300">League Name</p>
      <form
        className="flex flex-wrap items-end gap-3"
        action={(formData) => {
          startTransition(async () => {
            await updateLeagueSettings(league.id, {
              name: formData.get("name") as string,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          });
        }}
      >
        <Input
          name="name"
          defaultValue={league.name}
          className="min-w-48 flex-1"
          required
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}

function PunishmentForm({
  leagueId,
  punishment,
  isPending,
  startTransition,
}: {
  leagueId: string;
  punishment: Punishment | null;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-zinc-300">
        Last-Place Punishment
      </p>
      <form
        className="space-y-2"
        action={(formData) => {
          startTransition(async () => {
            await setPunishment(leagueId, formData.get("description") as string);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          });
        }}
      >
        <Textarea
          name="description"
          defaultValue={punishment?.description ?? ""}
          placeholder="e.g. Loser buys dinner for the group"
          rows={2}
          required
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}

// ─── Delete league dialog ──────────────────────────────────────────────────────

function DeleteLeagueButton({ league }: { league: League }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isConfirmed =
    confirmText.trim() === league.name || confirmText.trim() === "DELETE";

  function close() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete League
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-red-900/50 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-red-400">
              Delete League
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              This permanently deletes{" "}
              <span className="font-semibold text-zinc-200">{league.name}</span>{" "}
              and all its data — members, picks, results, and comments. This
              cannot be undone.
            </p>
            <p className="mb-2 text-xs text-zinc-500">
              Type{" "}
              <span className="rounded bg-zinc-800 px-1 font-mono text-zinc-200">
                {league.name}
              </span>{" "}
              or{" "}
              <span className="rounded bg-zinc-800 px-1 font-mono text-zinc-200">
                DELETE
              </span>{" "}
              to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={league.name}
              className="mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmed) {
                  e.preventDefault();
                  startTransition(async () => {
                    const result = await deleteLeague(league.id);
                    if (result?.error) setError(result.error);
                  });
                }
              }}
            />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={close}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!isConfirmed || isPending}
                className="flex-1"
                onClick={() => {
                  startTransition(async () => {
                    const result = await deleteLeague(league.id);
                    if (result?.error) setError(result.error);
                  });
                }}
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
