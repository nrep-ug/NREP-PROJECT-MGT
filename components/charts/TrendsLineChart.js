'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import moment from 'moment-timezone';

export default function TrendsLineChart({ data, frequency = 'weekly' }) {
  // Format the date based on frequency for the tooltip/axis
  const formatXAxis = (value) => {
    const date = moment(value);
    switch (frequency) {
      case 'yearly':
        return date.format('YYYY');
      case 'monthly':
        return date.format('MMM, YYYY');
      case 'daily':
        return date.format('DD MMM');
      case 'weekly':
      default:
        return date.format('DD MMM');
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="periodStart"
          angle={-45}
          textAnchor="end"
          height={60}
          fontSize={10}
          tickFormatter={formatXAxis}
        />
        <YAxis />
        <Tooltip
          labelFormatter={(value) => `Period: ${formatXAxis(value)}`}
          formatter={(value) => [value, 'Hours']}
        />
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
