'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap';
import { authenticatedFetch } from '@/lib/apiClient';

export default function ActivityStructureManager({ activities, onChanged, notify }) {
  const [values, setValues] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    setValues(Object.fromEntries(activities.map((activity) => [activity.$id, {
      activityCode: activity.activityCode || '',
      parentActivityId: activity.parentActivityId || '',
      sortOrder: activity.sortOrder ?? '',
    }])));
  }, [activities]);

  const change = (id, field, value) => setValues((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const save = async (activity) => {
    setSavingId(activity.$id);
    try {
      const response = await authenticatedFetch(`/api/finance/activities/${activity.$id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values[activity.$id]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Activity structure could not be saved.');
      notify?.(`${activity.name} updated.`, 'success');
      await onChanged?.();
    } catch (error) {
      notify?.(error.message, 'danger');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <Alert variant="info" className="small">Codes and hierarchy are optional. Existing uncoded activities remain usable and Finance always relates by stable activity ID.</Alert>
      <div className="table-responsive">
        <Table className="align-middle" style={{ minWidth: 760 }}>
          <thead><tr><th>Activity</th><th style={{ width: 150 }}>Code</th><th style={{ width: 230 }}>Parent activity</th><th style={{ width: 100 }}>Order</th><th /></tr></thead>
          <tbody>{activities.map((activity) => <tr key={activity.$id}>
            <td><strong>{activity.name}</strong><small className="text-muted d-block">Stable ID: {activity.$id}</small></td>
            <td><Form.Control size="sm" value={values[activity.$id]?.activityCode ?? ''} onChange={(event) => change(activity.$id, 'activityCode', event.target.value)} placeholder="1.1.1" /></td>
            <td><Form.Select size="sm" value={values[activity.$id]?.parentActivityId ?? ''} onChange={(event) => change(activity.$id, 'parentActivityId', event.target.value)}><option value="">No parent</option>{activities.filter((candidate) => candidate.$id !== activity.$id).map((candidate) => <option key={candidate.$id} value={candidate.$id}>{candidate.activityCode ? `${candidate.activityCode} · ` : ''}{candidate.name}</option>)}</Form.Select></td>
            <td><Form.Control size="sm" type="number" min="0" step="1" value={values[activity.$id]?.sortOrder ?? ''} onChange={(event) => change(activity.$id, 'sortOrder', event.target.value)} /></td>
            <td className="text-end"><Button size="sm" variant="secondary" onClick={() => save(activity)} disabled={savingId === activity.$id}>{savingId === activity.$id ? <Spinner size="sm" animation="border" /> : 'Save'}</Button></td>
          </tr>)}</tbody>
        </Table>
      </div>
    </div>
  );
}

