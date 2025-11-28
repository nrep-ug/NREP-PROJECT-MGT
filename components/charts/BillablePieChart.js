'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

export default function BillablePieChart({ billableHours, nonBillableHours }) {
  const data = [
    {
      name: 'Billable',
      value: parseFloat(billableHours)
    },
    {
      name: 'Non-Billable',
      value: parseFloat(nonBillableHours)
    }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value, percent }) =>
            `${name}: ${value}h (${(percent * 100).toFixed(0)}%)`
          }
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          <Cell fill="#28a745" />
          <Cell fill="#6c757d" />
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
