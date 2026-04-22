'use client';

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function CategoryChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          outerRadius={100}
        />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}