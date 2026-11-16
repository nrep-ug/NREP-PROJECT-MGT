'use client';

import { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import {
  useCleanCookingCompanies,
  useCleanCookingDistricts,
  useCleanCookingMutation,
} from '@/hooks/useCleanCooking';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import styles from './CleanCooking.module.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const EMPTY = { name: '', contactName: '', phone: '', email: '', district: '', status: 'active' };

function CompanyModal({ show, onHide, projectId, company, districts, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onEnter = () => {
    setError('');
    setForm(company ? {
      name: company.name || '',
      contactName: company.contactName || '',
      phone: company.phone || '',
      email: company.email || '',
      district: company.district || '',
      status: company.status || 'active',
    } : EMPTY);
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    mutation.mutate(
      company ? { path: `/companies/${company.$id}`, method: 'PATCH', body: form } : { path: '/companies', method: 'POST', body: form },
      {
        onSuccess: () => { showToast?.(company ? 'Company updated.' : 'Company added.', 'success'); onHide(); },
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <Modal show={show} onHide={onHide} onEnter={onEnter} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{company ? 'Edit company' : 'Add company'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Company name</Form.Label>
            <Form.Control value={form.name} onChange={set('name')} required maxLength={190} />
          </Form.Group>
          <div className="row g-2">
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Contact person</Form.Label>
              <Form.Control value={form.contactName} onChange={set('contactName')} maxLength={160} />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>District</Form.Label>
              <Form.Select value={form.district} onChange={set('district')}>
                <option value="">Not set</option>
                {districts.map((d) => <option key={d.$id} value={d.name}>{d.name}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control type="tel" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.email} onChange={set('email')} />
            </Form.Group>
          </div>
          <Form.Check type="switch" id="company-active" label="Active" checked={form.status === 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" className={styles.primaryButton} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function CompaniesPanel({ projectId, access, showToast }) {
  const companiesQuery = useCleanCookingCompanies(projectId);
  const districtsQuery = useCleanCookingDistricts(projectId);
  const mutation = useCleanCookingMutation(projectId);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  if (companiesQuery.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (companiesQuery.error) return <Alert variant="warning">{companiesQuery.error.message}</Alert>;

  const companies = companiesQuery.data || [];
  const max = Math.max(1, ...companies.map((c) => c.totalQuantity));

  const remove = (company) => {
    if (!window.confirm(`Delete ${company.name}?`)) return;
    mutation.mutate({ path: `/companies/${company.$id}`, method: 'DELETE' }, {
      onSuccess: () => showToast?.('Company deleted.', 'success'),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  return (
    <SectionCard
      title="Companies"
      description="EPC distributors and retailers that report sales to the project."
      action={access.canWrite && <Button size="sm" className={styles.primaryButton} onClick={() => setShowAdd(true)}><i className="bi bi-plus-lg me-1" />Add company</Button>}
      flush
    >
      {companies.length === 0 ? (
        <EmptyState icon="bi-building" title="No companies yet" text="Companies are also created automatically when you import the sales spreadsheet." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`table table-hover ${styles.table}`}>
            <thead><tr><th>Company</th><th>Contact</th><th>District</th><th>Status</th><th className={styles.num}>EPCs reported</th><th style={{ width: '18%' }} />{access.canWrite && <th aria-label="Actions" />}</tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.$id}>
                  <td className={styles.strong}>{c.name}</td>
                  <td>
                    {c.contactName || <span className={styles.muted}>—</span>}
                    {(c.phone || c.email) && <div className="small text-muted">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td>{c.district || <span className={styles.muted}>—</span>}</td>
                  <td><span className={`${styles.pill} ${c.status === 'inactive' ? styles.pillMuted : ''}`}>{c.status === 'inactive' ? 'Inactive' : 'Active'}</span></td>
                  <td className={`${styles.num} ${styles.strong}`}>{fmt(c.totalQuantity)}</td>
                  <td><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${(c.totalQuantity / max) * 100}%` }} /></div></td>
                  {access.canWrite && (
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="link" className="p-1" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><i className="bi bi-pencil" /></Button>
                      {access.canManage && <Button size="sm" variant="link" className="p-1 text-danger" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><i className="bi bi-trash" /></Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CompanyModal
        show={showAdd || Boolean(editing)}
        onHide={() => { setShowAdd(false); setEditing(null); }}
        projectId={projectId}
        company={editing}
        districts={districtsQuery.data || []}
        showToast={showToast}
      />
    </SectionCard>
  );
}
