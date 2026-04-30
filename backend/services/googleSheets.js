import { google } from 'googleapis';
import { supabase } from '../supabase.js';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.SHEET_ID;
const RANGE = "Apr'26!A:G" // adjust if sheet name differs

// Format date like: Apr 01, 2026
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function getSheetName(dateStr) {
  const date = new Date(dateStr);

  const istDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  const month = istDate.toLocaleString('en-US', { month: 'short' });
  const year = String(istDate.getFullYear()).slice(-2);

  return `${month}'${year}`;
}

// Map your DB → Sheet schema
function mapTxnToRow(txn, accountName) {
  const flowType = txn.type === 'expense' ? 'Outflow' : 'Inflow';

  return [
    formatDate(txn.date),
    txn.amount.toFixed(2),
    accountName || '',                          // ✅ Payment Method
    flowType,                                   // ✅ Fixed
    txn.merchant || txn.notes || txn.raw_input,
    txn.category || '',
    txn.flow_category || ''
  ];
}

export async function pushToGoogleSheets(txn) {
  console.log('Pushing txn to sheet:', txn);

  const sheetName = getSheetName(txn.date);

  const { data: account, error } = await supabase
    .from('accounts')
    .select('name')
    .eq('id', txn.account_id)
    .single();

  console.log('Account fetch result:', account);
  console.log('Account fetch error:', error);

  const row = mapTxnToRow(txn, account?.name);

  console.log('Sheet name:', sheetName);
  console.log('Row being sent:', row);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  });

  console.log('Successfully pushed to Google Sheets');
}