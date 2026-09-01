import { parsePlaceholderAttributes } from "./parse-placeholder";
import { REPOSITORY_PROVIDERS, type LaboratoryParseError, type RepositoryProvider, type RepositoryResource } from "./types";

const REPOSITORY_PLACEHOLDER = /\{\{repository([\s\S]*?)\}\}/g;
const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

/**
 * Pulls every `{{repository ...}}` declaration out of the raw Markdown
 * source, before Markdown parsing begins — like `extractRubrics`, this is
 * laboratory-level metadata, not renderable prose, so it never becomes a
 * `content[]` node and is stripped from the source before `remark` sees it.
 */
export function extractRepositories(source: string): { source: string; repositories: RepositoryResource[]; errors: LaboratoryParseError[] } {
  const repositories: RepositoryResource[] = [];
  const errors: LaboratoryParseError[] = [];
  const seenIds = new Set<string>();

  const stripped = source.replace(REPOSITORY_PLACEHOLDER, (_match, attrString: string) => {
    const attrs = parsePlaceholderAttributes(attrString);

    const id = attrs.id?.trim();
    if (!id) {
      errors.push({ message: 'Se encontró un placeholder "repository" sin atributo "id" obligatorio.' });
      return "";
    }
    if (seenIds.has(id)) {
      errors.push({ message: `Duplicate repository id: "${id}".` });
      return "";
    }

    const providerAttr = attrs.provider?.trim();
    if (!providerAttr) {
      errors.push({ message: `Repository "${id}" debe definir "provider".` });
      return "";
    }
    if (!(REPOSITORY_PROVIDERS as readonly string[]).includes(providerAttr)) {
      errors.push({ message: `Repository "${id}" tiene provider="${providerAttr}" inválido. Valores soportados: ${REPOSITORY_PROVIDERS.join(", ")}.` });
      return "";
    }

    const url = attrs.url?.trim();
    if (!url) {
      errors.push({ message: `Repository "${id}" debe definir "url".` });
      return "";
    }
    if (!GITHUB_URL.test(url)) {
      errors.push({ message: `Repository "${id}" tiene una url de GitHub inválida: "${url}".` });
      return "";
    }

    seenIds.add(id);
    repositories.push({ id, provider: providerAttr as RepositoryProvider, url, branch: attrs.branch?.trim() || "main" });
    return "";
  });

  return { source: stripped, repositories, errors };
}
