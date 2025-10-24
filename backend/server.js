// server.js
// Student Portal API (Express + Airtable)
// Node 18+ recommended (for global fetch)

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

console.log("ENV sanity:", {
  baseIdPrefix: (process.env.AIRTABLE_BASE_ID || "").slice(0,3), // expect 'app'
  keyKind:
    (process.env.AIRTABLE_API_KEY || "").startsWith("pat") ? "pat" :
    (process.env.AIRTABLE_API_KEY || "").startsWith("key") ? "legacy" :
    "missing/other",
  hasKey: !!process.env.AIRTABLE_API_KEY
});

// If you're on Node < 18, uncomment the next 2 lines:
// const fetch = (...args) =>
//   import("node-fetch").then((m) => m.default(...args));

// -------------------------
// Environment
// -------------------------
const {
  PORTAL_PW_SECRET,
  MASTER_PORTAL_PW = "",
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_STUDENTS_VIEW = "", // optional view for Students
  AIRTABLE_ATTENDANCE_TABLE = "Attendance",
  AIRTABLE_ATTENDANCE_VIEW = "Grid view",
  ALLOWED_ORIGINS, // comma-separated list (optional)
} = process.env;

const PORT = process.env.PORT || 3001;

// Additional debugging after destructuring
console.log("🔍 After destructuring:", {
  hasApiKey: !!AIRTABLE_API_KEY,
  apiKeyPrefix: AIRTABLE_API_KEY?.substring(0, 4),
  hasBaseId: !!AIRTABLE_BASE_ID,
  baseIdPrefix: AIRTABLE_BASE_ID?.substring(0, 3)
});

if (!PORTAL_PW_SECRET) {
  throw new Error("PORTAL_PW_SECRET is not set. Add it to your .env");
}
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.warn("⚠️ AIRTABLE_API_KEY or AIRTABLE_BASE_ID missing; Airtable calls will fail.");
}

// -------------------------
// Helpers
// -------------------------
function derivePassword(studentId) {
  const raw = crypto
    .createHmac("sha256", PORTAL_PW_SECRET)
    .update(String(studentId).trim())
    .digest("base64url");
  return `ac-${raw.slice(0, 5)}-${raw.slice(5, 11)}`;
}

function extractStudentId(rawName) {
  if (typeof rawName !== "string") return null;
  // Accept hyphen -, en dash – (U+2013), em dash — (U+2014)
  let m = rawName.match(/^([A-Za-z]\d{2,})\s*[-–—]\s*/);
  if (m) return m[1];
  // Fallback: grab the leading token like S022 before any non-alnum
  m = rawName.match(/^([A-Za-z]\d{2,})\b/);
  if (m) return m[1];
  return null;
}

// -------------------------
// In-memory student map
// -------------------------
let STUDENTS = {}; // keyed by Preferred Name

async function loadStudentsFromAirtable() {
  const TABLE = "Students"; // change if your base uses a different name

  // Debug logging
  console.log('🔍 loadStudentsFromAirtable - AIRTABLE_API_KEY exists:', !!AIRTABLE_API_KEY);
  console.log('🔍 loadStudentsFromAirtable - AIRTABLE_API_KEY starts with:', AIRTABLE_API_KEY?.substring(0, 4));
  console.log('🔍 loadStudentsFromAirtable - AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID);

  const params = new URLSearchParams();
  if (AIRTABLE_STUDENTS_VIEW) params.set("view", AIRTABLE_STUDENTS_VIEW);

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    TABLE
  )}?${params.toString()}`;

  console.log('🔍 Request URL:', url);
  console.log('🔍 Auth header will be:', `Bearer ${AIRTABLE_API_KEY?.substring(0, 10)}...`);

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('❌ Airtable error response:', text);
    throw new Error(`Students fetch failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();

  const next = {};
  for (const r of data.records || []) {
    const fields = r.fields || {};
    const preferredName = fields["Preferred Name"];
    const rawName = fields["Name"];
    const studentId = extractStudentId(rawName) || fields["StudentID"] || null;
    if (!preferredName || !studentId) continue;

    next[preferredName] = {
      preferredName,
      studentId,
      password: derivePassword(studentId),
    };
  }

  STUDENTS = next;
  console.log(`✅ Loaded ${Object.keys(STUDENTS).length} students from Airtable`);
}

