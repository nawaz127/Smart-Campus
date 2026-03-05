import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { vi } from "vitest";

vi.mock("./services/api", () => ({
  fetchMe: vi.fn().mockRejectedValue(new Error("No active session")),
  login: vi.fn(),
  clearSession: vi.fn(),
  fetchStudents: vi.fn(),
  fetchUsers: vi.fn(),
  fetchSystemSummary: vi.fn(),
  fetchInterventions: vi.fn(),
  fetchAttendanceByDate: vi.fn(),
  bulkMarkAttendance: vi.fn(),
  updateStudent: vi.fn(),
  createStudent: vi.fn(),
  archiveStudent: vi.fn(),
  createTeacher: vi.fn(),
  createTeacherAssignment: vi.fn(),
  fetchTeacherAssignments: vi.fn(),
}));

describe("App login shell", () => {
  it("renders login view when no session exists", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Smart Campus Login")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    });
  });
});
