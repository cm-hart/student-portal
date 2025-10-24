import React, { useState } from "react";
import {
  Calendar,
  LogOut,
  User,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

// =============================================
// CONFIGURATION - BACKEND API URL
// =============================================
const API_BASE_URL = "http://localhost:3001/api";

// =============================================
// DATE FORMATTER
// =============================================
function formatDateOnly(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d); // Local date — avoids UTC shift
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// =============================================
// MAIN APP COMPONENT
// =============================================
function StudentPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =============================================
  // LOGIN HANDLER - Calls backend API
  // =============================================
  const handleLogin = async (preferredName, password) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preferredName, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setCurrentStudent(data.student);
      setIsLoggedIn(true);

      // Fetch attendance records after successful login
      await fetchAttendanceRecords(data.student.preferredName);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // FETCH ATTENDANCE FROM BACKEND API
  // =============================================
  const fetchAttendanceRecords = async (preferredName) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/attendance/${preferredName}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch attendance");
      }

      setAttendanceRecords(data.records);
    } catch (err) {
      setError("Could not load attendance records.");
      console.error(err);

      // Show demo data on error
      setAttendanceRecords([
        {
          id: "1",
          date: "2025-10-20",
          course: "Sept 2025 - Advanced Backend",
          blockA: "On Time",
          blockB: "On Time",
          blockC: "On Time",
          blockD: "On Time",
        },
        {
          id: "2",
          date: "2025-10-16",
          course: "Sept 2025 - Advanced Backend",
          blockA: "Absent (missed 20+ min...)",
          blockB: "Absent (20+ minutes la...)",
          blockC: "Absent (20+ minutes late)",
          blockD: "Absent (20+ minutes late)",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // LOGOUT HANDLER
  // =============================================
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentStudent(null);
    setAttendanceRecords([]);
    setError("");
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen onLogin={handleLogin} loading={loading} error={error} />
    );
  }

  return (
    <Dashboard
      student={currentStudent}
      records={attendanceRecords}
      onLogout={handleLogout}
      loading={loading}
    />
  );
}

// =============================================
// LOGIN SCREEN COMPONENT
// =============================================
function LoginScreen({ onLogin, loading, error }) {
  const [preferredName, setPreferredName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    onLogin(preferredName, password);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Student Portal
          </h1>
          <p className="text-gray-600">Sign in to view your attendance</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Name
            </label>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Tamara"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        {/* <div className="mt-6 text-center text-sm text-gray-600">
          <p>Try: Tamara / password123</p>
        </div> */}
      </div>
    </div>
  );
}

