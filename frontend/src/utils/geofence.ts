// Haversine formula to compute distance between 2 coordinates in meters
export function hitungJarakMeter(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface GeofenceValidationResult {
  isWithin: boolean;
  distance: number;
  accuracy: number;
  radius: number;
  message: string;
}

export function validasiGeofence(
  userLat: number,
  userLon: number,
  accuracy: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number = 100
): GeofenceValidationResult {
  const distance = hitungJarakMeter(userLat, userLon, officeLat, officeLon);

  // Buffer slightly for GPS inaccuracy if acceptable, but adhere to radius rule
  const isWithin = distance <= radiusMeters;

  let message = '';
  if (isWithin) {
    message = `Lokasi valid! Anda berada ${distance}m dari kantor (Radius: ${radiusMeters}m, Akurasi GPS: ±${Math.round(accuracy)}m).`;
  } else {
    message = `Anda berada di luar area kantor! Jarak Anda saat ini ${distance}m (Maksimal ${radiusMeters}m). Akurasi GPS: ±${Math.round(accuracy)}m.`;
  }

  return {
    isWithin,
    distance,
    accuracy,
    radius: radiusMeters,
    message,
  };
}
