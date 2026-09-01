"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { studentFetch } from "@/lib/client/student-fetch";
import type { RepositoryResource } from "@/lib/laboratory/types";
import type { AnswerComponentProps, GithubAttemptSummary } from "./types";

interface ValidationResult {
  valid: boolean;
  error?: string;
  pullRequest?: { number: number; state: string; repository: string; branch: string; headSha: string };
  changes?: { commits: number; files: number; additions: number; deletions: number };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" });
}

function AttemptSummary({ attempt, repository }: { attempt: GithubAttemptSummary; repository?: RepositoryResource }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="font-medium">Entrega registrada</p>
      <p className="mt-1">
        PR{" "}
        <a href={attempt.pullRequestUrl} target="_blank" rel="noreferrer" className="underline">
          #{attempt.pullRequestNumber}
        </a>{" "}
        · {attempt.headRepositoryOwner}/{attempt.headRepositoryName} · rama {attempt.headBranch}
      </p>
      <p className="mt-1 font-mono text-xs">
        Commit entregado: {attempt.submittedCommitSha.slice(0, 12)}
        {repository && <> (base: {attempt.baseCommitSha.slice(0, 12)})</>}
      </p>
      <p className="mt-1 text-xs text-emerald-700">
        {attempt.filesChanged} archivos · {attempt.commitsCount} commits · +{attempt.additions}/-{attempt.deletions} · entregado el{" "}
        {formatDate(attempt.submittedAt)}
      </p>
      <p className="mt-2 text-xs text-emerald-700">
        Este commit será utilizado para la evaluación, aunque el Pull Request reciba nuevos commits después.
      </p>
    </div>
  );
}

export function GitHubPrAnswer({ question, disabled, labId, githubAttempt, repository, onChange }: AnswerComponentProps) {
  // Hooks must run unconditionally on every render — the type guard below
  // runs after them, even though the registry only ever dispatches here for
  // a `github-pr` question in practice.
  const [pullRequestUrl, setPullRequestUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<GithubAttemptSummary | null | undefined>(githubAttempt);
  const [showForm, setShowForm] = useState(!currentAttempt);

  if (question.type !== "github-pr") return null;

  async function handleValidate() {
    if (!labId || !pullRequestUrl.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await studentFetch(`/api/student/laboratories/${labId}/github/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, pullRequestUrl: pullRequestUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setValidation(res.ok ? data : { valid: false, error: data.error ?? "No se pudo validar el Pull Request." });
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit() {
    if (!labId || !pullRequestUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await studentFetch(`/api/student/laboratories/${labId}/github/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, pullRequestUrl: pullRequestUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValidation({ valid: false, error: data.error ?? "No se pudo registrar la entrega." });
        return;
      }
      setCurrentAttempt(data.attempt);
      setShowForm(false);
      setValidation(null);
      onChange(pullRequestUrl.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Entrega mediante GitHub Pull Request</p>
        {repository ? (
          <p className="mt-1 text-sm text-slate-500">
            Repositorio base:{" "}
            <a href={repository.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
              {repository.url.replace("https://github.com/", "")}
            </a>{" "}
            (rama {repository.branch})
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-600">Repositorio base no disponible todavía (vista previa).</p>
        )}
      </div>

      {currentAttempt && !showForm && <AttemptSummary attempt={currentAttempt} repository={repository} />}

      {!disabled && labId && showForm && (
        <div className="space-y-3">
          <ol className="list-inside list-decimal space-y-0.5 text-xs text-slate-500">
            <li>Realiza un fork del repositorio</li>
            <li>Implementa tu solución</li>
            <li>Crea una rama</li>
            <li>Abre un Pull Request</li>
            <li>Pega aquí la URL</li>
          </ol>

          <Input
            placeholder="https://github.com/tu-usuario/repo/pull/3"
            value={pullRequestUrl}
            onChange={(e) => {
              setPullRequestUrl(e.target.value);
              setValidation(null);
            }}
          />

          <Button type="button" variant="secondary" onClick={handleValidate} disabled={validating || !pullRequestUrl.trim()}>
            {validating ? "Validando..." : "Validar Pull Request"}
          </Button>

          {validation && !validation.valid && <p className="text-sm text-red-600">{validation.error}</p>}

          {validation?.valid && validation.pullRequest && validation.changes && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>✓ Repositorio encontrado</p>
              <p>✓ Pull Request válido (#{validation.pullRequest.number}, {validation.pullRequest.state})</p>
              <p>✓ Fork: {validation.pullRequest.repository}</p>
              <p>✓ Branch: {validation.pullRequest.branch}</p>
              <p>
                ✓ {validation.changes.files} archivos modificados · {validation.changes.commits} commits · +{validation.changes.additions}/-
                {validation.changes.deletions}
              </p>
              <p className="font-mono text-xs text-slate-500">Commit que será entregado: {validation.pullRequest.headSha.slice(0, 12)}</p>

              <Button type="button" onClick={handleSubmit} disabled={submitting} className="mt-2">
                {submitting ? "Entregando..." : "Entregar laboratorio"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!disabled && currentAttempt && !showForm && (
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setShowForm(true)}>
          Nueva entrega
        </button>
      )}
    </div>
  );
}
