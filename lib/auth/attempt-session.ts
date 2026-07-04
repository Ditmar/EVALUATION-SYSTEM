import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { attemptCookieName, MAX_ATTEMPT_COOKIE_AGE_SECONDS } from "@/lib/constants";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado en el entorno.");
  }
  return new TextEncoder().encode(secret);
}

export interface AttemptSessionPayload {
  examId: string;
  attemptId: string;
}

export async function signAttemptSession(payload: AttemptSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_ATTEMPT_COOKIE_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAttemptSession(token: string): Promise<AttemptSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.examId !== "string" || typeof payload.attemptId !== "string") return null;
    return { examId: payload.examId, attemptId: payload.attemptId };
  } catch {
    return null;
  }
}

function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE !== "false";
}

export function setAttemptCookie(response: NextResponse, examToken: string, jwt: string): void {
  response.cookies.set(attemptCookieName(examToken), jwt, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_ATTEMPT_COOKIE_AGE_SECONDS,
  });
}

/**
 * Reads and verifies the attempt cookie for a given exam token, and confirms
 * the signed `examId` matches the exam being addressed by the URL — prevents a
 * cookie minted for one exam from being replayed against another.
 */
export async function getAttemptSessionFromRequest(
  request: NextRequest,
  examToken: string,
  examId: string
): Promise<AttemptSessionPayload | null> {
  const token = request.cookies.get(attemptCookieName(examToken))?.value;
  if (!token) return null;
  const payload = await verifyAttemptSession(token);
  if (!payload || payload.examId !== examId) return null;
  return payload;
}
