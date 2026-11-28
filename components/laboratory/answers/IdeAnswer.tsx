"use client";

import { useMemo } from "react";
import { IdeWorkspace } from "@/components/ide/IdeWorkspace";
import { pickIdeConfig } from "@/lib/code-runner/ide-config";
import { isIdeAnswerValue } from "@/lib/code-runner/types";
import { studentFetch } from "@/lib/client/student-fetch";
import type { AnswerComponentProps } from "./types";

/**
 * `type="ide"` answer. Student view (has `labId`, not disabled) runs through
 * the student lab route; teacher views pass `ideRunEndpoint` (the admin
 * route, which receives the config itself). No endpoint → static preview.
 */
export function IdeAnswer({ question, value, onChange, disabled, labId, ideRunEndpoint, ideRunsUsed }: AnswerComponentProps) {
  const config = useMemo(() => (question.type === "ide" ? pickIdeConfig(question) : null), [question]);
  const runBody = useMemo(
    () => (ideRunEndpoint ? { questionId: question.id, config } : { questionId: question.id }),
    [ideRunEndpoint, question.id, config]
  );
  if (question.type !== "ide" || !config) return null;

  const studentRun = Boolean(labId && !disabled && !ideRunEndpoint);
  const runEndpoint = ideRunEndpoint ?? (studentRun ? `/api/student/laboratories/${labId}/run` : undefined);

  return (
    <IdeWorkspace
      config={config}
      value={isIdeAnswerValue(value) ? value : undefined}
      onChange={onChange}
      runEndpoint={runEndpoint}
      runBody={runBody}
      disabled={disabled}
      initialRunsUsed={ideRunsUsed}
      allowRunWhenDisabled={Boolean(ideRunEndpoint)}
      fetcher={studentRun ? studentFetch : undefined}
    />
  );
}
