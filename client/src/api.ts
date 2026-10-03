// API client with JWT handling

const TOKEN_KEY = "cpt_token";

export function getToken(): string | null {
  try {
    const stored = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    return stored ? atob(stored) : null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  const encoded = btoa(token);
  sessionStorage.setItem(TOKEN_KEY, encoded);
  localStorage.setItem(TOKEN_KEY, encoded);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Timestamp": new Date().toISOString(),
    "X-Request-ID": crypto.randomUUID(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const bodyStr = body ? JSON.stringify(body) : undefined;

  // Compute body integrity hash for tamper detection
  if (bodyStr) {
    const msgBuffer = new TextEncoder().encode(bodyStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    headers["X-Body-Integrity"] = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  if (res.status === 401) {
    clearToken();
    if (path !== "/auth/login") {
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || "Request failed", data.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

