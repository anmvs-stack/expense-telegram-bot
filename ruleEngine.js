import { supabase } from './supabase.js';

export async function applyRules(parsed, ledgerId) {
  const text = parsed.raw.toLowerCase();

  // 1. Fetch rules
  const { data: rules } = await supabase
    .from('rules')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('priority', { ascending: false });

  // 2. Fetch aliases
  const { data: aliases } = await supabase
    .from('account_aliases')
    .select('alias, account_id');

  // ACCOUNT MATCH (improved)
  if (parsed.account_hint) {
    for (const a of aliases) {
      if (parsed.account_hint.includes(a.alias.toLowerCase())) {
        parsed.account_id = a.account_id;
        break;
      }
    }
  }

  // --- RULE MATCH ---
  for (const rule of rules) {
    if (text.includes(rule.keyword.toLowerCase())) {
      if (rule.category_id && !parsed.category_id) {
        parsed.category_id = rule.category_id;

        // fetch category name
        const { data: cat } = await supabase
          .from('categories')
          .select('name')
          .eq('id', rule.category_id)
          .single();

        parsed.category_name = cat?.name;
      }

      if (rule.account_id && !parsed.account_id) {
        parsed.account_id = rule.account_id;
      }

      break;
    }
  }

  return parsed;
}