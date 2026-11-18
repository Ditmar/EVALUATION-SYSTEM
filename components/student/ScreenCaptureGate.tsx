"use client";

import { MutableRefObject, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MAX_CAPTURE_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

type PenaltyAction = "none" | "warn" | "lock" | "auto_submit";
interface ActivityResult {
  penaltyCount: number;
  remaining: number;
  action: PenaltyAction;
}

type GateState = "unsupported" | "idle" | "requesting" | "sharing";

/**
 * Exige compartir la pantalla completa para mostrar el examen y sube una
 * captura JPEG cada minuto. Si el estudiante deja de compartir, se registra
 * una incidencia y el examen se oculta hasta que vuelva a compartir.
 *
 * `suppressFocusRef` se activa mientras el selector de pantalla del navegador
 * está abierto, para que ActivityMonitor no lo cuente como pérdida de foco.
 */
export function ScreenCaptureGate({
  token,
  suppressFocusRef,
  onActivityResult,
  intervalMinutes,
  children,
}: {
  token: string;
  suppressFocusRef: MutableRefObject<boolean>;
  onActivityResult: (result: ActivityResult) => void;
  intervalMinutes: number;
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastCaptureAt, setLastCaptureAt] = useState<Date | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setState("unsupported");
    }
  }, []);

  const postActivity = useCallback(
    async (type: "screen_share_started" | "screen_share_stopped", detail?: string) => {
      try {
        const res = await fetch(`/api/public/exams/${token}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, detail }),
        });
        if (res.ok) onActivityResult(await res.json());
      } catch {
        // best-effort
      }
    },
    [token, onActivityResult]
  );

  const captureAndUpload = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const scale = Math.min(1, MAX_CAPTURE_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return;

    try {
      const res = await fetch(`/api/public/exams/${token}/captures`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (res.ok) setLastCaptureAt(new Date());
    } catch {
      // best-effort: si una captura falla, la siguiente lo vuelve a intentar
    }
  }, [token]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
  }, []);

  async function startSharing() {
    setError(null);
    setState("requesting");
    suppressFocusRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: 1 } as MediaTrackConstraints,
        audio: false,
      });
    } catch {
      setError("Necesitas permitir compartir la pantalla para rendir este examen.");
      setState("idle");
      return;
    } finally {
      // El foco vuelve a la página un instante después de cerrar el selector.
      setTimeout(() => {
        suppressFocusRef.current = false;
      }, 1000);
    }

    const track = stream.getVideoTracks()[0];
    const surface = (track?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    // Algunos navegadores no informan displaySurface; en ese caso se acepta.
    if (!track || (surface && surface !== "monitor")) {
      stream.getTracks().forEach((t) => t.stop());
      setError('Debes compartir la "Pantalla completa" (no una pestaña ni una ventana).');
      setState("idle");
      return;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    // Fuera de la vista pero en el DOM, para que el navegador siga decodificando frames.
    video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    await video.play().catch(() => {});

    streamRef.current = stream;
    videoRef.current = video;

    track.addEventListener("ended", () => {
      stopStream();
      setState("idle");
      setError("Dejaste de compartir la pantalla. Vuelve a compartirla para continuar con el examen.");
      postActivity("screen_share_stopped");
    });

    setState("sharing");
    postActivity("screen_share_started");
  }

  // Captura inicial (con un pequeño margen para que llegue el primer frame) y luego cada intervalo.
  useEffect(() => {
    if (state !== "sharing") return;
    const first = setTimeout(captureAndUpload, 2000);
    const interval = setInterval(captureAndUpload, Math.max(1, intervalMinutes) * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [state, captureAndUpload, intervalMinutes]);

  const everyLabel = intervalMinutes === 1 ? "cada minuto" : `cada ${intervalMinutes} minutos`;

  useEffect(() => stopStream, [stopStream]);

  if (state === "sharing") {
    return (
      <>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-center text-xs text-slate-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
          Compartiendo pantalla: se toma una captura {everyLabel}
          {lastCaptureAt && ` · última ${lastCaptureAt.toLocaleTimeString("es-BO")}`}
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Este examen requiere compartir tu pantalla</h2>
        {state === "unsupported" ? (
          <p className="text-sm text-slate-600">
            Tu navegador no permite compartir la pantalla. Rinde este examen desde una computadora con Google Chrome,
            Microsoft Edge o Firefox actualizados (no funciona en celulares ni tablets).
          </p>
        ) : (
          <>
            <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-slate-600">
              <li>
                En la ventana del navegador elige <strong>&quot;Pantalla completa&quot;</strong> (no una pestaña ni una
                ventana).
              </li>
              <li>Mientras rindes, se guardará una captura de tu pantalla {everyLabel} para revisión del docente.</li>
              <li>Si dejas de compartir, se registrará una incidencia y el examen se ocultará hasta que vuelvas a compartir.</li>
              <li>El tiempo del examen sigue corriendo mientras no compartas la pantalla.</li>
            </ul>
            {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button onClick={startSharing} disabled={state === "requesting"} className="w-full">
              {state === "requesting" ? "Esperando permiso..." : "Compartir pantalla completa"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
