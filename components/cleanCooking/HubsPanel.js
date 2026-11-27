'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import {
  useCleanCookingDistricts,
  useCleanCookingHubs,
  useCleanCookingMutation,
} from '@/hooks/useCleanCooking';
import MetricCard from '@/components/ui/MetricCard';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { HUB_OPTIONS, hubLabel } from '@/lib/cleanCooking/hubDomain';
import { DistrictSelect } from './ChampionsPanel';
import styles from './CleanCooking.module.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const ACTIVITY = Object.fromEntries(HUB_OPTIONS.activity.map((o) => [o.value, o]));
const CONTEXT = Object.fromEntries(HUB_OPTIONS.context.map((o) => [o.value, o]));
const STATUS_TONE = { operational: '', setting_up: 'pillLead', planned: 'pillLead', inactive: 'pillMuted' };

const EMPTY = {
  name: '', district: '', location: '', context: '', settlementName: '', status: 'operational', activities: [], otherActivity: '',
  managerName: '', managerPhone: '', managerEmail: '', managerGender: 'unspecified',
  peopleWorking: '', womenWorking: '', youthWorking: '', householdsServed: '',
  refugeeHouseholdsServed: '', hostHouseholdsServed: '', establishedOn: '', notes: '',
};
const COUNT_KEYS = ['peopleWorking', 'womenWorking', 'youthWorking', 'householdsServed', 'refugeeHouseholdsServed', 'hostHouseholdsServed'];

function toForm(hub) {
  if (!hub) return EMPTY;
  const form = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) {
    if (hub[key] !== null && hub[key] !== undefined) form[key] = hub[key];
  }
  form.establishedOn = hub.establishedOn ? hub.establishedOn.slice(0, 10) : '';
  for (const key of COUNT_KEYS) {
    form[key] = hub[key] ? String(hub[key]) : '';
  }
  return form;
}

