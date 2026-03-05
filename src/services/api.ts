import type {
  AttendanceRecord,
  AttendanceSocketPayload,
  AuthTokenResponse,
  InterventionItem,
  ParentSocketPayload,
  ParentTimelineItem,
  PulseSnapshot,
  StudentSummary,
  SystemSummary,
} from "../models/schemas";

const API_ROOT = "/api/v1";

async function withAuthRetry<T>(requestFn: () => Promise<Response>): Promise<T> {
  let response = await requestFn();
  if (response.status === 401) {
    localStorage.removeItem("bssc_access_token");
    localStorage.removeItem("bssc_refresh_token");
    await loginDemoTeacher();
    response = await requestFn();
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function http<T>(path: string): Promise<T> {
  const token = localStorage.getItem("bssc_access_token");
  return withAuthRetry<T>(() =>
    fetch(`${API_ROOT}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  );
}

async function httpWithBody<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  return withAuthRetry<T>(() => {
    const token = localStorage.getItem("bssc_access_token");
    return fetch(`${API_ROOT}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  });
}

export async function loginDemoTeacher(): Promise<void> {
  if (localStorage.getItem("bssc_access_token")) {
    return;
  }

  const response = await fetch(`${API_ROOT}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "teacher@bssc.local",
      password: "Demo12345!",
    }),
  });
  if (!response.ok) {
    throw new Error("Demo teacher login failed. Seed data first.");
  }
  const tokens = (await response.json()) as AuthTokenResponse;
  localStorage.setItem("bssc_access_token", tokens.access);
  localStorage.setItem("bssc_refresh_token", tokens.refresh);
}

export async function fetchStudents(): Promise<StudentSummary[]> {
  return http<StudentSummary[]>("/students/");
}

export async function fetchInterventions(schoolId: number): Promise<InterventionItem[]> {
  return http<InterventionItem[]>(`/interventions/?school=${schoolId}`);
}

export async function fetchPulse(schoolId: number): Promise<PulseSnapshot> {
  return http<PulseSnapshot>(`/pulse/?school=${schoolId}`);
}

export async function fetchSystemSummary(schoolId: number): Promise<SystemSummary> {
  return http<SystemSummary>(`/system-summary/?school=${schoolId}`);
}

export async function fetchTimeline(): Promise<ParentTimelineItem[]> {
  // The backend pushes timeline events over WebSocket; this endpoint can be expanded.
  return [];
}

export async function fetchAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
  return http<AttendanceRecord[]>(`/attendance/?date=${date}`);
}

export async function bulkMarkAttendance(
  date: string,
  records: Array<{ student: number; status: "PRESENT" | "ABSENT" | "LATE"; notes?: string }>,
): Promise<{ detail: string; count: number }> {
  return httpWithBody<{ detail: string; count: number }>("/attendance/bulk_mark/", "POST", { date, records });
}

function toWebSocketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${path}`;
}

export function listenAttendance(schoolId: number, onMessage: (payload: AttendanceSocketPayload) => void): () => void {
  const socket = new WebSocket(toWebSocketUrl(`/ws/attendance/${schoolId}/`));
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data) as AttendanceSocketPayload;
    onMessage(data);
  };
  return () => socket.close();
}

export function listenParentTimeline(parentId: number, onMessage: (payload: ParentSocketPayload) => void): () => void {
  const socket = new WebSocket(toWebSocketUrl(`/ws/parent-timeline/${parentId}/`));
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data) as ParentSocketPayload;
    onMessage(data);
  };
  return () => socket.close();
}
