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
  TeacherAssignment,
  UserProfile,
} from "../models/schemas";

const API_ROOT = "/api/v1";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function asList<T>(payload: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function getAccessToken(): string | null {
  return localStorage.getItem("bssc_access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("bssc_refresh_token");
}

function setTokens(tokens: AuthTokenResponse): void {
  localStorage.setItem("bssc_access_token", tokens.access);
  localStorage.setItem("bssc_refresh_token", tokens.refresh);
}

export function clearSession(): void {
  localStorage.removeItem("bssc_access_token");
  localStorage.removeItem("bssc_refresh_token");
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_ROOT}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials.");
  }
  setTokens((await response.json()) as AuthTokenResponse);
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }
  const response = await fetch(`${API_ROOT}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    clearSession();
    return false;
  }
  const payload = (await response.json()) as { access: string };
  localStorage.setItem("bssc_access_token", payload.access);
  return true;
}

async function withAuthRetry<T>(requestFn: () => Promise<Response>): Promise<T> {
  let response = await requestFn();
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new Error("Session expired. Please login again.");
    }
    response = await requestFn();
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function http<T>(path: string): Promise<T> {
  return withAuthRetry<T>(() =>
    fetch(`${API_ROOT}${path}`, {
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
    }),
  );
}

async function httpWithBody<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  return withAuthRetry<T>(() =>
    fetch(`${API_ROOT}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function fetchMe(): Promise<UserProfile> {
  const payload = await http<UserProfile[] | UserProfile>("/auth/me/");
  return Array.isArray(payload) ? payload[0] : payload;
}

export async function fetchStudents(): Promise<StudentSummary[]> {
  const payload = await http<StudentSummary[] | PaginatedResponse<StudentSummary>>("/students/");
  return asList(payload);
}

export async function createStudent(input: {
  school: number;
  parent: number;
  student_code: string;
  full_name: string;
  class_name: string;
  roll_number: number;
}): Promise<StudentSummary> {
  return httpWithBody<StudentSummary>("/students/", "POST", input);
}

export async function updateStudent(studentId: number, input: Partial<StudentSummary>): Promise<StudentSummary> {
  return httpWithBody<StudentSummary>(`/students/${studentId}/`, "PATCH", input);
}

export async function archiveStudent(studentId: number): Promise<void> {
  await httpWithBody<Record<string, never>>(`/students/${studentId}/`, "DELETE");
}

export async function fetchUsers(params?: { role?: "ADMIN" | "TEACHER" | "PARENT" }): Promise<UserProfile[]> {
  const query = params?.role ? `?role=${params.role}` : "";
  const payload = await http<UserProfile[] | PaginatedResponse<UserProfile>>(`/users/${query}`);
  return asList(payload);
}

export async function createTeacher(input: {
  email: string;
  username: string;
  school: number;
  phone?: string;
  password: string;
}): Promise<UserProfile> {
  return httpWithBody<UserProfile>("/users/", "POST", {
    ...input,
    role: "TEACHER",
    is_active: true,
  });
}

export async function updateUser(userId: number, input: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
  return httpWithBody<UserProfile>(`/users/${userId}/`, "PATCH", input);
}

export async function fetchTeacherAssignments(): Promise<TeacherAssignment[]> {
  const payload = await http<TeacherAssignment[] | PaginatedResponse<TeacherAssignment>>("/teacher-assignments/");
  return asList(payload);
}

export async function createTeacherAssignment(input: {
  school: number;
  teacher: number;
  class_name: string;
  subject: string;
}): Promise<TeacherAssignment> {
  return httpWithBody<TeacherAssignment>("/teacher-assignments/", "POST", input);
}

export async function fetchInterventions(schoolId: number): Promise<InterventionItem[]> {
  const payload = await http<InterventionItem[] | PaginatedResponse<InterventionItem>>(`/interventions/?school=${schoolId}`);
  return asList(payload);
}

export async function fetchPulse(schoolId: number): Promise<PulseSnapshot> {
  return http<PulseSnapshot>(`/pulse/?school=${schoolId}`);
}

export async function fetchSystemSummary(schoolId: number): Promise<SystemSummary> {
  return http<SystemSummary>(`/system-summary/?school=${schoolId}`);
}

export async function fetchTimeline(): Promise<ParentTimelineItem[]> {
  return [];
}

export async function fetchAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
  const payload = await http<AttendanceRecord[] | PaginatedResponse<AttendanceRecord>>(`/attendance/?date=${date}`);
  return asList(payload);
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
