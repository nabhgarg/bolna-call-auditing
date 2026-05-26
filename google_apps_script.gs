const CALLS_SHEET_NAME = "Calls";
const REVIEWS_SHEET_NAME = "Reviews";
const CALLS_SHEET_BY_MODE = {
  technical_audio: "Calls_Technical_Audio",
  vibe_transcription: "Calls_Vibe_Transcription"
};
const REVIEWS_SHEET_BY_MODE = {
  technical_audio: "Reviews_Technical_Audio",
  vibe_transcription: "Reviews_Vibe_Transcription"
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
  return value === "vibe_transcription" ? "vibe_transcription" : "technical_audio";
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
