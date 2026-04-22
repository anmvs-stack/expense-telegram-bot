import { getSupabaseClient } from './supabaseClient';

const supabase = getSupabaseClient();

export async function fetchTransactions(params: {
  startDate: string;
  endDate: string;
  types?: string[];
  categoryIds?: string[];
  accountIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit: number;
  offset: number;
}) {
  const { data, error } = await supabase.rpc('get_transactions', {
    start_date: params.startDate,
    end_date: params.endDate,
    types: params.types ?? null,
    category_ids: params.categoryIds ?? null,
    account_ids: params.accountIds ?? null,
    min_amount: params.minAmount ?? null,
    max_amount: params.maxAmount ?? null,
    search: params.search ?? null,
    limit_val: params.limit,
    offset_val: params.offset,
  });

  if (error) throw error;
  return data;
}

export async function fetchDashboardSummary(startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    start_date: startDate,
    end_date: endDate,
  });

  if (error) throw error;
  return data?.[0];
}

export async function fetchCategoryBreakdown(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('transaction_enriched')
    .select('category_name, amount')
    .eq('type', 'expense')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (error) throw error;

  const grouped: Record<string, number> = {};

  data.forEach((row) => {
    grouped[row.category_name] =
      (grouped[row.category_name] || 0) + row.amount;
  });

  return Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
}

export async function fetchAccountBreakdown(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('transaction_enriched')
    .select('account_name, amount')
    .eq('type', 'expense')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (error) throw error;

  const grouped: Record<string, number> = {};

  data.forEach((row) => {
    grouped[row.account_name] =
      (grouped[row.account_name] || 0) + row.amount;
  });

  return Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
}

export async function fetchDailyTrend(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('transaction_enriched')
    .select('transaction_date, amount')
    .eq('type', 'expense')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (error) throw error;

  const grouped: Record<string, number> = {};

  data.forEach((row) => {
    grouped[row.transaction_date] =
      (grouped[row.transaction_date] || 0) + row.amount;
  });

  return Object.entries(grouped).map(([date, total]) => ({
    date,
    total,
  }));
}

/* ✅ NEW */

export async function updateTransaction(payload: {
  txn_id: string;
  new_amount: number;
  new_description: string;
  new_category_id: string;
  new_account_id: string;
  new_type: string;
  new_date: string;
}) {
  const { error } = await supabase.rpc('update_transaction', payload);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.rpc('delete_transaction', {
    txn_id: id,
  });
  if (error) throw error;
}