// -------------------------
// App setup
// -------------------------
const app = express();

// CORS (open in dev; allowlist in prod)
if (ALLOWED_ORIGINS) {
  const allowed = ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowed.includes(origin)) return cb(null, true);
        return cb(new Error("CORS: origin not allowed"));
      },
    })
  );
} else {
  app.use(cors()); // dev-friendly; tighten before prod
}

app.use(express.json());

// Rate limit login to slow brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------------
// Routes
// -------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { preferredName, password } = req.body;
    if (!preferredName || !password) {
      return res
        .status(400)
        .json({ error: "Preferred name and password are required" });
    }

    const normalized = preferredName.trim().toLowerCase();
    const student = Object.values(STUDENTS).find(
      (s) => (s.preferredName || "").trim().toLowerCase() === normalized
    );
    if (!student) return res.status(401).json({ error: "Invalid credentials" });

    // Master override
    if (MASTER_PORTAL_PW && password === MASTER_PORTAL_PW) {
      console.log(
        `[STAFF OVERRIDE] ${preferredName} at ${new Date().toISOString()}`
      );
      return res.json({
        success: true,
        staffOverride: true,
        student: {
          preferredName: student.preferredName,
          studentId: student.studentId,
        },
      });
    }

    // Per-student password
    if (password !== student.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.json({
      success: true,
      staffOverride: false,
      student: {
        preferredName: student.preferredName,
        studentId: student.studentId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get("/api/attendance/:preferredName", async (req, res) => {
  try {
    const { preferredName } = req.params;
    const normalized = preferredName.trim().toLowerCase();

    const student = Object.values(STUDENTS).find(
      (s) => (s.preferredName || "").trim().toLowerCase() === normalized
    );
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Filter: match student and on/after Sep 8, 2025
    const BASE_ID = AIRTABLE_BASE_ID;
    const TABLE_NAME = AIRTABLE_ATTENDANCE_TABLE; // table, not view
    const VIEW_NAME = AIRTABLE_ATTENDANCE_VIEW; // optional

    const safeName = student.preferredName.replace(/'/g, "\\'");
    const filterFormula = `AND(
      {PreferredNameText}='${safeName}',
      IS_AFTER({Date}, '2025-09-07')
    )`;

    const params = new URLSearchParams();
    params.set("filterByFormula", filterFormula);
    params.set("sort[0][field]", "Date");
    params.set("sort[0][direction]", "desc");
    if (VIEW_NAME) params.set("view", VIEW_NAME);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
      TABLE_NAME
    )}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable error:", response.status, errorText);
      return res
        .status(response.status)
        .json({ error: "Failed to fetch from Airtable", details: errorText });
    }

    const data = await response.json();

    const records = (data.records || []).map((record) => ({
      id: record.id,
      date: record.fields?.Date || null,
      course: record.fields?.["Current Course (from Student)"] || null,
      blockA: record.fields?.["Block A"] ?? null,
      blockB: record.fields?.["Block B"] ?? null,
      blockC: record.fields?.["Block C"] ?? null,
      blockD: record.fields?.["Block D"] ?? null,
    }));

    res.json({ success: true, records });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    res.status(500).json({
      error: "Server error fetching attendance",
      message: error.message,
    });
  }
});

// -------------------------
// Boot: load students first, then listen
// -------------------------
(async () => {
  try {
    await loadStudentsFromAirtable();
    setInterval(loadStudentsFromAirtable, 5 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 Student Portal API running on http://localhost:${PORT}`);
      console.log(`📊 Connected to Airtable Base: ${AIRTABLE_BASE_ID}`);
      console.log(`🗂️ Attendance Table: ${AIRTABLE_ATTENDANCE_TABLE}`);
    });
  } catch (e) {
    console.error("Failed initial Airtable load:", e);
    process.exit(1);
  }
})();