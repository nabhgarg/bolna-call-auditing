import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!file) {
  throw new Error("Usage: node scripts/seed-from-json.mjs calls.json");
}

if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const rows = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(rows)) {
  throw new Error("Input JSON must be an array of call rows.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const chunkSize = 500;
let imported = 0;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize).map((row) => ({
    execution_id: String(row.execution_id || ""),
    assigned_reviewer: String(row.assigned_reviewer || row.assigned_to || row.reviewer || row.reviewer_name || row.assignee || ""),
    org_name: String(row.org_name || ""),
    agent_id: String(row.agent_id || ""),
    agent_name: String(row.agent_name || ""),
    duration_sec: Number(row.duration_sec || 0),
    created_at_ist: String(row.created_at_ist || ""),
    to_number: String(row.to_number || ""),
    status: String(row.status || ""),
    transcriber_language: String(row.transcriber_language || ""),
    transcript: String(row.transcript || ""),
    recording_url: String(row.recording_url || ""),
    agent_interrupted_user_count: Number(row.agent_interrupted_user_count || 0),
    source_sheet: String(row.source_sheet || ""),
    imported_at: new Date().toISOString()
  })).filter((row) => row.execution_id);

  const { error } = await supabase.from("calls").upsert(chunk, { onConflict: "execution_id" });
  if (error) throw error;
  imported += chunk.length;
}

console.log(`Imported ${imported} calls from ${file}`);

