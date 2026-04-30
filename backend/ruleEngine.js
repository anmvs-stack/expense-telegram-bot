import { supabase } from './supabase.js';

function normalize(value) {
  return (value || '').toLowerCase().trim();
}

function scoreRule(rule) {
  const priority = rule.priority || 0;
  const keywordLen = (rule.keyword || '').length;
  return priority * 100 + keywordLen;
}

function pickBest(candidates) {
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export async function applyRules(parsed, ledgerId, userId) {
  const merchantText = normalize(parsed.merchant);
  const rawText = normalize(parsed.raw_text || parsed.raw);

  let { data: aliases, error: aliasError } = await supabase
    .from('account_aliases')
    .select('alias, account_id, priority, user_id')
    .eq('ledger_id', ledgerId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('priority', { ascending: false });

  // Backward-compatible fallback if migration not yet applied
  if (aliasError?.code === '42703') {
    const fallback = await supabase
      .from('account_aliases')
      .select('alias, account_id')
      .eq('ledger_id', ledgerId)
      .or(`user_id.eq.${userId},user_id.is.null`);
    aliases = fallback.data;
    aliasError = fallback.error;
  }

  if (aliasError) {
    console.error("Alias fetch error:", aliasError);
  }
  aliases = aliases || [];
  aliases.sort((a, b) => {
    const aUserSpecific = normalize(a.user_id) === normalize(userId) ? 1 : 0;
    const bUserSpecific = normalize(b.user_id) === normalize(userId) ? 1 : 0;
    if (aUserSpecific !== bUserSpecific) return bUserSpecific - aUserSpecific;
    return (b.priority || 0) - (a.priority || 0);
  });

  // Account alias gets first preference
  if (!parsed.account_id) {
    const aliasHit = aliases.find(a => rawText.includes(normalize(a.alias)));
    if (aliasHit) {
      parsed.account_id = aliasHit.account_id;
      parsed.matched_by = 'alias';
      parsed.matched_alias = aliasHit.alias;
      parsed.account_match_source = normalize(aliasHit.user_id) === normalize(userId)
        ? 'user-specific alias'
        : 'shared alias';
    }
  }

  let { data: rules, error: rulesError } = await supabase
    .from('rules')
    .select('keyword, category_id, account_id, priority, rule_type')
    .eq('ledger_id', ledgerId)
    .order('priority', { ascending: false });

  // Backward-compatible fallback if priority/rule_type columns are missing
  if (rulesError?.code === '42703') {
    const fallback = await supabase
      .from('rules')
      .select('keyword, category_id, account_id')
      .eq('ledger_id', ledgerId);
    rules = (fallback.data || []).map((r) => ({
      ...r,
      priority: 0,
      rule_type: r.category_id ? 'category' : (r.account_id ? 'account' : null)
    }));
    rulesError = fallback.error;
  }

  if (rulesError) {
    console.error("Rules fetch error:", rulesError);
    return parsed;
  }
  rules = rules || [];

  if (!rules || rules.length === 0) {
    console.log("No rules found for ledger:", ledgerId);
    return parsed;
  }

  // Keep account/category resolution independent so both can be applied
  const accountCandidates = [];
  const categoryCandidates = [];
  for (const rule of rules) {
    const keyword = normalize(rule.keyword);
    if (!keyword) continue;

    if (!(merchantText.includes(keyword) || rawText.includes(keyword))) continue;

    const score = scoreRule(rule);
    const type = normalize(rule.rule_type);

    if (rule.account_id && (type === 'account' || type === 'both' || !type)) {
      accountCandidates.push({ rule, keyword, score });
    }
    if (rule.category_id && (type === 'category' || type === 'both' || !type)) {
      categoryCandidates.push({ rule, keyword, score });
    }
  }

  if (!parsed.account_id) {
    const bestAccount = pickBest(accountCandidates);
    if (bestAccount) {
      parsed.account_id = bestAccount.rule.account_id;
      parsed.matched_account_keyword = bestAccount.keyword;
      parsed.matched_by = parsed.matched_by || 'rule';
      parsed.account_match_source = 'rule';
    }
  }

  if (!parsed.category_id) {
    const bestCategory = pickBest(categoryCandidates);
    if (!bestCategory) return parsed;
    parsed.category_id = bestCategory.rule.category_id;
    parsed.matched_category_keyword = bestCategory.keyword;
    parsed.matched_by = parsed.matched_by || 'rule';

    const { data: cat, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', bestCategory.rule.category_id)
      .single();

    if (categoryError) {
      console.error("Category fetch error:", categoryError);
    } else {
      parsed.category_name = cat?.name;
    }
  }

  return parsed;
}