function HubModal({ show, onHide, projectId, hub, districts, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleActivity = (value) => setForm((f) => ({
    ...f,
    activities: f.activities.includes(value) ? f.activities.filter((a) => a !== value) : [...f.activities, value],
  }));

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.context) { setError('Choose whether the hub is humanitarian or development.'); return; }
    if (form.activities.length === 0) { setError('Choose at least one activity done at the hub.'); return; }
    mutation.mutate(
      hub ? { path: `/hubs/${hub.$id}`, method: 'PATCH', body: form } : { path: '/hubs', method: 'POST', body: form },
      {
        onSuccess: () => { showToast?.(hub ? 'Hub updated.' : 'Hub added.', 'success'); onHide(); },
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <Modal show={show} onHide={onHide} onEnter={() => { setError(''); setForm(toForm(hub)); }} centered size="lg">
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{hub ? 'Edit hub' : 'Add a clean cooking hub'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <h3 className="h6 fw-bold mb-2">Where is it?</h3>
          <div className="row g-2">
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Hub name</Form.Label>
              <Form.Control value={form.name} onChange={set('name')} required maxLength={160} placeholder="e.g. Kabale Energy Hub" />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>District</Form.Label>
              <DistrictSelect projectId={projectId} value={form.district} onChange={(name) => setForm((f) => ({ ...f, district: name }))} districts={districts} placeholder="Choose district…" />
            </Form.Group>
            <Form.Group className="col-sm-8 mb-3">
              <Form.Label>Village / sub-county / landmark</Form.Label>
              <Form.Control value={form.location} onChange={set('location')} maxLength={200} />
            </Form.Group>
            <Form.Group className="col-sm-4 mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select value={form.status} onChange={set('status')}>
                {HUB_OPTIONS.status.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Form.Select>
            </Form.Group>
          </div>

          <h3 className="h6 fw-bold mb-2">Who does it serve?</h3>
          <div className="d-flex flex-wrap gap-3 mb-2" role="radiogroup" aria-label="Hub type">
            {HUB_OPTIONS.context.map((o) => (
              <Form.Check
                key={o.value}
                id={`hub-context-${o.value}`}
                type="radio"
                name="hub-context"
                label={<><i className={`bi ${o.icon} me-1`} />{o.label}</>}
                checked={form.context === o.value}
                onChange={() => setForm((f) => ({ ...f, context: o.value }))}
              />
            ))}
          </div>
          {form.context === 'humanitarian' && (
            <Form.Group className="mb-3">
              <Form.Label>Refugee settlement</Form.Label>
              <Form.Control value={form.settlementName} onChange={set('settlementName')} required maxLength={120} placeholder="e.g. Nakivale, Kiryandongo, Rwamwanja" />
            </Form.Group>
          )}

          <h3 className="h6 fw-bold mt-3 mb-2">What is done at the hub?</h3>
          <div className={`${styles.checkGrid} mb-2`}>
            {HUB_OPTIONS.activity.map((o) => (
              <Form.Check
                key={o.value}
                id={`hub-activity-${o.value}`}
                type="checkbox"
                label={<><i className={`bi ${o.icon} me-1`} />{o.label}</>}
                checked={form.activities.includes(o.value)}
                onChange={() => toggleActivity(o.value)}
              />
            ))}
          </div>
          {form.activities.includes('other') && (
            <Form.Group className="mb-3">
              <Form.Label>Describe the other activity</Form.Label>
              <Form.Control value={form.otherActivity} onChange={set('otherActivity')} maxLength={200} required />
            </Form.Group>
          )}

          <h3 className="h6 fw-bold mt-3 mb-2">Who manages it?</h3>
          <div className="row g-2">
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Hub manager</Form.Label>
              <Form.Control value={form.managerName} onChange={set('managerName')} required maxLength={160} />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Gender</Form.Label>
              <Form.Select value={form.managerGender} onChange={set('managerGender')}>
                {HUB_OPTIONS.gender.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control type="tel" value={form.managerPhone} onChange={set('managerPhone')} placeholder="07XX XXX XXX" />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.managerEmail} onChange={set('managerEmail')} />
            </Form.Group>
          </div>

          <h3 className="h6 fw-bold mt-1 mb-2">People &amp; reach</h3>
          <div className="row g-2">
            {[
              ['peopleWorking', 'People working'],
              ['womenWorking', 'of whom women'],
              ['youthWorking', 'of whom youth'],
              ['householdsServed', 'Households served'],
            ].map(([key, label]) => (
              <Form.Group key={key} className="col-6 col-md-3 mb-3">
                <Form.Label>{label}</Form.Label>
                <Form.Control type="number" inputMode="numeric" min="0" step="1" value={form[key]} onChange={set(key)} />
              </Form.Group>
            ))}
            {form.context === 'humanitarian' && (
              <>
                <Form.Group className="col-6 col-md-3 mb-3">
                  <Form.Label>of which refugee</Form.Label>
                  <Form.Control type="number" inputMode="numeric" min="0" step="1" value={form.refugeeHouseholdsServed} onChange={set('refugeeHouseholdsServed')} />
                </Form.Group>
                <Form.Group className="col-6 col-md-3 mb-3">
                  <Form.Label>of which host community</Form.Label>
                  <Form.Control type="number" inputMode="numeric" min="0" step="1" value={form.hostHouseholdsServed} onChange={set('hostHouseholdsServed')} />
                </Form.Group>
                <Form.Text className="col-md-6 mb-3 d-flex align-items-center">If you split households, refugee + host must add up to households served.</Form.Text>
              </>
            )}
            <Form.Group className="col-sm-4 mb-3">
              <Form.Label>Date established</Form.Label>
              <Form.Control type="date" value={form.establishedOn} onChange={set('establishedOn')} />
            </Form.Group>
            <Form.Group className="col-sm-8 mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control value={form.notes} onChange={set('notes')} maxLength={500} />
            </Form.Group>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" className={styles.primaryButton} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save hub'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function HubCard({ hub, access, onEdit, onDelete }) {
  const initials = hub.managerName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <article className={`${styles.hubCard} ${hub.status === 'inactive' ? styles.hubCardInactive : ''}`}>
      <div className={styles.hubHead}>
        <div>
          <h3 className={styles.hubName}>{hub.name}</h3>
          <div className={styles.hubPlace}><i className="bi bi-geo-alt me-1" />{[hub.location, hub.context === 'humanitarian' && hub.settlementName ? `${hub.settlementName} settlement` : null, hub.district].filter(Boolean).join(', ')}</div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1">
          <span className={`${styles.pill} ${styles[STATUS_TONE[hub.status]] || ''}`}>{hubLabel('status', hub.status)}</span>
          {CONTEXT[hub.context] && (
            <span className={`${styles.pill} ${hub.context === 'humanitarian' ? styles.pillLead : styles.pillMuted}`}>
              <i className={`bi ${CONTEXT[hub.context].icon} me-1`} />{CONTEXT[hub.context].short}
            </span>
          )}
        </div>
      </div>

      <div className={styles.hubManager}>
        <span className={styles.hubAvatar} aria-hidden="true">{initials}</span>
        <div>
          <div className={styles.strong}>{hub.managerName}</div>
          <div className="small">
            Hub manager
            {hub.managerPhone && <> · <a href={`tel:${hub.managerPhone}`}>{hub.managerPhone}</a></>}
            {hub.managerEmail && <> · <a href={`mailto:${hub.managerEmail}`}>{hub.managerEmail}</a></>}
          </div>
        </div>
      </div>

      <div className={styles.activityChips}>
        {(hub.activities || []).map((a) => (
          <span key={a} className={styles.activityChip}>
            <i className={`bi ${ACTIVITY[a]?.icon || 'bi-dot'}`} />
            {a === 'other' && hub.otherActivity ? hub.otherActivity : hubLabel('activity', a)}
          </span>
        ))}
      </div>

      <div className={styles.hubStats}>
        <div><strong>{fmt(hub.peopleWorking)}</strong><span>People</span></div>
        <div><strong>{fmt(hub.womenWorking)}</strong><span>Women</span></div>
        <div><strong>{fmt(hub.youthWorking)}</strong><span>Youth</span></div>
        <div><strong>{fmt(hub.householdsServed)}</strong><span>Households</span></div>
      </div>
      {hub.context === 'humanitarian' && (hub.refugeeHouseholdsServed > 0 || hub.hostHouseholdsServed > 0) && (
        <div className="small text-muted">
          Households: {fmt(hub.refugeeHouseholdsServed)} refugee · {fmt(hub.hostHouseholdsServed)} host community
        </div>
      )}

      {access.canWrite && (
        <div className={styles.hubActions}>
          <Button size="sm" variant="link" className="p-1" onClick={() => onEdit(hub)}><i className="bi bi-pencil me-1" />Edit</Button>
          {access.canManage && (
            <Button size="sm" variant="link" className="p-1 text-danger" aria-label={`Delete ${hub.name}`} onClick={() => onDelete(hub)}><i className="bi bi-trash" /></Button>
          )}
        </div>
      )}
    </article>
  );
}

export default function HubsPanel({ projectId, access, showToast }) {
  const hubsQuery = useCleanCookingHubs(projectId);
  const districtsQuery = useCleanCookingDistricts(projectId);
  const mutation = useCleanCookingMutation(projectId);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [district, setDistrict] = useState('');
  const [activity, setActivity] = useState('');
  const [hubContext, setHubContext] = useState('');

  const hubs = hubsQuery.data?.hubs;
  const visible = useMemo(() => (hubs || []).filter((h) =>
    (!district || h.district === district)
    && (!activity || (h.activities || []).includes(activity))
    && (!hubContext || h.context === hubContext)
  ), [hubs, district, activity, hubContext]);

  if (hubsQuery.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (hubsQuery.error) return <Alert variant="warning">{hubsQuery.error.message}</Alert>;

  const { summary, notDeployed } = hubsQuery.data;
  const hubDistricts = [...new Set((hubs || []).map((h) => h.district))].sort();

  const remove = (hub) => {
    if (!window.confirm(`Delete ${hub.name}? This cannot be undone.`)) return;
    mutation.mutate({ path: `/hubs/${hub.$id}`, method: 'DELETE' }, {
      onSuccess: () => showToast?.('Hub deleted.', 'success'),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  if (notDeployed) {
    return (
      <Alert variant="info">
        The hubs table has not been created yet. An administrator needs to run <code>npm run schema:clean-cooking -- --apply</code> once.
      </Alert>
    );
  }

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Hubs" value={fmt(summary.total)} hint={`${fmt(summary.humanitarianHubs)} humanitarian · ${fmt(summary.developmentHubs)} development · ${fmt(summary.operational)} operational`} icon="bi-house-gear" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="People working" value={fmt(summary.peopleWorking)} hint={`${fmt(summary.womenWorking)} women · ${fmt(summary.youthWorking)} youth`} icon="bi-people" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard
            label="Households served"
            value={fmt(summary.householdsServed)}
            hint={summary.humanitarianHubs > 0
              ? `${fmt(summary.refugeeHouseholdsServed)} refugee · ${fmt(summary.hostHouseholdsServed)} host · ${fmt(summary.settlements)} settlements`
              : 'Across active hubs'}
            icon="bi-house-heart"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <MetricCard label="Women-led hubs" value={fmt(summary.womenLedHubs)} hint={summary.activities[0] ? `Most common: ${summary.activities[0].label}` : 'No activities yet'} icon="bi-person-check" />
        </div>
      </div>

      <SectionCard
        title="Clean cooking hubs"
        description="Places around the country linked to clean cooking development, who runs them and what they do."
        action={access.canWrite && <Button size="sm" className={styles.primaryButton} onClick={() => setShowAdd(true)}><i className="bi bi-plus-lg me-1" />Add hub</Button>}
      >
        {(hubs || []).length > 0 && (
          <div className={`${styles.toolbar} mb-3`}>
            <div className={styles.toolbarGroup}>
              <Form.Select size="sm" style={{ width: 'auto' }} value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="Filter by district">
                <option value="">All districts</option>
                {hubDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
              <Form.Select size="sm" style={{ width: 'auto' }} value={hubContext} onChange={(e) => setHubContext(e.target.value)} aria-label="Filter by hub type">
                <option value="">Humanitarian &amp; development</option>
                {HUB_OPTIONS.context.map((o) => <option key={o.value} value={o.value}>{o.short}</option>)}
              </Form.Select>
              <Form.Select size="sm" style={{ width: 'auto' }} value={activity} onChange={(e) => setActivity(e.target.value)} aria-label="Filter by activity">
                <option value="">All activities</option>
                {summary.activities.map((a) => <option key={a.activity} value={a.activity}>{a.label} ({a.hubs})</option>)}
              </Form.Select>
            </div>
            <span className="small text-muted">{visible.length} of {hubs.length} hubs</span>
          </div>
        )}

        {(hubs || []).length === 0 ? (
          <EmptyState icon="bi-house-gear" title="No hubs yet" text="Add the first hub: where it is, who manages it and what is done there (briquettes, solar lights, solar milling…)." />
        ) : visible.length === 0 ? (
          <p className="text-muted mb-0">No hubs match these filters.</p>
        ) : (
          <div className={styles.hubGrid}>
            {visible.map((hub) => <HubCard key={hub.$id} hub={hub} access={access} onEdit={setEditing} onDelete={remove} />)}
          </div>
        )}
      </SectionCard>

      <HubModal
        show={showAdd || Boolean(editing)}
        onHide={() => { setShowAdd(false); setEditing(null); }}
        projectId={projectId}
        hub={editing}
        districts={districtsQuery.data || []}
        showToast={showToast}
      />
    </>
  );
}
