'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, InputGroup, Modal, Spinner } from 'react-bootstrap';
import {
  useCleanCookingChampions,
  useCleanCookingDistricts,
  useCleanCookingMutation,
} from '@/hooks/useCleanCooking';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import styles from './CleanCooking.module.css';

const EMPTY = { fullName: '', district: '', phone: '', email: '', gender: 'unspecified', isDistrictLead: false, status: 'active', notes: '' };

export function DistrictSelect({ projectId, value, onChange, districts, placeholder = 'Select the district they champion…' }) {
  const mutation = useCleanCookingMutation(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    setError('');
    mutation.mutate({ path: '/districts', method: 'POST', body: { name } }, {
      onSuccess: (data) => { onChange(data.district.name); setAdding(false); setName(''); },
      onError: (err) => setError(err.message),
    });
  };

  if (adding) {
    return (
      <>
        <InputGroup>
          <Form.Control autoFocus placeholder="New district name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (name.trim()) add(); } }} />
          <Button className={styles.primaryButton} disabled={!name.trim() || mutation.isPending} onClick={add}>Add</Button>
          <Button variant="light" onClick={() => { setAdding(false); setError(''); }}>Cancel</Button>
        </InputGroup>
        {error && <Form.Text className="text-danger">{error}</Form.Text>}
      </>
    );
  }
  return (
    <Form.Select
      value={value}
      required
      onChange={(e) => (e.target.value === '__new' ? setAdding(true) : onChange(e.target.value))}
    >
      <option value="" disabled>{placeholder}</option>
      {districts.map((d) => <option key={d.$id} value={d.name}>{d.name}</option>)}
      <option value="__new">+ Add a new district…</option>
    </Form.Select>
  );
}

