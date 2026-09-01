"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface Attempt {
  attemptNumber: number;
  pullRequestUrl: string;
  pullRequestNumber: number;
  pullRequestState: string;
  headRepositoryOwner: string;
  headRepositoryName: string;
  headBranch: string;
  baseCommitSha: string;
  submittedCommitSha: string;
  filesChanged: number;
  commitsCount: number;
  additions: number;
  deletions: number;
  submittedAt: string;
}

function DiffLine({ line }: { line: string }) {
  const tone = line.startsWith("+") && !line.startsWith("+++") ? "text-emerald-700 bg-emerald-50" : line.startsWith("-") && !line.startsWith("---") ? "text-red-700 bg-red-50" : "text-slate-500";
  return <div className={`whitespace-pre px-2 font-mono text-xs ${tone}`}>{line || " "}</div>;
}

function FileDiff({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className="font-mono text-xs text-slate-700">{file.filename}</span>
        <span className="shrink-0 text-xs text-slate-500">
          +{file.additions} -{file.deletions}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-slate-200 py-1">
          {file.patch ? file.patch.split("\n").map((line, i) => <DiffLine key={i} line={line} />) : (
            <p className="px-2 py-2 text-xs text-slate-400">(sin patch disponible — posible archivo binario)</p>
          )}
        </div>
      )}
    </div>
  );
}

export function GitHubReviewPanel({ labId, submissionId, questionId }: { labId: string; submissionId: string; questionId: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [files, setFiles] = useState<DiffFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/laboratories/${labId}/submissions/${submissionId}/github-diff?questionId=${encodeURIComponent(questionId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "No se pudo cargar la entrega de GitHub.");
          return;
        }
        setAttempt(data.attempt);
        setFiles(data.diff.files);
      })
      .catch(() => setError("No se pudo cargar la entrega de GitHub."));
  }, [labId, submissionId, questionId]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!attempt || !files) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Cargando entrega de GitHub...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="mb-1 flex items-center gap-2">
          <a href={attempt.pullRequestUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline">
            PR #{attempt.pullRequestNumber}
          </a>
          <Badge tone={attempt.pullRequestState === "merged" ? "green" : attempt.pullRequestState === "closed" ? "gray" : "blue"}>
            {attempt.pullRequestState}
          </Badge>
        </div>
        <p className="text-slate-600">
          {attempt.headRepositoryOwner}/{attempt.headRepositoryName} · rama {attempt.headBranch}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">
          base {attempt.baseCommitSha.slice(0, 12)} → entregado {attempt.submittedCommitSha.slice(0, 12)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {attempt.filesChanged} archivos · {attempt.commitsCount} commits · +{attempt.additions}/-{attempt.deletions} · intento #
          {attempt.attemptNumber}
        </p>
      </div>

      <div className="space-y-1.5">
        {files.map((file) => (
          <FileDiff key={file.filename} file={file} />
        ))}
      </div>
    </div>
  );
}
