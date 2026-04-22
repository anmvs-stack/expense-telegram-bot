import { supabase } from './supabase.js';

export async function applyRules(parsed, ledgerId) {
  // ✅ Use CLEANED merchant instead of raw text
  const text = parsed.merchant?.toLowerCase() || '';

  // 1. Fetch rules (ledger scoped)
  const { data: rules, error: rulesError } = await supabase
    .from('rules')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('priority', { ascending: false });

  if (rulesError) {
    console.error("Rules fetch error:", rulesError);
    return parsed;
  }

  // ✅ Safety check
  if (!rules || rules.length === 0) {
    console.log("No rules found for ledger:", ledgerId);
    return parsed;
  }

  // 2. Fetch aliases (FIXED: ledger scoped)
  const { data: aliases, error: aliasError } = await supabase
    .from('account_aliases')
    .select('alias, account_id')
    .eq('ledger_id', ledgerId);

  if (aliasError) {
    console.error("Alias fetch error:", aliasError);
  }

  // ACCOUNT MATCH
  if (parsed.account_hint && aliases) {
    for (const a of aliases) {
      if (parsed.account_hint.includes(a.alias.toLowerCase())) {
        parsed.account_id = a.account_id;
        break;
      }
    }
  }

  // 🔍 DEBUG LOGS (keep temporarily)
  console.log("Merchant:", parsed.merchant);
  console.log("Rules:", rules.map(r => r.keyword));

  // --- RULE MATCH ---
  for (const rule of rules) {
    const keyword = rule.keyword?.toLowerCase();

    if (!keyword) continue;

    console.log("Checking rule:", keyword);

    // ✅ Improved matching (handles partial + multi-word)
    if (text.includes(keyword)) {
      console.log("Matched rule:", keyword);

      // CATEGORY
      if (rule.category_id && !parsed.category_id) {
        parsed.category_id = rule.category_id;

        // Fetch category name
        const { data: cat } = await supabase
          .from('categories')
          .select('name')
          .eq('id', rule.category_id)
          .single();

        parsed.category_name = cat?.name;
      }

      // ACCOUNT
      if (rule.account_id && !parsed.account_id) {
        parsed.account_id = rule.account_id;
      }

      break;
    }
  }

  return parsed;
}