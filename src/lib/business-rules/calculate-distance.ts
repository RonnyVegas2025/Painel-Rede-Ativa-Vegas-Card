export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine. Erro abaixo de 0,5% nas distancias de check-in, que sao de centenas de metros. */
export function distanceInMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface CheckinEvaluation {
  distanceMeters: number;
  withinRadius: boolean;
  requiresException: boolean;
  accuracyPoor: boolean;
  message: string;
}

/**
 * Avalia o check-in considerando a precisao informada pelo dispositivo.
 *
 * Em corredor urbano o GPS de celular frequentemente reporta precisao pior que o
 * proprio raio. Comparar distancia crua com o raio reprovaria o consultor que
 * esta dentro da loja. A margem e (distancia - precisao): o consultor passa se
 * puder plausivelmente estar dentro do raio.
 *
 * A precisao e sempre registrada junto, para a auditoria distinguir check-in
 * confiavel de check-in tolerado.
 */
export function evaluateCheckin(
  consultant: Coordinates,
  establishment: Coordinates,
  radiusMeters: number,
  accuracyMeters: number | null,
): CheckinEvaluation {
  const distance = distanceInMeters(consultant, establishment);
  const accuracy = accuracyMeters ?? 0;
  const plausibleMinimum = Math.max(0, distance - accuracy);
  const within = plausibleMinimum <= radiusMeters;
  const accuracyPoor = accuracy > radiusMeters;

  return {
    distanceMeters: Math.round(distance),
    withinRadius: within,
    requiresException: !within,
    accuracyPoor,
    message: within
      ? accuracyPoor
        ? `Check-in liberado, mas a precisão do GPS está baixa (±${Math.round(accuracy)} m).`
        : `A ${Math.round(distance)} m do estabelecimento.`
      : `A ${Math.round(distance)} m do estabelecimento, acima do limite de ${radiusMeters} m. Justifique para registrar o check-in.`,
  };
}
