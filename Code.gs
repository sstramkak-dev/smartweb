/**
 * Smart 5G Dashboard — Google Apps Script Backend
 *
 * Deployment instructions:
 *   1. Open this script in the Apps Script editor (script.google.com).
 *   2. Click Deploy → Manage deployments → New deployment.
 *   3. Type: Web app.
 *   4. Execute as: Me (your Google account).
 *   5. Who has access: Anyone (even anonymous).
 *   6. Click Deploy and copy the /exec URL into app.js → GS_URL.
 *
 * Supported POST body (JSON):
 *   { sheet: "SheetName", action: "read" }
 *   { sheet: "SheetName", action: "sync",   data: [ {...}, ... ] }
 *   { sheet: "SheetName", action: "delete", data: { id: "..." } }
 */

// ---------------------------------------------------------------------------
// Web-app entry points
// ---------------------------------------------------------------------------

function doGet(e) {
  return _respond({ status: 'ok', message: 'Smart 5G GAS backend is running.' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheet;
    var action    = payload.action;
    var data      = payload.data;

    if (!sheetName) return _respond({ status: 'error', message: 'Missing required field: sheet' });

    if (action === 'read') {
      return _respond({ status: 'ok', data: readSheetData(sheetName) });
    }

    if (action === 'sync') {
      syncSheetData(sheetName, data);
      return _respond({ status: 'ok' });
    }

    if (action === 'delete') {
      var id = data ? data.id : null;
      deleteRowById(sheetName, id);
      return _respond({ status: 'ok' });
    }

    return _respond({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return _respond({ status: 'error', message: err.toString() });
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

// Row index of the header row inside a sheet (1-based).
var HEADER_ROW = 1;

/**
 * Returns an array of row objects (header keys → cell values) for the given
 * sheet, skipping completely empty rows.
 */
function readSheetData(sheetName) {
  var sheet = _getOrCreateSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= HEADER_ROW || lastCol === 0) return [];

  var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return dataRows
    .filter(function(row) {
      return row.some(function(cell) { return cell !== ''; });
    })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
}

/**
 * Overwrites the sheet with the supplied array of objects.
 * Uses the keys of the first object as column headers.
 */
function syncSheetData(sheetName, dataArray) {
  var sheet = _getOrCreateSheet(sheetName);
  sheet.clearContents();

  if (!Array.isArray(dataArray) || dataArray.length === 0) return;

  var headers = Object.keys(dataArray[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var rows = dataArray.map(function(item) {
    return headers.map(function(h) {
      return item[h] !== undefined ? item[h] : '';
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/**
 * Deletes every row whose "id" column value matches the supplied id.
 */
function deleteRowById(sheetName, id) {
  if (id === undefined || id === null) return;
  var sheet   = _getOrCreateSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= HEADER_ROW || lastCol === 0) return;

  var headers    = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return;

  var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  // Iterate in reverse so row deletions don't shift remaining indices.
  for (var i = dataRange.length - 1; i >= 0; i--) {
    if (String(dataRange[i][idColIndex]) === String(id)) {
      var sheetRow = i + 2; // Convert 0-based data array index to 1-based sheet row (accounting for header row)
      sheet.deleteRow(sheetRow);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function _getOrCreateSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function _respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}