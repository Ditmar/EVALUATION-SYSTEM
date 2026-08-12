import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  STUDENT_ACCESS_COOKIE,
  STUDENT_ACCESS_TTL_SECONDS,
  STUDENT_REFRESH_COOKIE,
  STUDENT_REFRESH_COOKIE_PATH,
  STUDENT_REFRESH_TTL_SECONDS,
} from "@/lib/constants";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado en el entorno.");
  }
  return new TextEncoder().encode(secret);
}

export interface StudentAccessPayload {
  studentId: string;
}

export interface StudentRefreshPayload {
  studentId: string;
  familyId: string;
  jti: string;
}

export interface StudentSessionTokens {
  accessToken: string;
  refreshToken: string;
}

async function signStudentAccessToken(studentId: string): Promise<string> {
  return new SignJWT({ typ: "student_access", studentId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_ACCESS_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

async function signStudentRefreshToken(payload: StudentRefreshPayload): Promise<string> {
  return new SignJWT({ typ: "student_refresh", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_REFRESH_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyStudentAccessToken(token: string): Promise<StudentAccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.typ !== "student_access" || typeof payload.studentId !== "string") return null;
    return { studentId: payload.studentId };
  } catch {
    return null;
  }
}

export async function verifyStudentRefreshToken(token: string): Promise<StudentRefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.typ !== "student_refresh" ||
      typeof payload.studentId !== "string" ||
      typeof payload.familyId !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return null;
    }
    return { studentId: payload.studentId, familyId: payload.familyId, jti: payload.jti };
  } catch {
    return null;
  }
}

function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE !== "false";
}

export function setStudentSessionCookies(response: NextResponse, tokens: StudentSessionTokens): void {
  response.cookies.set(STUDENT_ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_ACCESS_TTL_SECONDS,
  });
  response.cookies.set(STUDENT_REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: STUDENT_REFRESH_COOKIE_PATH,
    maxAge: STUDENT_REFRESH_TTL_SECONDS,
  });
}

export function clearStudentSessionCookies(response: NextResponse): void {
  response.cookies.set(STUDENT_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(STUDENT_REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: STUDENT_REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}

export async function getStudentSessionFromRequest(
  request: NextRequest
): Promise<StudentAccessPayload | null> {
  const token = request.cookies.get(STUDENT_ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyStudentAccessToken(token);
}

/**
 * Starts a brand-new rotation chain for a student (login/activation): creates
 * the first `StudentRefreshToken` row and signs the matching access+refresh
 * JWT pair. `refreshStudentSession` (below) continues the same chain.
 */
export async function issueStudentSession(studentId: string): Promise<StudentSessionTokens> {
  const familyId = randomUUID();
  const expiresAt = new Date(Date.now() + STUDENT_REFRESH_TTL_SECONDS * 1000);

  const row = await prisma.studentRefreshToken.create({
    data: { studentId, familyId, expiresAt },
  });

  const [accessToken, refreshToken] = await Promise.all([
    signStudentAccessToken(studentId),
    signStudentRefreshToken({ studentId, familyId, jti: row.id }),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Continues an existing rotation chain: revokes `currentTokenId` and creates
 * a new row under the same `familyId`. Caller (the /refresh route) is
 * responsible for having already validated the presented token via
 * `evaluateRefreshRotation` before calling this.
 */
export async function rotateStudentSession(
  studentId: string,
  familyId: string,
  currentTokenId: string
): Promise<StudentSessionTokens> {
  const expiresAt = new Date(Date.now() + STUDENT_REFRESH_TTL_SECONDS * 1000);

  const newRow = await prisma.studentRefreshToken.create({
    data: { studentId, familyId, expiresAt },
  });

  await prisma.studentRefreshToken.update({
    where: { id: currentTokenId },
    data: { revokedAt: new Date(), replacedByTokenId: newRow.id },
  });

  const [accessToken, refreshToken] = await Promise.all([
    signStudentAccessToken(studentId),
    signStudentRefreshToken({ studentId, familyId, jti: newRow.id }),
  ]);

  return { accessToken, refreshToken };
}

/** Revokes every still-valid token in a rotation chain (reuse detected, or explicit logout). */
export async function revokeStudentSessionFamily(familyId: string): Promise<void> {
  await prisma.studentRefreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
