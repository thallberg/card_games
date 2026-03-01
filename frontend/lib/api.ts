const FALLBACK = "http://localhost:5236";

export async function getApiUrl(): Promise<string> {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    const url = (data.apiUrl ?? FALLBACK).trim().replace(/\/$/, "");
    return url || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/** Anrop mot backend med Authorization-header. Kräver inloggning. */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = await getApiUrl();
  const token = getToken();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
