interface LiveAttempt {
  id: string;
  nombres: string;
  apellidos: string;
  differentIp: boolean;
}

export function IpAlertBanner({ attempts }: { attempts: LiveAttempt[] }) {
  const flagged = attempts.filter((a) => a.differentIp);
  if (flagged.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-medium">Alerta de supervisión de IP</p>
      <ul className="mt-1 list-inside list-disc">
        {flagged.map((a) => (
          <li key={a.id}>
            {a.nombres} {a.apellidos} está realizando el examen desde una IP distinta a la predominante
            del grupo.
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-amber-700">
        Esto es sólo una alerta informativa, no una prueba de fraude.
      </p>
    </div>
  );
}
