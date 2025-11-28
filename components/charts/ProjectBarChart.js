'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function ProjectBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.slice(0, 10)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="projectName"
          angle={-45}
          textAnchor="end"
          height={100}
          fontSize={12}
        />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="billableHours" fill="#28a745" name="Billable" />
        <Bar dataKey="nonBillableHours" fill="#6c757d" name="Non-Billable" />
      </BarChart>
    </ResponsiveContainer>
  );
}
