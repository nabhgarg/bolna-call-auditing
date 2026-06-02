const CALLS_SHEET_NAME = "Calls";
const REVIEWS_SHEET_NAME = "Reviews";
const CALLS_SHEET_BY_MODE = {
  pronunciation_tone: "Calls_Pronunciation_Tone",
  timing_transcription: "Calls_Timing_Transcription",
  response_vibe: "Calls_Response_Vibe"
};
const REVIEWS_SHEET_BY_MODE = {
  pronunciation_tone: "Reviews_Pronunciation_Tone",
  timing_transcription: "Reviews_Timing_Transcription",
  response_vibe: "Reviews_Response_Vibe"
};
const SHARED_SECRET = "";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  if (SHARED_SECRET && payload.secret !== SHARED_SECRET) {
    return jsonOutput({ ok: false, error: "Unauthorized" });
  }

  if (payload.action === "readCalls") {
    return jsonOutput(readCalls(payload));
  }

  if (payload.action === "appendReviews" || !payload.action) {
    return jsonOutput(appendReviews(payload));
  }

  return jsonOutput({ ok: false, error: "Unknown action" });
}

function normalizeMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if ([
    "timing_transcription",
    "latency_barge_in_transcription",
    "latency_bargein_transcription",
    "latency_barge_in",
    "latency_bargein",
    "timing",
    "transcription",
    "vibe_transcription"
  ].indexOf(normalized) >= 0) {
    return "timing_transcription";
  }
  if ([
    "response_vibe",
    "response_appropriateness_vibe",
    "response_appropriateness",
    "overall_vibe",
    "vibe"
  ].indexOf(normalized) >= 0) {
    return "response_vibe";
  }
  return "pronunciation_tone";
}

function readCalls(payload) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const mode = normalizeMode(payload.audit_mode || payload.review_mode);
  const requestedSheetName = payload.sheet_name || CALLS_SHEET_BY_MODE[mode] || CALLS_SHEET_NAME;
  const sheet = spreadsheet.getSheetByName(requestedSheetName) || spreadsheet.getSheetByName(CALLS_SHEET_NAME);
  const sheet_names = spreadsheet.getSheets().map((item) => item.getName());
  if (!sheet) return { ok: false, error: "Calls sheet not found", sheet_names };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, calls: [], sheet_name: sheet.getName(), audit_mode: mode, sheet_names, row_count: values.length };

  const headers = values[0].map((value) => String(value).trim());
  const calls = values.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index] instanceof Date
          ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
          : row[index];
      });
      return item;
    });

  return { ok: true, calls, sheet_name: sheet.getName(), audit_mode: mode, sheet_names, row_count: values.length };
}

function appendReviews(payload) {
  const columns = payload.columns || [];
  const rows = payload.rows || [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const rowsBySheet = {};
  rows.forEach((row) => {
    const mode = normalizeMode(row.review_mode);
    const sheetName = REVIEWS_SHEET_BY_MODE[mode] || REVIEWS_SHEET_NAME;
    rowsBySheet[sheetName] = rowsBySheet[sheetName] || [];
    rowsBySheet[sheetName].push(row);
  });

  Object.keys(rowsBySheet).forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    if (columns.length) {
      ensureHeaders(sheet, columns);
    }
    const sheetRows = rowsBySheet[sheetName];
    if (sheetRows.length) {
      removeExistingReviewRows(sheet, columns, sheetRows);
      const values = sheetRows.map((row) => columns.map((column) => row[column] ?? ""));
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, columns.length).setValues(values);
    }
  });

  if (!rows.length) {
    const sheet = spreadsheet.getSheetByName(REVIEWS_SHEET_NAME) || spreadsheet.insertSheet(REVIEWS_SHEET_NAME);
    if (columns.length) {
      ensureHeaders(sheet, columns);
    }
  }

  return { ok: true, rows: rows.length };
}

function removeExistingReviewRows(sheet, columns, rows) {
  const callIndex = columns.indexOf("call_id");
  const reviewerIndex = columns.indexOf("reviewer_name");
  const modeIndex = columns.indexOf("review_mode");
  if (callIndex < 0 || reviewerIndex < 0 || modeIndex < 0 || sheet.getLastRow() < 2) return;

  const keys = {};
  rows.forEach((row) => {
    const key = [row.call_id || "", row.reviewer_name || "", row.review_mode || ""].join("||");
    keys[key] = true;
  });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), columns.length)).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    const key = [row[callIndex] || "", row[reviewerIndex] || "", row[modeIndex] || ""].join("||");
    if (keys[key]) {
      sheet.deleteRow(index + 2);
    }
  }
}

function ensureHeaders(sheet, columns) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    return;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), columns.length)).getValues()[0];
  const same = columns.every((column, index) => String(existing[index] || "").trim() === column);
  if (!same || existing.length < columns.length) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
  }
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
