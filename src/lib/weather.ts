import type { WeatherSnapshot } from "./types";

/**
 * Open-Meteo — free, no API key, generous limits (non-commercial).
 * https://open-meteo.com/en/docs  ·  geocoding: https://open-meteo.com/en/docs/geocoding-api
 */
const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

export async function geocode(city: string): Promise<{ name: string; lat: number; lon: number; country?: string } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { results?: { name: string; latitude: number; longitude: number; country?: string }[] };
  const hit = j.results?.[0];
  return hit ? { name: hit.name, lat: hit.latitude, lon: hit.longitude, country: hit.country } : null;
}

/** date = YYYY-MM-DD (today … +15 days). */
export async function getWeather(opts: { lat: number; lon: number; label: string; date?: string }): Promise<WeatherSnapshot> {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: String(opts.lat),
    longitude: String(opts.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error(`Weather unavailable (${r.status})`);
  const j = await r.json();
  const d = j.daily;
  const isToday = date === new Date().toISOString().slice(0, 10);
  return {
    location: opts.label,
    date,
    temp_c: Math.round(isToday ? j.current.temperature_2m : (d.temperature_2m_max[0] + d.temperature_2m_min[0]) / 2),
    feels_like_c: isToday ? Math.round(j.current.apparent_temperature) : undefined,
    temp_min_c: Math.round(d.temperature_2m_min[0]),
    temp_max_c: Math.round(d.temperature_2m_max[0]),
    precipitation_mm: d.precipitation_sum[0],
    rain_chance: d.precipitation_probability_max[0],
    wind_kmh: isToday ? Math.round(j.current.wind_speed_10m) : undefined,
    condition: WMO[isToday ? j.current.weather_code : d.weather_code[0]] ?? "Unknown",
  };
}

export function seasonFor(date: Date, latitude: number | null): "spring" | "summer" | "autumn" | "winter" {
  const m = date.getMonth(); // 0-11
  const north = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"] as const;
  const s = north[m];
  if (latitude !== null && latitude < 0) {
    return ({ winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" } as const)[s];
  }
  return s;
}
