export interface StudentSummary {
  id: number;
  school: number;
  parent: number;
  parent_name?: string;
  student_code: string;
  full_name: string;
  class_name: string;
  roll_number?: number;
  success_prediction: number;
  focus_score: number;
  is_archived?: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  role: "ADMIN" | "TEACHER" | "PARENT";
  phone: string;
  school: number | null;
  is_active: boolean;
}

export interface TeacherAssignment {
  id: number;
  school: number;
  teacher: number;
  teacher_name: string;
  class_name: string;
  subject: string;
  created_at: string;
}

export interface InterventionItem {
  id: number;
  student: number;
  student_name: string;
  recommendation: string;
  rationale: string;
  priority: string;
  is_closed: boolean;
  created_at: string;
}

export interface PulseSnapshot {
  id: number;
  school: number;
  school_name: string;
  pulse_score: number;
  attendance_component: number;
  performance_component: number;
  finance_component: number;
  captured_at: string;
}

export interface ParentTimelineItem {
  id: string;
  title: string;
  message: string;
  time: string;
  tone: "POSITIVE" | "ALERT" | "NEUTRAL";
}

export interface AttendanceSocketPayload {
  student_id: number;
  student_name: string;
  status: string;
  date: string;
}

export interface ParentSocketPayload {
  school_id: number;
  event: {
    kind: string;
    student_id: number;
    student_name: string;
    message: string;
  };
}

export interface AttendanceRecord {
  id: number;
  student: number;
  teacher: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  notes: string;
  created_at: string;
}

export interface AuthTokenResponse {
  access: string;
  refresh: string;
}

export interface SystemSummary {
  school: {
    id: number;
    name: string;
  };
  totals: {
    students: number;
    classes: number;
    open_interventions: number;
    ai_logs: number;
  };
  attendance: {
    today_present: number;
    today_absent: number;
    today_late: number;
    today_rate: number;
    thirty_day_rate: number;
  };
  academics: {
    average_score: number;
    average_success_prediction: number;
  };
  risk_distribution: {
    critical: number;
    watch: number;
    stable: number;
  };
  class_breakdown: Array<{
    class_name: string;
    student_count: number;
    avg_success: number;
  }>;
  recent_alerts: Array<{
    id: number;
    student_name: string;
    priority: string;
    recommendation: string;
    created_at: string;
  }>;
}