function ChampionModal({ show, onHide, projectId, champion, districts, defaultDistrict, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onEnter = () => {
    setError('');
    setForm(champion ? {
      fullName: champion.fullName || '',
      district: champion.district || '',
      phone: champion.phone || '',
      email: champion.email || '',
      gender: champion.gender || 'unspecified',
      isDistrictLead: Boolean(champion.isDistrictLead),
      status: champion.status || 'active',
      notes: champion.notes || '',
    } : { ...EMPTY, district: defaultDistrict || '' });
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.district) { setError('Choose the district this champion works in.'); return; }
    mutation.mutate(
      champion ? { path: `/champions/${champion.$id}`, method: 'PATCH', body: form } : { path: '/champions', method: 'POST', body: form },
      {
        onSuccess: () => { showToast?.(champion ? 'Champion updated.' : 'Champion added.', 'success'); onHide(); },
        onError: (err) => setError(err.message),
      }
    );
  };

  const phoneChangedWithLogin = Boolean(champion?.accountId && champion.phone && form.phone && form.phone !== champion.phone);

  return (
    <Modal show={show} onHide={onHide} onEnter={onEnter} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{champion ? 'Edit champion' : 'Add champion'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Full name</Form.Label>
            <Form.Control value={form.fullName} onChange={set('fullName')} required maxLength={190} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>District they champion</Form.Label>
            <DistrictSelect projectId={projectId} districts={districts} value={form.district} onChange={(district) => setForm((f) => ({ ...f, district }))} />
          </Form.Group>
          <div className="row g-2">
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Phone number</Form.Label>
              <Form.Control type="tel" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" />
              <Form.Text>Used to log in to the champions portal.</Form.Text>
              {phoneChangedWithLogin && (
                <Form.Text className="d-block text-warning">After saving, use “Reset password” so their login uses the new number.</Form.Text>
              )}
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Email <span className="text-muted">(optional)</span></Form.Label>
              <Form.Control type="email" value={form.email} onChange={set('email')} />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Gender</Form.Label>
              <Form.Select value={form.gender} onChange={set('gender')}>
                <option value="unspecified">Not recorded</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Form.Select>
            </Form.Group>
            <div className="col-sm-6 mb-3 d-flex flex-column justify-content-end gap-2">
              <Form.Check type="switch" id="champion-lead" label="District lead" checked={form.isDistrictLead} onChange={(e) => setForm((f) => ({ ...f, isDistrictLead: e.target.checked }))} />
              <Form.Check type="switch" id="champion-active" label="Active" checked={form.status === 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))} />
            </div>
          </div>
          <Form.Group>
            <Form.Label>Notes <span className="text-muted">(optional)</span></Form.Label>
            <Form.Control as="textarea" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" className={styles.primaryButton} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/** Shows a new or reset login ONCE so staff can pass it to the champion. */
function CredentialsModal({ credentials, onHide }) {
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const message = `NREP Clean Cooking champions portal\nOpen: ${origin}/login\nPhone: ${credentials.login}\nPassword: ${credentials.password}`;
  const close = () => { setCopied(false); onHide(); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Modal show onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">{credentials.reset ? 'Password reset' : 'Login created'} for {credentials.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted">
          Share these with the champion now. <strong>The password is shown only once</strong> — if it is lost, use “Reset password”.
        </p>
        <dl className="row mb-2">
          <dt className="col-4">Login (phone)</dt><dd className="col-8 fw-bold">{credentials.login}</dd>
          <dt className="col-4">Password</dt><dd className="col-8 fw-bold font-monospace fs-5">{credentials.password}</dd>
        </dl>
        <p className="small mb-0">They log in on the normal NREP login page by typing their phone number instead of an email.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button className={styles.secondaryButton} onClick={copy}>
          <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'} me-1`} />{copied ? 'Copied' : 'Copy message'}
        </Button>
        <Button className={styles.primaryButton} onClick={close}>Done</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function ChampionsPanel({ projectId, access, showToast }) {
  const championsQuery = useCleanCookingChampions(projectId);
  const districtsQuery = useCleanCookingDistricts(projectId);
  const mutation = useCleanCookingMutation(projectId);
  const [districtFilter, setDistrictFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [addDistrict, setAddDistrict] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const champions = useMemo(() => championsQuery.data || [], [championsQuery.data]);
  const districts = useMemo(() => districtsQuery.data || [], [districtsQuery.data]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map();
    for (const c of champions) {
      if (districtFilter && c.district !== districtFilter) continue;
      if (term && !`${c.fullName} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(term)) continue;
      if (!map.has(c.district)) map.set(c.district, []);
      map.get(c.district).push(c);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [champions, districtFilter, search]);

  if (championsQuery.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (championsQuery.error) return <Alert variant="warning">{championsQuery.error.message}</Alert>;

  const remove = (champion) => {
    if (!window.confirm(`Remove ${champion.fullName}? Consider marking them inactive instead.`)) return;
    mutation.mutate({ path: `/champions/${champion.$id}`, method: 'DELETE' }, {
      onSuccess: () => showToast?.('Champion removed.', 'success'),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  const createLogin = (champion) => {
    if (champion.accountId && !window.confirm(`Reset ${champion.fullName}'s password? Their current password will stop working and they will be signed out.`)) return;
    mutation.mutate({ path: `/champions/${champion.$id}/account`, method: 'POST' }, {
      onSuccess: (data) => setCredentials({ name: champion.fullName, login: data.login, password: data.password, reset: Boolean(data.reset) }),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  const disableLogin = (champion) => {
    if (!window.confirm(`Disable ${champion.fullName}'s portal login? They will be signed out and cannot log in until you reset their password.`)) return;
    mutation.mutate({ path: `/champions/${champion.$id}/account`, method: 'DELETE' }, {
      onSuccess: () => showToast?.('Login disabled.', 'success'),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  const renderLogin = (c) => {
    if (!c.login) {
      return (
        <div className="d-flex flex-column align-items-start gap-1">
          <span className={`${styles.pill} ${styles.pillMuted}`}>No login</span>
          {access.canManage && c.phone && c.status !== 'inactive' && (
            <Button size="sm" variant="link" className="p-0" disabled={mutation.isPending} onClick={() => createLogin(c)}>Create login</Button>
          )}
          {!c.phone && <small className={styles.muted}>Add a phone first</small>}
        </div>
      );
    }
    const lastSeen = c.login.lastSeen
      ? new Date(c.login.lastSeen).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })
      : null;
    return (
      <div className="d-flex flex-column align-items-start gap-1">
        <span className={`${styles.pill} ${c.login.enabled ? '' : styles.pillMuted}`}>{c.login.enabled ? 'Active' : 'Disabled'}</span>
        <small className={styles.muted}>{lastSeen ? `Last used ${lastSeen}` : 'Not used yet'}</small>
        {access.canManage && (
          <span className="d-flex gap-2">
            <Button size="sm" variant="link" className="p-0" disabled={mutation.isPending} onClick={() => createLogin(c)}>Reset password</Button>
            {c.login.enabled && (
              <Button size="sm" variant="link" className="p-0 text-danger" disabled={mutation.isPending} onClick={() => disableLogin(c)}>Disable</Button>
            )}
          </span>
        )}
      </div>
    );
  };

  const missingContact = champions.filter((c) => c.status !== 'inactive' && !c.phone).length;

  return (
    <SectionCard
      title="Champions"
      description={`${champions.length} champions in ${new Set(champions.map((c) => c.district)).size} districts`}
      action={access.canWrite && <Button size="sm" className={styles.primaryButton} onClick={() => setAddDistrict(districtFilter || '')}><i className="bi bi-person-plus me-1" />Add champion</Button>}
      flush
    >
      <div className="px-3 pt-3">
        {access.canWrite && missingContact > 0 && (
          <Alert variant="warning" className="py-2 small">
            <i className="bi bi-telephone-x me-1" />{missingContact} active champion{missingContact === 1 ? ' has' : 's have'} no phone number yet. They need one to get a portal login.
          </Alert>
        )}
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <Form.Select size="sm" aria-label="Filter by district" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d.$id} value={d.name}>{d.name}</option>)}
            </Form.Select>
            <Form.Control size="sm" type="search" placeholder="Search name or phone" aria-label="Search champions" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
          </div>
        </div>
      </div>

      {champions.length === 0 ? (
        <EmptyState icon="bi-people" title="No champions yet" text="Add each champion with the district they work in. Their phone number will become their portal login." />
      ) : groups.length === 0 ? (
        <EmptyState icon="bi-search" title="No matches" text="Try another district or search term." />
      ) : groups.map(([district, list]) => (
        <div key={district}>
          <div className={styles.districtHeader}>
            <span><i className="bi bi-geo-alt me-1" />{district}</span>
            <span className="d-flex align-items-center gap-2">
              <span className={styles.pill}>{list.length} champion{list.length === 1 ? '' : 's'}</span>
              {access.canWrite && <Button size="sm" variant="link" className="p-0" onClick={() => setAddDistrict(district)}>+ Add</Button>}
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={`table table-hover ${styles.table}`}>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Email</th><th>Status</th>
                  {access.canWrite && <th>Portal login</th>}
                  {access.canWrite && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.$id}>
                    <td className={styles.strong}>
                      {c.fullName}
                      {c.isDistrictLead && <span className={`${styles.pill} ${styles.pillLead} ms-2`}>Lead</span>}
                    </td>
                    <td>{c.phone || <span className={styles.muted}>Missing</span>}</td>
                    <td>{c.email || <span className={styles.muted}>—</span>}</td>
                    <td><span className={`${styles.pill} ${c.status === 'inactive' ? styles.pillMuted : ''}`}>{c.status === 'inactive' ? 'Inactive' : 'Active'}</span></td>
                    {access.canWrite && <td>{renderLogin(c)}</td>}
                    {access.canWrite && (
                      <td className="text-end text-nowrap">
                        <Button size="sm" variant="link" className="p-1" aria-label={`Edit ${c.fullName}`} onClick={() => setEditing(c)}><i className="bi bi-pencil" /></Button>
                        {access.canManage && <Button size="sm" variant="link" className="p-1 text-danger" aria-label={`Remove ${c.fullName}`} onClick={() => remove(c)}><i className="bi bi-trash" /></Button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <CredentialsModal credentials={credentials} onHide={() => setCredentials(null)} />
      <ChampionModal
        show={addDistrict !== null || Boolean(editing)}
        onHide={() => { setAddDistrict(null); setEditing(null); }}
        projectId={projectId}
        champion={editing}
        districts={districts}
        defaultDistrict={addDistrict}
        showToast={showToast}
      />
    </SectionCard>
  );
}
