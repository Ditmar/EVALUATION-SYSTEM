import type { RepositoryDiff } from "@/lib/github/types";

const EXCLUDED_PATH_SEGMENTS = ["node_modules/", "dist/", "build/", "coverage/", ".lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
const MAX_PATCH_CHARS = 20000; // guards against one pathological file (e.g. a generated file) blowing the prompt budget
const MAX_FILES_WITH_PATCH = 25; // beyond this, list filenames only — "priorizar diff/archivos modificados, evitar mandar todo"

export interface RepositoryInfo {
  baseOwner: string;
  baseRepo: string;
  baseBranch: string;
  headOwner: string;
  headRepo: string;
  headBranch: string;
  pullRequestNumber: number;
  commitsCount: number;
}

function isExcludedPath(filename: string): boolean {
  return EXCLUDED_PATH_SEGMENTS.some((segment) => filename.includes(segment));
}

/**
 * Turns a `RepositoryDiff` into one formatted text block, ready to be
 * dropped into the existing `evaluateTextAnswer` prompt as the "student
 * answer" — this is the only artifact `lib/ai/*` ever sees; it has no idea
 * this text came from GitHub. Noise paths (node_modules, build output,
 * lockfiles) are excluded and the total patch volume is capped so a large
 * PR can't blow the model's context budget.
 */
export function formatDiffForPrompt(diff: RepositoryDiff, repo: RepositoryInfo): string {
  const relevantFiles = diff.files.filter((f) => !isExcludedPath(f.filename));
  const withPatch = relevantFiles.slice(0, MAX_FILES_WITH_PATCH);
  const omittedCount = relevantFiles.length - withPatch.length;

  const header = [
    `Repositorio base: ${repo.baseOwner}/${repo.baseRepo} (rama ${repo.baseBranch})`,
    `Pull Request #${repo.pullRequestNumber}: ${repo.headOwner}/${repo.headRepo} (rama ${repo.headBranch})`,
    `Commits: ${repo.commitsCount} | Archivos modificados: ${diff.files.length}`,
    `Cambios evaluados: ${diff.baseSha} → ${diff.headSha}`,
  ].join("\n");

  const sections = withPatch.map((file) => {
    const rawPatch = file.patch ?? "(sin patch disponible — posible archivo binario o diff demasiado grande)";
    const patch = rawPatch.length > MAX_PATCH_CHARS ? `${rawPatch.slice(0, MAX_PATCH_CHARS)}\n... (patch truncado por límite de tamaño)` : rawPatch;
    return `### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})\n\`\`\`diff\n${patch}\n\`\`\``;
  });

  const omittedNote = omittedCount > 0 ? `\n\n(${omittedCount} archivo(s) adicionales no incluidos por límite de contexto.)` : "";
  const excludedNote = diff.files.length > relevantFiles.length ? `\n(${diff.files.length - relevantFiles.length} archivo(s) de dependencias/build excluidos.)` : "";

  return `${header}${excludedNote}\n\n--- Cambios introducidos por el estudiante ---\n\n${sections.join("\n\n")}${omittedNote}`;
}
