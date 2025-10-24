// print_passwords.js
require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");

// ------------------------------------------------------
// CONFIG
// ------------------------------------------------------
const PORTAL_PW_SECRET = process.env.PORTAL_PW_SECRET || "aljkfehGHIUYOGljblajdfb";
// console.log("PW SECRET prefix (script):", (PORTAL_PW_SECRET || "").slice(0, 8));

// ------------------------------------------------------
// PASSWORD DERIVATION FUNCTION
// ------------------------------------------------------
function derivePassword(studentId) {
  const raw = crypto
    .createHmac("sha256", PORTAL_PW_SECRET)
    .update(String(studentId).trim())
    .digest("base64url");
  return `ac-${raw.slice(0, 5)}-${raw.slice(5, 11)}`;
}

// console.log("Derive S022 directly:", derivePassword("S022"));

// ------------------------------------------------------
// FETCH STUDENTS FROM AIRTABLE
// ------------------------------------------------------
(async () => {
  try {
    const { AIRTABLE_BASE_ID, AIRTABLE_API_KEY } = process.env;
    const TABLE = "Students";

    const resp = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        TABLE
      )}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();

    const rows = [["Preferred Name", "Student ID", "Password"]]; // CSV header
    function extractStudentId(rawName) {
        if (typeof rawName !== "string") return null;
        // Support hyphen -, en dash – (U+2013), em dash — (U+2014)
        let m = rawName.match(/^([A-Za-z]\d{2,})\s*[-–—]\s*/);
        if (m) return m[1];
        // Fallback: grab first token like S022 before any non-alphanumeric
        m = rawName.match(/^([A-Za-z]\d{2,})\b/);
        if (m) return m[1];
        return null;
      }

    for (const r of data.records) {
      

      const preferredName = r.fields["Preferred Name"];
      const rawName = r.fields["Name"] || "";
      const studentId =
        extractStudentId(rawName) || r.fields["StudentID"] || r.id;

      // const studentId = m ? m[1] : (r.fields['StudentID'] || r.id);
      if (!preferredName || !studentId) continue;

      const pw = derivePassword(studentId);
      rows.push([preferredName, studentId, pw]);
      // console.log(`${preferredName} (${studentId}): ${pw}`);
    }

    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    fs.writeFileSync("student_passwords.csv", csv);
    // console.log("✅ Wrote student_passwords.csv");
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
