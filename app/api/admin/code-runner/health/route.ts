import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { languageRuntime } from "@/lib/code-runner/languages";
import { listPistonRuntimes } from "@/lib/code-runner/piston-client";
import { IDE_LANGUAGES } from "@/lib/code-runner/types";

/** Is Piston reachable, and is every pinned runtime installed? */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  const expected = IDE_LANGUAGES.map((language) => {
    const { piston, version } = languageRuntime(language);
    return { language, piston, version };
  });

  try {
    const installed = await listPistonRuntimes();
    const languages = expected.map((e) => ({
      ...e,
      installed: installed.some((r) => r.language === e.piston && r.version === e.version),
    }));
    return NextResponse.json({ ok: languages.every((l) => l.installed), reachable: true, languages });
  } catch (error) {
    console.error("[code-runner] health:", (error as Error).message);
    return NextResponse.json(
      { ok: false, reachable: false, languages: expected.map((e) => ({ ...e, installed: false })) },
      { status: 503 }
    );
  }
}
