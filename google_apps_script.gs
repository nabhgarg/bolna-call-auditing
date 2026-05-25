const SHEET_NAME = "Reviews";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const columns = payload.columns || [];
  const rows = payload.rows || [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0 && columns.length) {
    sheet.appendRow(columns);
  }

  if (rows.length) {
    const values = rows.map((row) => columns.map((column) => row[column] ?? ""));
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, columns.length).setValues(values);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
    .setMimeType(ContentService.MimeType.JSON);
}
