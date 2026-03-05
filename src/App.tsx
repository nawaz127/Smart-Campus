import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import {
  archiveStudent,
  bulkMarkAttendance,
  clearSession,
  createStudent,
  createTeacher,
  createTeacherAssignment,
  fetchAttendanceByDate,
  fetchInterventions,
  fetchMe,
  fetchStudents,
  fetchSystemSummary,
  fetchTeacherAssignments,
  fetchUsers,
  login,
  updateStudent,
} from "./services/api";
import type { AttendanceRecord, StudentSummary, TeacherAssignment, UserProfile } from "./models/schemas";

type Page = "dashboard" | "students" | "attendance" | "teachers";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const roleLabel: Record<UserProfile["role"], string> = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  PARENT: "PARENT",
};

export default function App() {
  const [email, setEmail] = useState("teacher@bssc.local");
  const [password, setPassword] = useState("Demo12345!");
  const [authError, setAuthError] = useState("");
  const [me, setMe] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<Page>("dashboard");

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [interventions, setInterventions] = useState<any[]>([]);

  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceStatus>>({});

  const [studentForm, setStudentForm] = useState({
    id: 0,
    full_name: "",
    student_code: "",
    class_name: "1",
    roll_number: 1,
    parent: 0,
  });

  const [teacherForm, setTeacherForm] = useState({
    email: "",
    username: "",
    password: "Demo12345!",
    phone: "",
  });

  const [assignmentForm, setAssignmentForm] = useState({
    teacher: 0,
    class_name: "1",
    subject: "Math",
  });

  const [status, setStatus] = useState("Login required.");

  const classStudents = useMemo(
    () => students.filter((s) => s.class_name === studentForm.class_name),
    [students, studentForm.class_name],
  );

  const navItems = useMemo(() => {
    const base = [
      { key: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
      { key: "students" as Page, label: "Students", icon: Users },
      { key: "attendance" as Page, label: "Attendance", icon: CalendarCheck },
    ];
    if (me?.role === "ADMIN") {
      base.push({ key: "teachers" as Page, label: "Teachers", icon: UserCog });
    }
    return base;
  }, [me?.role]);

  async function loadCoreData(profile: UserProfile) {
    if (!profile.school) {
      setStatus("No school assigned to this user.");
      return;
    }
    const [studentRows, parentRows, teacherRows, summaryData, interventionRows] = await Promise.all([
      fetchStudents(),
      fetchUsers({ role: "PARENT" }),
      fetchUsers({ role: "TEACHER" }),
      fetchSystemSummary(profile.school),
      fetchInterventions(profile.school),
    ]);

    setStudents(studentRows);
    setParents(parentRows);
    setTeachers(teacherRows);
    setSummary(summaryData);
    setInterventions(interventionRows);

    if (profile.role === "ADMIN") {
      const teacherAssignments = await fetchTeacherAssignments();
      setAssignments(teacherAssignments);
    }

    setStudentForm((prev) => ({ ...prev, parent: parentRows[0]?.id ?? 0 }));
    setAssignmentForm((prev) => ({ ...prev, teacher: teacherRows[0]?.id ?? 0 }));
    setStatus(`Welcome ${profile.email}. Loaded ${studentRows.length} students.`);
  }

  async function tryRestoreSession() {
    try {
      const profile = await fetchMe();
      setMe(profile);
      await loadCoreData(profile);
    } catch {
      clearSession();
    }
  }

  useEffect(() => {
    tryRestoreSession();
  }, []);

  async function handleLogin() {
    setAuthError("");
    try {
      await login(email, password);
      const profile = await fetchMe();
      setMe(profile);
      await loadCoreData(profile);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed.");
    }
  }

  function handleLogout() {
    clearSession();
    setMe(null);
    setStudents([]);
    setAssignments([]);
    setSummary(null);
    setStatus("You have logged out.");
  }

  async function saveStudent() {
    if (!me?.school) return;
    try {
      if (studentForm.id) {
        await updateStudent(studentForm.id, {
          full_name: studentForm.full_name,
          class_name: studentForm.class_name,
          roll_number: studentForm.roll_number,
          parent: studentForm.parent,
        });
        setStatus("Student updated successfully.");
      } else {
        await createStudent({
          school: me.school,
          parent: studentForm.parent,
          full_name: studentForm.full_name,
          student_code: studentForm.student_code,
          class_name: studentForm.class_name,
          roll_number: studentForm.roll_number,
        });
        setStatus("Student created successfully.");
      }
      const fresh = await fetchStudents();
      setStudents(fresh);
      setStudentForm((prev) => ({ ...prev, id: 0, full_name: "", student_code: "", roll_number: 1 }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Student save failed.");
    }
  }

  async function archiveStudentRow(id: number) {
    try {
      await archiveStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setStatus("Student archived.");
    } catch {
      setStatus("Archiving student failed.");
    }
  }

  async function createTeacherUser() {
    if (!me?.school) return;
    try {
      await createTeacher({
        ...teacherForm,
        school: me.school,
      });
      setTeachers(await fetchUsers({ role: "TEACHER" }));
      setTeacherForm({ email: "", username: "", password: "Demo12345!", phone: "" });
      setStatus("Teacher created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Teacher creation failed.");
    }
  }

  async function createAssignment() {
    if (!me?.school || !assignmentForm.teacher) return;
    try {
      await createTeacherAssignment({
        school: me.school,
        teacher: assignmentForm.teacher,
        class_name: assignmentForm.class_name,
        subject: assignmentForm.subject,
      });
      setAssignments(await fetchTeacherAssignments());
      setStatus("Teacher assignment created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Assignment failed.");
    }
  }

  async function loadAttendanceForDate() {
    try {
      const rows = await fetchAttendanceByDate(attendanceDate);
      const map: Record<number, AttendanceStatus> = {};
      rows.forEach((row: AttendanceRecord) => {
        map[row.student] = row.status;
      });
      setAttendanceMap(map);
    } catch {
      setStatus("Attendance fetch failed.");
    }
  }

  useEffect(() => {
    if (me) {
      loadAttendanceForDate();
    }
  }, [attendanceDate, me]);

  async function saveAttendance() {
    try {
      const records = classStudents.map((student) => ({
        student: student.id,
        status: attendanceMap[student.id] ?? "PRESENT",
      }));
      const result = await bulkMarkAttendance(attendanceDate, records);
      setStatus(`${result.count} attendance rows saved.`);
    } catch {
      setStatus("Attendance save failed.");
    }
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-[#f2f4f8] p-6">
        <div className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Smart Campus Login</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your real role account.</p>
          <div className="mt-5 space-y-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Password" />
            <button onClick={handleLogin} className="w-full rounded-xl bg-[#3059e9] px-4 py-2 font-semibold text-white">Login</button>
          </div>
          {authError ? <p className="mt-3 text-sm text-rose-600">{authError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-900">
      <header className="h-12 bg-[#1d1d1d] text-center text-sm text-slate-200 flex items-center justify-center">Smart Campus SaaS</header>
      <div className="flex min-h-[calc(100vh-48px)]">
        <aside className="w-64 bg-[#1f2d46] text-white flex flex-col">
          <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-6">
            <div className="rounded-xl bg-[#2f59ea] p-2"><GraduationCap className="h-5 w-5" /></div>
            <div>
              <p className="text-3 font-semibold">Smart Campus</p>
            </div>
          </div>

          <nav className="mt-4 space-y-1 px-3">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${activePage === item.key ? "bg-[#2f59ea]" : "text-slate-200 hover:bg-slate-700/40"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-1 px-3 pb-6">
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-700/40">
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-700/40">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <div className="mb-7 flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" placeholder="Search students by name..." />
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#2f59ea]">{roleLabel[me.role]}</div>
              <Bell className="h-4 w-4 text-slate-500" />
            </div>
          </div>

          {activePage === "dashboard" ? (
            <section className="space-y-6">
              <div>
                <h1 className="text-5xl font-bold tracking-tight">Campus Overview</h1>
                <p className="mt-1 text-slate-500">Welcome back to Begum Shahanara Smart Campus Management System.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <MetricCard title="Total Students" value={`${summary?.totals?.students ?? students.length}`} icon={<Users className="h-5 w-5 text-[#2f59ea]" />} />
                <MetricCard title="Attendance Today" value={`${summary?.attendance?.today_rate?.toFixed(0) ?? "0"}%`} icon={<CalendarCheck className="h-5 w-5 text-emerald-600" />} />
                <MetricCard title="Pending Results" value={`${summary?.totals?.ai_logs ?? 0}`} icon={<BookOpen className="h-5 w-5 text-amber-600" />} />
                <MetricCard title="At-Risk Students" value={`${summary?.risk_distribution?.critical ?? 0}`} icon={<TriangleAlert className="h-5 w-5 text-rose-600" />} />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <h2 className="text-2xl font-semibold">Recent Attendance Logs</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Class</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 5).map((student) => {
                        const st = attendanceMap[student.id] ?? "PRESENT";
                        return (
                          <tr key={student.id} className="border-t border-slate-100">
                            <td className="px-5 py-3 font-medium">{student.full_name}</td>
                            <td className="px-5 py-3 text-slate-500">Class {student.class_name}</td>
                            <td className="px-5 py-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st === "PRESENT" ? "bg-emerald-100 text-emerald-700" : st === "ABSENT" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{st}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl bg-[#3a4be0] p-4 text-white">
                  <h3 className="mb-3 text-lg font-semibold">AI At-Risk Alerts</h3>
                  <div className="space-y-3">
                    {interventions.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-xl bg-white/10 p-3">
                        <p className="font-semibold">{item.student_name}</p>
                        <p className="text-sm text-blue-100">{item.recommendation}</p>
                        <p className="mt-1 text-xs">{item.priority}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activePage === "students" ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Students CRUD</h2>
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-6">
                <input value={studentForm.full_name} onChange={(e) => setStudentForm((p) => ({ ...p, full_name: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Full name" />
                <input value={studentForm.student_code} onChange={(e) => setStudentForm((p) => ({ ...p, student_code: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Student code" disabled={Boolean(studentForm.id)} />
                <input value={studentForm.class_name} onChange={(e) => setStudentForm((p) => ({ ...p, class_name: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Class" />
                <input type="number" value={studentForm.roll_number} onChange={(e) => setStudentForm((p) => ({ ...p, roll_number: Number(e.target.value) }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Roll" />
                <select value={studentForm.parent} onChange={(e) => setStudentForm((p) => ({ ...p, parent: Number(e.target.value) }))} className="rounded-lg border border-slate-200 px-3 py-2">
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>{parent.email}</option>
                  ))}
                </select>
                <button onClick={saveStudent} className="rounded-lg bg-[#2f59ea] px-4 py-2 text-sm font-semibold text-white">{studentForm.id ? "Update" : "Create"}</button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">Code</th>
                      <th className="py-2">Name</th>
                      <th className="py-2">Class</th>
                      <th className="py-2">Parent</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-t border-slate-100">
                        <td className="py-2">{student.student_code}</td>
                        <td className="py-2">{student.full_name}</td>
                        <td className="py-2">{student.class_name}</td>
                        <td className="py-2">{student.parent_name}</td>
                        <td className="py-2 space-x-2">
                          <button
                            onClick={() =>
                              setStudentForm({
                                id: student.id,
                                full_name: student.full_name,
                                student_code: student.student_code,
                                class_name: student.class_name,
                                roll_number: student.roll_number ?? 1,
                                parent: student.parent,
                              })
                            }
                            className="rounded-md border border-slate-300 px-2 py-1"
                          >
                            Edit
                          </button>
                          <button onClick={() => archiveStudentRow(student.id)} className="rounded-md border border-rose-200 px-2 py-1 text-rose-600">Archive</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activePage === "attendance" ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Attendance</h2>
              <div className="flex gap-3">
                <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" />
                <input value={studentForm.class_name} onChange={(e) => setStudentForm((p) => ({ ...p, class_name: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Class" />
                <button onClick={saveAttendance} className="rounded-lg bg-[#2f59ea] px-4 py-2 text-sm font-semibold text-white">Save Attendance</button>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                {classStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between border-b border-slate-100 py-2">
                    <div>
                      <p className="font-medium">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.student_code}</p>
                    </div>
                    <div className="flex gap-2">
                      {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((state) => (
                        <button
                          key={state}
                          onClick={() => setAttendanceMap((prev) => ({ ...prev, [student.id]: state }))}
                          className={`rounded-md border px-3 py-1 text-xs ${
                            (attendanceMap[student.id] ?? "PRESENT") === state ? "border-[#2f59ea] bg-[#2f59ea] text-white" : "border-slate-300"
                          }`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activePage === "teachers" && me.role === "ADMIN" ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Teacher Panel</h2>
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
                <input value={teacherForm.email} onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="teacher email" />
                <input value={teacherForm.username} onChange={(e) => setTeacherForm((p) => ({ ...p, username: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="username" />
                <input value={teacherForm.phone} onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="phone" />
                <input value={teacherForm.password} onChange={(e) => setTeacherForm((p) => ({ ...p, password: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="password" />
                <button onClick={createTeacherUser} className="rounded-lg bg-[#2f59ea] px-4 py-2 text-sm font-semibold text-white">Create Teacher</button>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
                <select value={assignmentForm.teacher} onChange={(e) => setAssignmentForm((p) => ({ ...p, teacher: Number(e.target.value) }))} className="rounded-lg border border-slate-200 px-3 py-2">
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.email}</option>
                  ))}
                </select>
                <input value={assignmentForm.class_name} onChange={(e) => setAssignmentForm((p) => ({ ...p, class_name: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Class" />
                <input value={assignmentForm.subject} onChange={(e) => setAssignmentForm((p) => ({ ...p, subject: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2" placeholder="Subject" />
                <button onClick={createAssignment} className="rounded-lg bg-[#2f59ea] px-4 py-2 text-sm font-semibold text-white">Assign</button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2">Teacher</th>
                      <th className="py-2">Class</th>
                      <th className="py-2">Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="py-2">{item.teacher_name}</td>
                        <td className="py-2">{item.class_name}</td>
                        <td className="py-2">{item.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <p className="mt-6 text-sm text-slate-500">{status}</p>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-2">{icon}</div>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <p className="mt-1 text-4xl font-semibold">{value}</p>
    </div>
  );
}