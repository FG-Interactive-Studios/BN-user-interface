import { api, ApiError } from "./api";

export interface AdminMode {
  mode: {
    id: string;
    name: string;
    geometry: { kind: string; cells: { row: number; col: number }[] };
    fleet: { type: string; length: number }[];
    placementDirections: string[];
  };
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
}

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
}

let session: SessionResponse | null = null;

function asJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function signInAdmin(email: string, password: string): Promise<AdminMode[]> {
  session = await api<SessionResponse>("/auth/login", asJson({ email, password }));
  try {
    return await getAdminModes();
  } catch (error) {
    // A valid player login does not imply admin access. Revoke that session.
    await signOutAdmin();
    throw error;
  }
}

async function withAdminToken<T>(path: string, options?: RequestInit): Promise<T> {
  if (!session) throw new ApiError(401);
  const request = () => api<T>(path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${session?.accessToken ?? ""}`,
    },
  });
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !session) throw error;
    try {
      session = await api<SessionResponse>("/auth/refresh", asJson({
        refreshToken: session.refreshToken,
      }));
    } catch {
      session = null;
      throw new ApiError(401);
    }
    return request();
  }
}

export function getAdminModes(): Promise<AdminMode[]> {
  return withAdminToken<AdminMode[]>("/admin/game-modes");
}

export function changeModeAvailability(id: string, enabled: boolean): Promise<AdminMode> {
  return withAdminToken<AdminMode>(
    `/admin/game-modes/${encodeURIComponent(id)}/availability`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }
  );
}

export async function signOutAdmin(): Promise<void> {
  const current = session;
  session = null;
  if (!current) return;
  try {
    await api<void>("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${current.accessToken}` },
    });
  } catch {
    // The local session is cleared even if the network is down.
  }
}
