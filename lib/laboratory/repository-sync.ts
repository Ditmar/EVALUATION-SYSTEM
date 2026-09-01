import { prisma } from "@/lib/db";
import { getBranchHeadSha, parseRepositoryUrl } from "@/lib/github/github-service";
import type { RepositoryResource } from "./types";

/**
 * Upserts `LaboratoryRepository` rows to match the `{{repository}}`
 * resources just parsed out of a laboratory's Markdown. If an existing row's
 * `repositoryUrl`/`branch` drifted from what was just parsed, its frozen
 * `commitSha` is reset to `null` — even for an already-published lab, since
 * the markdown-update route doesn't otherwise gate on status. A lab whose
 * repository config changed this way must be explicitly republished before
 * new GitHub submissions can be accepted against it (see the schema comment
 * on `LaboratoryRepository.commitSha`).
 */
export async function syncLaboratoryRepositories(laboratoryId: string, repositories: RepositoryResource[]): Promise<void> {
  for (const resource of repositories) {
    const existing = await prisma.laboratoryRepository.findUnique({
      where: { laboratoryId_resourceId: { laboratoryId, resourceId: resource.id } },
    });
    const drifted = Boolean(existing) && (existing!.repositoryUrl !== resource.url || existing!.branch !== resource.branch);

    await prisma.laboratoryRepository.upsert({
      where: { laboratoryId_resourceId: { laboratoryId, resourceId: resource.id } },
      create: { laboratoryId, resourceId: resource.id, provider: resource.provider, repositoryUrl: resource.url, branch: resource.branch },
      update: {
        provider: resource.provider,
        repositoryUrl: resource.url,
        branch: resource.branch,
        ...(drifted ? { commitSha: null } : {}),
      },
    });
  }
}

/**
 * Resolves and freezes the current HEAD sha of every repository resource's
 * branch — called on every (re-)publish, even if the `{{repository}}` block
 * itself didn't change, so each publish is a fresh reproducibility
 * checkpoint. Already-created `GitHubSubmissionAttempt` rows copy their own
 * `baseCommitSha` and are never affected by a later re-resolution.
 */
export async function resolveLaboratoryRepositorySnapshots(laboratoryId: string): Promise<void> {
  const resources = await prisma.laboratoryRepository.findMany({ where: { laboratoryId } });

  for (const resource of resources) {
    const parsedUrl = parseRepositoryUrl(resource.repositoryUrl);
    if (!parsedUrl) continue; // shouldn't happen — the url was already validated when the placeholder was parsed

    const sha = await getBranchHeadSha(parsedUrl.owner, parsedUrl.repo, resource.branch);
    await prisma.laboratoryRepository.update({ where: { id: resource.id }, data: { commitSha: sha } });
  }
}
