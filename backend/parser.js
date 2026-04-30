export function parseMessage(input) {
  let text = input.toLowerCase().trim();

  // =========================
  // 1. TYPE DETECTION
  // =========================
  let type = 'expense';

  if (text.startsWith('+') || text.includes('received')) {
    type = 'income';
  }

  if (text.startsWith('t ') || text.includes('transfer')) {
    type = 'transfer';
  }

  // =========================
  // 2. AMOUNT EXTRACTION
  // =========================
  const amountMatch = text.match(/\d+(\.\d+)?/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : null;

  if (!amount) {
    return { amount: null };
  }

  // Remove amount
  text = text.replace(amountMatch[0], '').trim();

  // =========================
  // 3. REMOVE NOISE WORDS
  // =========================
  const noiseWords = [
    'paid', 'pay', 'spent', 'spend',
    'for', 'to', 'on', 'via', 'using',
    'from', 'at', 'in', 'the'
  ];

  const tokens = text
    .split(' ')
    .filter(word => !noiseWords.includes(word));

  // =========================
  // 4. ACCOUNT HINT
  // =========================
  let account_hint = null;

  const accountKeywords = [
    'upi', 'gpay', 'phonepe', 'paytm',
    'hdfc', 'icici', 'axis', 'sbi',
    'amex', 'card', 'cc'
  ];

  const remainingTokens = [];

  for (let token of tokens) {
    if (accountKeywords.includes(token)) {
      account_hint = account_hint
        ? `${account_hint} ${token}`
        : token;
    } else {
      remainingTokens.push(token);
    }
  }

  // =========================
  // 5. MERCHANT
  // =========================
  let merchant = remainingTokens.join(' ').trim();

  // ✅ Strong normalization
  merchant = merchant
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!merchant) merchant = 'unknown';

  return {
    amount,
    type,
    merchant,
    merchant_tokens: merchant.split(' ').filter(Boolean),
    account_hint,
    raw_text: input,
    raw: input,
    category_id: null,
    category_name: null,
    account_id: null
  };
}