import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  bulkMarkAttendance,
  fetchAttendanceByDate,
  fetchInterventions,
  fetchPulse,
  fetchSystemSummary,
  fetchStudents,
  fetchTimeline,
  listenAttendance,
  listenParentTimeline,
  loginDemoTeacher,
} from "./services/api";
import type {
  AttendanceRecord,
  InterventionItem,
  ParentTimelineItem,
  PulseSnapshot,
  StudentSummary,
  SystemSummary,
} from "./models/schemas";

type ModuleTab = "mission" | "students" | "attendance";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

const mockTimeline: ParentTimelineItem[] = [
  {
    id: "T-1",
    time: "Today, 10:12 AM",
    title: "Moment of Excellence",
    message: "Rahat showed 100% focus in Science today and led the lab team briefing.",
    tone: "POSITIVE",
  },
  {
    id: "T-2",
    time: "Today, 08:40 AM",
    title: "Attendance Update",
    message: "Check-in confirmed before first bell. Homeroom target streak is now 4 days.",
    tone: "NEUTRAL",
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [schoolId] = useState(1);
  const [tab, setTab] = useState<ModuleTab>("mission");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [interventions, setInterventions] = useState<InterventionItem[]>([]);
  const [timeline, setTimeline] = useState<ParentTimelineItem[]>(mockTimeline);
  const [pulse, setPulse] = useState<PulseSnapshot | null>(null);
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [liveAttendanceFeed, setLiveAttendanceFeed] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Loading demo dataset...");
  const [selectedClass, setSelectedClass] = useState("1");
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceStatus>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const classOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((student) => student.class_name)));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const classStudents = useMemo(
    () => students.filter((student) => student.class_name === selectedClass),
    [students, selectedClass],
  );

  const cards = useMemo(() => {
    const pulseScore = pulse?.pulse_score ?? 0;
    const successAvg =
      students.length > 0 ? Math.round(students.reduce((acc, s) => acc + Number(s.success_prediction), 0) / students.length) : 0;
    return [
      { label: "Campus Pulse", value: `${pulseScore.toFixed(1)}%`, icon: Activity, accent: "text-lime-300" },
      { label: "Attendance Stream", value: `${liveAttendanceFeed.length.toString().padStart(2, "0")}/05`, icon: CalendarCheck, accent: "text-cyan-300" },
      {
        label: "Interventions Open",
        value: `${interventions.filter((item) => !item.is_closed).length}`,
        icon: AlertTriangle,
        accent: "text-amber-300",
      },
      { label: "Success Forecast Avg", value: `${successAvg}%`, icon: TrendingUp, accent: "text-emerald-300" },
    ];
  }, [interventions, liveAttendanceFeed.length, pulse, students]);

  useEffect(() => {
    const load = async () => {
      try {
        await loginDemoTeacher();
        const [studentData, interventionData, pulseData, timelineData] = await Promise.all([
          fetchStudents(),
          fetchInterventions(schoolId),
          fetchPulse(schoolId),
          fetchTimeline(),
        ]);

        const summaryData = await fetchSystemSummary(schoolId);

        setStudents(studentData);
        setInterventions(interventionData);
        setPulse(pulseData);
        setSummary(summaryData);
        setTimeline(timelineData.length > 0 ? timelineData : mockTimeline);
        setSelectedClass(studentData[0]?.class_name ?? "1");
        setStatusMessage(`Loaded ${studentData.length} students from live backend.`);
      } catch (error) {
        setStatusMessage("Demo login or data fetch failed. Run seed command and refresh.");
      }
    };

    load();
  }, [schoolId]);

  useEffect(() => {
    const closeAttendance = listenAttendance(schoolId, (payload) => {
      setLiveAttendanceFeed((prev) => [`${payload.student_name}: ${payload.status} (${payload.date})`, ...prev].slice(0, 5));
    });

    const closeParent = listenParentTimeline(11, (payload) => {
      const entry: ParentTimelineItem = {
        id: `ws-${Date.now()}`,
        title: payload.event.kind,
        message: payload.event.message,
        time: "Live now",
        tone: payload.event.kind === "ABSENCE_ALERT" ? "ALERT" : "POSITIVE",
      };
      setTimeline((prev) => [entry, ...prev].slice(0, 8));
    });

    return () => {
      closeAttendance();
      closeParent();
    };
  }, [schoolId]);

  useEffect(() => {
    const loadAttendance = async () => {
      if (classStudents.length === 0) {
        return;
      }
      try {
        const rows = await fetchAttendanceByDate(attendanceDate);
        const map: Record<number, AttendanceStatus> = {};
        rows.forEach((row: AttendanceRecord) => {
          map[row.student] = row.status;
        });
        setAttendanceMap(map);
      } catch {
        // Keep manual state if fetch fails.
      }
    };

    loadAttendance();
  }, [attendanceDate, classStudents]);

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (classStudents.length === 0) {
      setStatusMessage("No students found in this class.");
      return;
    }

    setIsSavingAttendance(true);
    try {
      const records = classStudents.map((student) => ({
        student: student.id,
        status: attendanceMap[student.id] ?? "PRESENT",
      }));
      const result = await bulkMarkAttendance(attendanceDate, records);
      const refreshedRows = await fetchAttendanceByDate(attendanceDate);
      const refreshedMap: Record<number, AttendanceStatus> = {};
      refreshedRows.forEach((row: AttendanceRecord) => {
        refreshedMap[row.student] = row.status;
      });
      setAttendanceMap(refreshedMap);
      setStatusMessage(`${result.count} attendance rows saved for class ${selectedClass} on ${attendanceDate}.`);
    } catch {
      setStatusMessage("Attendance save failed. Verify teacher demo login and backend server.");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  return (
    <div className="min-h-screen mission-bg text-slate-100">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <header className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="mono text-xs tracking-[0.3em] text-cyan-200/80">BSSC // MISSION CONTROL</p>
            <h1 className="heading text-2xl sm:text-3xl">Begum Shahanara Smart Campus</h1>
            <p className="mt-1 text-xs text-cyan-100/80">{statusMessage}</p>
          </div>
          <div className="flex gap-2">
            {[
              { key: "mission", label: "Mission", icon: Sparkles },
              { key: "students", label: "Students", icon: UserRound },
              { key: "attendance", label: "Attendance", icon: CalendarCheck },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key as ModuleTab)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tab === item.key ? "border-cyan-200 bg-cyan-100 text-slate-900" : "border-slate-500/60 bg-slate-900/50 text-slate-200"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {tab === "mission" && (
            <motion.section
              key="mission"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card, idx) => (
                  <motion.article
                    key={card.label}
                    initial={{ y: 70, opacity: 0, scale: 0.92 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 22, delay: idx * 0.05 }}
                    className="glass-panel tech-grid p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <card.icon className={card.accent} />
                      <Sparkles className="h-4 w-4 text-slate-300/70" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">{card.label}</p>
                    <p className="mono mt-2 text-3xl font-bold text-white">{card.value}</p>
                  </motion.article>
                ))}
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <article className="glass-panel tech-grid xl:col-span-4 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="heading text-lg">Executive System Summary</h2>
                    <GraduationCap className="h-5 w-5 text-emerald-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SummaryStat label="Total Students" value={`${summary?.totals?.students ?? students.length}`} />
                    <SummaryStat label="Active Classes" value={`${summary?.totals?.classes ?? classOptions.length}`} />
                    <SummaryStat label="AI Logs" value={`${summary?.totals?.ai_logs ?? 0}`} />
                    <SummaryStat label="Open Interventions" value={`${summary?.totals?.open_interventions ?? interventions.length}`} />
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-500/40 bg-slate-900/60 p-3 text-xs">
                    <p className="mb-1 uppercase tracking-[0.18em] text-slate-400">Attendance Command</p>
                    <p className="mono text-lg text-cyan-100">Today {summary?.attendance?.today_rate?.toFixed(1) ?? "0.0"}%</p>
                    <p className="text-slate-300">
                      Present {summary?.attendance?.today_present ?? 0} | Absent {summary?.attendance?.today_absent ?? 0} | Late {summary?.attendance?.today_late ?? 0}
                    </p>
                    <p className="mt-1 text-slate-400">30-day stability: {summary?.attendance?.thirty_day_rate?.toFixed(1) ?? "0.0"}%</p>
                  </div>
                </article>

                <article className="glass-panel tech-grid xl:col-span-4 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="heading text-lg">Risk Distribution</h2>
                    <AlertTriangle className="h-5 w-5 text-amber-200" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <RiskBar label="Stable" color="bg-emerald-300" value={summary?.risk_distribution?.stable ?? 0} total={(summary?.totals?.students ?? students.length) || 1} />
                    <RiskBar label="Watch" color="bg-amber-300" value={summary?.risk_distribution?.watch ?? 0} total={(summary?.totals?.students ?? students.length) || 1} />
                    <RiskBar label="Critical" color="bg-rose-300" value={summary?.risk_distribution?.critical ?? 0} total={(summary?.totals?.students ?? students.length) || 1} />
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-500/40 bg-slate-900/60 p-3 text-xs text-slate-300">
                    Avg Score: <span className="mono text-cyan-100">{summary?.academics?.average_score?.toFixed(1) ?? "0.0"}</span>
                    <br />
                    Avg Success Prediction: <span className="mono text-cyan-100">{summary?.academics?.average_success_prediction?.toFixed(1) ?? "0.0"}%</span>
                  </div>
                </article>

                <article className="glass-panel tech-grid xl:col-span-4 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="heading text-lg">Recent Operational Alerts</h2>
                    <Sparkles className="h-5 w-5 text-violet-200" />
                  </div>
                  <div className="space-y-3">
                    {(summary?.recent_alerts?.length ? summary.recent_alerts : interventions.slice(0, 5)).map((item: any) => (
                      <div key={item.id} className="rounded-xl border border-slate-500/40 bg-slate-900/60 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-semibold text-white">{item.student_name}</p>
                          <span className={`mono text-xs ${item.priority === "HIGH" ? "text-rose-300" : "text-amber-300"}`}>{item.priority}</span>
                        </div>
                        <p className="text-sm text-slate-200">{item.recommendation}</p>
                        {item.rationale ? <p className="mt-2 text-xs text-slate-400">{item.rationale}</p> : null}
                      </div>
                    ))}
                  </div>
                </article>

                <article className="glass-panel tech-grid xl:col-span-12 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="heading text-lg">Class Coverage Matrix (1-10)</h2>
                    <CalendarCheck className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
                    {(summary?.class_breakdown ?? []).map((row) => (
                      <div key={row.class_name} className="rounded-lg border border-slate-500/40 bg-slate-900/60 p-3">
                        <p className="text-xs text-slate-400">Class {row.class_name}</p>
                        <p className="mono text-lg text-cyan-100">{row.student_count}</p>
                        <p className="text-[11px] text-slate-300">Avg Success {row.avg_success.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="glass-panel tech-grid xl:col-span-6 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="heading text-lg">Parent Storyline</h2>
                    <BookOpen className="h-5 w-5 text-violet-200" />
                  </div>
                  <div className="relative border-l border-slate-500/70 pl-4">
                    {timeline.map((item) => (
                      <div key={item.id} className="mb-4">
                        <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${item.tone === "ALERT" ? "bg-rose-300" : item.tone === "POSITIVE" ? "bg-emerald-300" : "bg-cyan-300"}`} />
                        <p className="mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.time}</p>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-slate-200">{item.message}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </motion.section>
          )}

          {tab === "students" && (
            <motion.section
              key="students"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel tech-grid p-4"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="heading text-xl">Student Management</h2>
                <div className="text-xs text-cyan-100/80">Total students: {students.length}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                    <tr>
                      <th className="pb-3">Code</th>
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Class</th>
                      <th className="pb-3">Success %</th>
                      <th className="pb-3">Focus %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-t border-slate-600/50">
                        <td className="py-2 mono text-cyan-100">{student.student_code}</td>
                        <td className="py-2">{student.full_name}</td>
                        <td className="py-2">{student.class_name}</td>
                        <td className="py-2">{Number(student.success_prediction).toFixed(0)}%</td>
                        <td className="py-2">{Number(student.focus_score).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          )}

          {tab === "attendance" && (
            <motion.section
              key="attendance"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel tech-grid p-4"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="heading text-xl">Attendance System</h2>
                <button
                  onClick={handleSaveAttendance}
                  disabled={isSavingAttendance}
                  className="rounded-lg border border-cyan-100/40 bg-cyan-200/20 px-4 py-2 text-sm font-semibold text-cyan-50"
                >
                  {isSavingAttendance ? "Saving..." : "Save Attendance"}
                </button>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs">
                  <span className="mb-1 block text-slate-300">Class</span>
                  <select
                    value={selectedClass}
                    onChange={(event) => setSelectedClass(event.target.value)}
                    className="w-full rounded-lg border border-slate-500/50 bg-slate-900/60 px-3 py-2"
                  >
                    {classOptions.map((option) => (
                      <option key={option} value={option}>
                        Class {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs">
                  <span className="mb-1 block text-slate-300">Date</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-500/50 bg-slate-900/60 px-3 py-2"
                  />
                </label>
              </div>

              <div className="space-y-3">
                {classStudents.map((student) => (
                  <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-500/40 bg-slate-900/60 p-3">
                    <div>
                      <p className="font-semibold">{student.full_name}</p>
                      <p className="mono text-xs text-cyan-100/80">{student.student_code}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(student.id, status)}
                          className={`rounded-md border px-3 py-1 ${
                            (attendanceMap[student.id] ?? "PRESENT") === status
                              ? "border-cyan-200 bg-cyan-100 text-slate-900"
                              : "border-slate-500/60 bg-slate-900/40 text-slate-200"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <footer className="mt-4 text-xs text-slate-300/70">
          Demo credentials: <span className="mono">teacher@bssc.local / Demo12345!</span>
        </footer>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-500/40 bg-slate-900/60 p-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mono text-lg text-cyan-100">{value}</p>
    </div>
  );
}

function RiskBar({
  label,
  color,
  value,
  total,
}: {
  label: string;
  color: string;
  value: number;
  total: number;
}) {
  const pct = Math.round((value / Math.max(1, total)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="mono">{value} ({pct}%)</span>
      </div>
      <div className="h-2 rounded bg-slate-800">
        <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
