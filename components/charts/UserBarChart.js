'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function UserBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.slice(0, 10)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="userName"
          angle={-45}
          textAnchor="end"
          height={100}
          fontSize={12}
        />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="totalHours" fill="#0088FE" name="Total Hours" />
      </BarChart>
    </ResponsiveContainer>
  );
}
