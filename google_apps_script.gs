const CALLS_SHEET_NAME = "Calls";
const REVIEWS_SHEET_NAME = "Reviews";
const SHARED_SECRET = "";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  if (SHARED_SECRET && payload.secret !== SHARED_SECRET) {
    return jsonOutput({ ok: false, error: "Unauthorized" });
  }

  if (payload.action === "readCalls") {
    return jsonOutput(readCalls());
  }

  if (payload.action === "appendReviews" || !payload.action) {
    return jsonOutput(appendReviews(payload));
  }

  return jsonOutput({ ok: false, error: "Unknown action" });
}

function readCalls() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CALLS_SHEET_NAME);
  if (!sheet) return { ok: false, error: "Calls sheet not found" };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, calls: [] };

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

  return { ok: true, calls };
}

function appendReviews(payload) {
  const columns = payload.columns || [];
  const rows = payload.rows || [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(REVIEWS_SHEET_NAME) || spreadsheet.insertSheet(REVIEWS_SHEET_NAME);

  if (sheet.getLastRow() === 0 && columns.length) {
    sheet.appendRow(columns);
  }

  if (rows.length) {
    const values = rows.map((row) => columns.map((column) => row[column] ?? ""));
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, columns.length).setValues(values);
  }

  return { ok: true, rows: rows.length };
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