// =============================================
// DASHBOARD COMPONENT
// =============================================
function Dashboard({ student, records, onLogout, loading }) {
  // Calculate attendance statistics across all blocks
  const calculateStats = () => {
    let totalBlocks = 0;
    let onTimeBlocks = 0;
    let tardyBlocks = 0;
    let absentBlocks = 0;

    records.forEach((record) => {
      ["blockA", "blockB", "blockC", "blockD"].forEach((block) => {
        const status = record[block];
        if (status) {
          totalBlocks++;
          if (status === "On Time") {
            onTimeBlocks++;
          } else if (status.includes("Tardy")) {
            tardyBlocks++;
          } else if (status.includes("Absent")) {
            absentBlocks++;
          }
        }
      });
    });

    return {
      totalBlocks,
      onTimeBlocks,
      tardyBlocks,
      absentBlocks,
      attendanceRate:
        totalBlocks > 0 ? Math.round((onTimeBlocks / totalBlocks) * 100) : 0,
    };
  };

  const stats = calculateStats();

  // Determine zone based on absent blocks
  const getZoneStatus = () => {
    if (stats.absentBlocks >= 23) {
      return { zone: "red", message: "Critical: You have missed 23+ blocks" };
    } else if (stats.absentBlocks >= 12) {
      return { zone: "yellow", message: "Warning: You have missed 12+ blocks" };
    }
    return { zone: "green", message: "Good standing" };
  };

  const zoneStatus = getZoneStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  zoneStatus.zone === "red"
                    ? "bg-red-600"
                    : zoneStatus.zone === "yellow"
                    ? "bg-yellow-500"
                    : "bg-green-600"
                }`}
              >
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {student.preferredName}
                </h2>
                <p className="text-sm text-gray-600">
                  {student.course}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Zone Warning Banner */}
        {zoneStatus.zone !== "green" && (
          <div
            className={`mb-6 p-4 rounded-lg border-2 flex items-center space-x-3 ${
              zoneStatus.zone === "red"
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-yellow-50 border-yellow-300 text-yellow-800"
            }`}
          >
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">{zoneStatus.message}</p>
              <p className="text-sm mt-1">
                {zoneStatus.zone === "red"
                  ? "Please speak with your instructor immediately."
                  : "You are approaching the absence limit. Please improve your attendance."}
              </p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            icon={Calendar}
            color="indigo"
          />
          <StatCard
            label="On Time Blocks"
            value={stats.onTimeBlocks}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            label="Absent Blocks"
            value={stats.absentBlocks}
            icon={XCircle}
            color="red"
          />
          <StatCard
            label="Tardy Blocks"
            value={stats.tardyBlocks}
            icon={Clock}
            color="yellow"
          />
        </div>
        {/* Attendance Zone Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Attendance Zone Reference
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Use this chart to understand your current attendance standing.
            </p>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-700">
                <th className="px-6 py-3 border-b border-gray-200">Zone</th>
                <th className="px-6 py-3 border-b border-gray-200">
                  # of Absences
                </th>
                <th className="px-6 py-3 border-b border-gray-200">
                  What It Means
                </th>
                <th className="px-6 py-3 border-b border-gray-200">
                  Next Steps
                </th>
              </tr>
            </thead>

            <tbody className="text-sm text-gray-800">
              {/* Green Zone */}
              <tr className="bg-green-50">
                <td className="px-6 py-4 font-semibold text-green-800 border-b border-gray-200">
                  Green Zone (On Track)
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  ≤ 12 blocks (≈3 days, 4% of the course)
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  You are keeping up with attendance.
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  No action is needed.
                </td>
              </tr>

              {/* Yellow Zone */}
              <tr className="bg-yellow-50">
                <td className="px-6 py-4 font-semibold text-yellow-800 border-b border-gray-200">
                  Yellow Zone (Needs Attention)
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  13–20 blocks (≈3.5–5 days, 4–7% of course)
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  Attendance is starting to impact your progress.
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  Meet with the instructor, TA, and Student Success to make a
                  plan. A PIP may be added if extra support is needed. Other
                  factors (like assignment completion) will be considered.
                </td>
              </tr>

              {/* Red Zone */}
              <tr className="bg-red-50">
                <td className="px-6 py-4 font-semibold text-red-800">
                  Red Zone (At Risk)
                </td>
                <td className="px-6 py-4">
                  &gt; 20 blocks (≈more than 5 days, 7%+ of course)
                </td>
                <td className="px-6 py-4">
                  Attendance is likely to affect your progress and may affect
                  your ability to continue.
                </td>
                <td className="px-6 py-4">
                  A PIP will be put in place. Pausing may be necessary,
                  depending on the situation.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Attendance Records Table */}
        {/* <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Attendance History
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Each day shows 4 blocks: A, B, C, D
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading attendance records...
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No attendance records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Block A
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Block B
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Block C
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Block D
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDateOnly(record.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={record.blockA} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={record.blockB} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={record.blockC} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={record.blockD} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div> */}
      </main>
    </div>
  );
}

// =============================================
// STAT CARD COMPONENT
// =============================================
function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    indigo: "bg-indigo-100 text-indigo-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// =============================================
// STATUS BADGE COMPONENT
// =============================================
function StatusBadge({ status }) {
  if (!status) return <span className="text-gray-400 text-xs">-</span>;

  let displayText = status;
  let colorClass = "bg-gray-100 text-gray-800";

  if (status === "On Time") {
    displayText = "On Time";
    colorClass = "bg-green-100 text-green-800";
  } else if (status.includes("Tardy")) {
    displayText = "Tardy";
    colorClass = "bg-yellow-100 text-yellow-800";
  } else if (status.includes("Absent")) {
    displayText = "Absent";
    colorClass = "bg-red-100 text-red-800";
  }

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}
    >
      {displayText}
    </span>
  );
}

export default StudentPortal;
// Also add this for backwards compatibility
export { StudentPortal as App };
