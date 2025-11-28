'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function TrendsLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="weekStart"
          angle={-45}
          textAnchor="end"
          height={60}
          fontSize={10}
        />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="billableHours"
          stroke="#28a745"
          name="Billable"
        />
        <Line
          type="monotone"
          dataKey="nonBillableHours"
          stroke="#6c757d"
          name="Non-Billable"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
