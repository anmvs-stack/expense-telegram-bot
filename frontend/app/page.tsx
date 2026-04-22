import { createClient } from '@/utils/supabase/server';
import CategoryChart from '@/components/CategoryChart';
import MonthlyTrend from '@/components/MonthlyTrend';

export default async function DashboardPage() {
  const supabase = await createClient();

  // ---- Fetch aggregated data ----
  const { data: monthlySummary } = await supabase
    .from('monthly_summary_view')
    .select('*')
    .order('month', { ascending: true });

  const { data: categorySummary } = await supabase
    .from('category_summary_view')
    .select('*');

  const { data: recentTxns } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // ---- Current Month KPI ----
  const currentMonthData =
    monthlySummary?.[monthlySummary.length - 1];

  const totalExpense = currentMonthData?.total_expense || 0;
  const totalIncome = currentMonthData?.total_income || 0;
  const balance = currentMonthData?.balance || 0;

  // ---- Chart Transformations ----

  const trendData =
    monthlySummary?.slice(-6).map(m => ({
      month: new Date(m.month).toLocaleString('default', {
        month: 'short'
      }),
      amount: m.total_expense
    })) || [];

  const categoryData =
    categorySummary?.map(c => ({
      category: c.category,
      amount: c.total_amount
    })) || [];

  return (
    <main className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* KPI CARDS */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Expenses" value={totalExpense} type="expense" />
        <Card title="Income" value={totalIncome} type="income" />
        <Card title="Balance" value={balance} type="balance" />
      </div>

      {/* CHARTS */}
      <div className="grid md:grid-cols-2 gap-6">

        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold mb-4">Monthly Spend Trend</h2>
          <MonthlyTrend data={trendData} />
        </div>

        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="font-semibold mb-4">Category Breakdown</h2>
          <CategoryChart data={categoryData} />
        </div>

      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="bg-white p-4 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Recent Transactions</h2>

        {recentTxns?.map(txn => (
          <div
            key={txn.id}
            className="flex justify-between py-2 border-b text-sm"
          >
            <span>{txn.description}</span>
            <span className="font-medium">
              ₹ {format(txn.amount)}
            </span>
          </div>
        ))}
      </div>

    </main>
  );
}

// ---- UI Components ----

function Card({ title, value, type }) {
  const color =
    type === 'expense'
      ? 'text-red-500'
      : type === 'income'
      ? 'text-green-500'
      : 'text-blue-500';

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className={`text-xl font-semibold ${color}`}>
        ₹ {format(value)}
      </h2>
    </div>
  );
}

function format(num: number) {
  return new Intl.NumberFormat('en-IN').format(num);
}