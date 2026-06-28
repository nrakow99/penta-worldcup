"use client";

import { useRef, useState, useTransition } from "react";
import { importGroupStageData } from "@/lib/actions/import-actions";
import {
  IMPORT_TEMPLATES,
  IMPORT_COLUMN_HINTS,
  type ImportType,
} from "@/lib/import/templates";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, FileSpreadsheet } from "lucide-react";

interface DataImportPanelProps {
  leagueId: string;
}

const IMPORT_TYPES: { id: ImportType; label: string; description: string }[] = [
  {
    id: "teams",
    label: "Teams",
    description: "Teams + group assignments",
  },
  {
    id: "fixtures",
    label: "Fixtures",
    description: "Upcoming matches with dates",
  },
  {
    id: "results",
    label: "Results",
    description: "Final scores (updates standings)",
  },
];

function downloadTemplate(type: ImportType, format: "csv" | "json") {
  const content = IMPORT_TEMPLATES[type][format];
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataImportPanel({ leagueId }: DataImportPanelProps) {
  const [importType, setImportType] = useState<ImportType>("teams");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setResult({ type: "error", message: "Choose a CSV or JSON file first." });
      return;
    }

    setResult(null);
    const formData = new FormData();
    formData.set("leagueId", leagueId);
    formData.set("importType", importType);
    formData.set("file", file);

    startTransition(async () => {
      const res = await importGroupStageData(formData);
      if (res.error) {
        setResult({ type: "error", message: res.error });
      } else {
        setResult({ type: "success", message: res.message ?? "Import complete" });
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  return (
    <Card className="border-emerald-900/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-emerald-400">
          <FileSpreadsheet className="h-4 w-4" />
          Import CSV / JSON
        </CardTitle>
      </CardHeader>

      <p className="mb-4 text-xs text-zinc-400">
        Bulk-import teams, fixtures, or results when API-Football data is
        unavailable. Import teams first, then fixtures, then results.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setImportType(t.id)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              importType === t.id
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            <span className="font-medium">{t.label}</span>
            <span className="mt-0.5 block text-zinc-500">{t.description}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">
          Required columns ({importType})
        </p>
        <code className="text-xs text-zinc-400">
          {IMPORT_COLUMN_HINTS[importType].join(", ")}
        </code>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => downloadTemplate(importType, "csv")}
          >
            <Download className="mr-1 h-3 w-3" />
            CSV template
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => downloadTemplate(importType, "json")}
          >
            <Download className="mr-1 h-3 w-3" />
            JSON template
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
        />
        <Button size="sm" disabled={isPending} onClick={handleImport}>
          <Upload className="mr-1 h-3 w-3" />
          {isPending ? "Importing..." : `Import ${importType}`}
        </Button>
      </div>

      {result && (
        <p
          className={`mt-3 text-sm ${result.type === "success" ? "text-emerald-400" : "text-red-400"}`}
        >
          {result.message}
        </p>
      )}
    </Card>
  );
}
