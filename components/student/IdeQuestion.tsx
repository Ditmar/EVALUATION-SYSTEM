"use client";

import { useMemo } from "react";
import { IdeWorkspace } from "@/components/ide/IdeWorkspace";
import { asIdeConfig } from "@/lib/code-runner/ide-config";
import type { IdeAnswerValue } from "@/lib/code-runner/types";

/** Exam adapter for CODE_IDE questions (the lab one is `IdeAnswer`). */
export function IdeQuestion({
  questionId,
  ideConfig,
  value,
  onChange,
  disabled,
  runEndpoint,
  runsUsed,
}: {
  questionId: string;
  ideConfig: unknown;
  value: IdeAnswerValue | undefined;
  onChange: (value: IdeAnswerValue) => void;
  disabled?: boolean;
  runEndpoint?: string;
  runsUsed?: number;
}) {
  const config = useMemo(() => asIdeConfig(ideConfig), [ideConfig]);
  const runBody = useMemo(() => ({ questionId }), [questionId]);
  if (!config) return <p className="text-sm text-red-600">No se pudo cargar el editor de esta pregunta.</p>;

  return (
    <IdeWorkspace
      config={config}
      value={value}
      onChange={onChange}
      runEndpoint={runEndpoint}
      runBody={runBody}
      disabled={disabled}
      initialRunsUsed={runsUsed}
    />
  );
}
