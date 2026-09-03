import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";

/** Lets the admin shell (sidebar) know the caller's role, to show/hide nav items — role is re-checked fresh, never trusted from an older client state. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if ("response" in auth) return auth.response;

  return NextResponse.json({ email: auth.session.email, role: auth.session.role });
}
