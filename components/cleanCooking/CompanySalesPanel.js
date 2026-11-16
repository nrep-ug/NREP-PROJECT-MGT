'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import {
  useCleanCookingCompanies,
  useCleanCookingMutation,
  useCleanCookingSales,
} from '@/hooks/useCleanCooking';
import { periodFromLabel } from '@/lib/cleanCooking/domain';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import styles from './CleanCooking.module.css';

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

const EMPTY_FORM = { companyId: '', fromMonth: 'Jan', toMonth: 'Mar', year: THIS_YEAR, brand: '', product: 'EPC', sizeLitres: '', quantity: '', notes: '' };

function SaleModal({ show, onHide, projectId, companies, brands, sale, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const onEnter = () => {
    setError('');
    if (!sale) { setForm({ ...EMPTY_FORM, companyId: companies[0]?.$id || '' }); return; }
    const start = new Date(sale.periodStart);
    const end = new Date(sale.periodEnd);
    setForm({
      companyId: sale.companyId,
      fromMonth: MONTHS[start.getUTCMonth()],
      toMonth: MONTHS[end.getUTCMonth()],
      year: start.getUTCFullYear(),
      brand: sale.brand,
      product: sale.product || 'EPC',
      sizeLitres: sale.sizeLitres ?? '',
      quantity: sale.quantity,
      notes: sale.notes || '',
    });
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const period = periodFromLabel(`${form.fromMonth}-${form.toMonth}`, Number(form.year));
    if (!period) { setError('The period end month must be the same as or after the start month.'); return; }
    const body = {
      companyId: form.companyId,
      ...period,
      brand: form.brand,
      product: form.product,
      sizeLitres: form.sizeLitres,
      quantity: form.quantity,
      notes: form.notes,
    };
    mutation.mutate(
      sale ? { path: `/sales/${sale.$id}`, method: 'PATCH', body } : { path: '/sales', method: 'POST', body },
      {
        onSuccess: () => { showToast?.(sale ? 'Sales record updated.' : 'Sales record added.', 'success'); onHide(); },
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <Modal show={show} onHide={onHide} onEnter={onEnter} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">{sale ? 'Edit sales record' : 'Add sales record'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Company</Form.Label>
            <Form.Select value={form.companyId} onChange={set('companyId')} required>
              <option value="" disabled>Select a company…</option>
              {companies.map((c) => <option key={c.$id} value={c.$id}>{c.name}</option>)}
            </Form.Select>
            {companies.length === 0 && <Form.Text>Add the company under “Companies” first.</Form.Text>}
          </Form.Group>
          <Form.Label>Reporting period</Form.Label>
          <div className="d-flex gap-2 mb-3">
            <Form.Select aria-label="From month" value={form.fromMonth} onChange={set('fromMonth')}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</Form.Select>
            <span className="align-self-center text-muted">to</span>
            <Form.Select aria-label="To month" value={form.toMonth} onChange={set('toMonth')}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</Form.Select>
            <Form.Select aria-label="Year" value={form.year} onChange={set('year')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</Form.Select>
          </div>
          <div className="row g-2">
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Brand</Form.Label>
              <Form.Control list="cc-brands" value={form.brand} onChange={set('brand')} required maxLength={100} placeholder="e.g. Tefal" />
              <datalist id="cc-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Product</Form.Label>
              <Form.Control value={form.product} onChange={set('product')} maxLength={64} />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Size (litres)</Form.Label>
              <Form.Control type="number" min="0" step="0.5" value={form.sizeLitres} onChange={set('sizeLitres')} placeholder="e.g. 6" />
            </Form.Group>
            <Form.Group className="col-sm-6 mb-3">
              <Form.Label>Quantity sold</Form.Label>
              <Form.Control type="number" min="0" step="1" value={form.quantity} onChange={set('quantity')} required />
            </Form.Group>
          </div>
          <Form.Group>
            <Form.Label>Notes <span className="text-muted">(optional)</span></Form.Label>
            <Form.Control as="textarea" rows={2} value={form.notes} onChange={set('notes')} maxLength={500} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" className={styles.primaryButton} disabled={mutation.isPending || !form.companyId}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ImportModal({ show, onHide, projectId, showToast }) {
  const mutation = useCleanCookingMutation(projectId);
  const [table, setTable] = useState(null);
  const [fileName, setFileName] = useState('');
  const [year, setYear] = useState(THIS_YEAR - 1);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const reset = () => { setTable(null); setFileName(''); setPreview(null); setError(''); };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    reset();
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setError('Please choose a .csv file. In Excel use File → Save As → CSV.'); return; }
    setFileName(file.name);
    Papa.parse(file, {
      skipEmptyLines: false,
      complete: (result) => setTable(result.data),
      error: (err) => setError(err.message),
    });
  };

  const run = (apply) => {
    setError('');
    mutation.mutate(
      { path: '/sales/import', method: 'POST', body: { table, year: Number(year), apply }, skipInvalidate: !apply },
      {
        onSuccess: (data) => {
          if (!apply) { setPreview(data); return; }
          showToast?.(`Imported ${fmt(data.created)} sales records${data.newCompanies.length ? ` and ${data.newCompanies.length} new companies` : ''}.`, 'success');
          reset();
          onHide();
        },
        onError: (err) => setError(err.message),
      }
    );
  };

  return (
    <Modal show={show} onHide={() => { reset(); onHide(); }} size="lg" centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h5">Import company sales spreadsheet</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Use the <strong>EPCs SOLD BY DIFFERENT COMPANIES</strong> layout: columns No., Company, Reporting Period, Brand, Product, Size, Quantity.
          The company name only needs to appear on its first row. Rows already imported are skipped, so importing the same file twice is safe.
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="row g-2 align-items-end mb-3">
          <Form.Group className="col-sm-8">
            <Form.Label>CSV file</Form.Label>
            <Form.Control type="file" accept=".csv,text/csv" onChange={onFile} />
          </Form.Group>
          <Form.Group className="col-sm-4">
            <Form.Label>Year of the periods</Form.Label>
            <Form.Select value={year} onChange={(e) => { setYear(e.target.value); setPreview(null); }}>
              {YEARS.map((y) => <option key={y}>{y}</option>)}
            </Form.Select>
          </Form.Group>
        </div>

        {preview && (
          <>
            <div className="d-flex flex-wrap gap-2 mb-2">
              <span className={styles.pill}><i className="bi bi-check2-circle" />{fmt(preview.rows.length)} rows to import</span>
              <span className={styles.pill}><i className="bi bi-fire" />{fmt(preview.totalQuantity)} EPCs</span>
              {preview.newCompanies.length > 0 && <span className={styles.pill}><i className="bi bi-building-add" />{preview.newCompanies.length} new companies</span>}
              {preview.skipped > 0 && <span className={`${styles.pill} ${styles.pillMuted}`}>{preview.skipped} already imported (skipped)</span>}
              {preview.errors.length > 0 && <span className={`${styles.pill} ${styles.pillLead}`}>{preview.errors.length} rows with problems</span>}
            </div>
            {preview.errors.length > 0 && (
              <Alert variant="warning" className="small">
                These rows will <strong>not</strong> be imported:
                <ul className="mb-0">{preview.errors.slice(0, 10).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul>
              </Alert>
            )}
            {preview.newCompanies.length > 0 && (
              <p className="small mb-2"><strong>New companies:</strong> {preview.newCompanies.join(', ')}</p>
            )}
            <div className={styles.previewList}>
              <table className={`table table-sm ${styles.table}`}>
                <thead><tr><th>Company</th><th>Period</th><th>Brand</th><th className={styles.num}>Size</th><th className={styles.num}>Qty</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line}><td>{r.companyName}</td><td>{r.periodLabel}</td><td>{r.brand}</td><td className={styles.num}>{r.sizeLitres ? `${r.sizeLitres}L` : '—'}</td><td className={styles.num}>{fmt(r.quantity)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={() => { reset(); onHide(); }}>Cancel</Button>
        {!preview ? (
          <Button className={styles.primaryButton} disabled={!table || mutation.isPending} onClick={() => run(false)}>
            {mutation.isPending ? 'Checking…' : `Check ${fileName || 'file'}`}
          </Button>
        ) : (
          <Button className={styles.primaryButton} disabled={!preview.rows.length || mutation.isPending} onClick={() => run(true)}>
            {mutation.isPending ? 'Importing…' : `Import ${fmt(preview.rows.length)} rows`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default function CompanySalesPanel({ projectId, access, showToast }) {
  const salesQuery = useCleanCookingSales(projectId);
  const companiesQuery = useCleanCookingCompanies(projectId);
  const mutation = useCleanCookingMutation(projectId);
  const [companyFilter, setCompanyFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const companies = useMemo(() => companiesQuery.data || [], [companiesQuery.data]);
  const sales = useMemo(() => salesQuery.data || [], [salesQuery.data]);
  const companyName = useMemo(() => new Map(companies.map((c) => [c.$id, c.name])), [companies]);
  const brands = useMemo(() => [...new Set(sales.map((s) => s.brand))].sort(), [sales]);
  const periods = useMemo(() => [...new Set(sales.map((s) => s.periodLabel))], [sales]);

  const filtered = sales.filter((s) => (!companyFilter || s.companyId === companyFilter) && (!periodFilter || s.periodLabel === periodFilter));
  const filteredTotal = filtered.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  const remove = (sale) => {
    if (!window.confirm(`Delete ${fmt(sale.quantity)} × ${sale.brand} for ${companyName.get(sale.companyId) || 'this company'} (${sale.periodLabel})?`)) return;
    mutation.mutate({ path: `/sales/${sale.$id}`, method: 'DELETE' }, {
      onSuccess: () => showToast?.('Sales record deleted.', 'success'),
      onError: (err) => showToast?.(err.message, 'danger'),
    });
  };

  if (salesQuery.isLoading || companiesQuery.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (salesQuery.error || companiesQuery.error) return <Alert variant="warning">{(salesQuery.error || companiesQuery.error).message}</Alert>;

  return (
    <SectionCard
      title="Company sales"
      description={`${fmt(filteredTotal)} EPCs in ${fmt(filtered.length)} records${companyFilter || periodFilter ? ' (filtered)' : ''}`}
      action={access.canWrite && (
        <div className={styles.toolbarGroup}>
          <Button size="sm" className={styles.secondaryButton} onClick={() => setShowImport(true)}><i className="bi bi-upload me-1" />Import spreadsheet</Button>
          <Button size="sm" className={styles.primaryButton} onClick={() => setShowAdd(true)}><i className="bi bi-plus-lg me-1" />Add record</Button>
        </div>
      )}
      flush
    >
      <div className="px-3 pt-3">
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <Form.Select size="sm" aria-label="Filter by company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} style={{ minWidth: 220 }}>
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.$id} value={c.$id}>{c.name}</option>)}
            </Form.Select>
            <Form.Select size="sm" aria-label="Filter by period" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All periods</option>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </Form.Select>
          </div>
        </div>
      </div>

      {sales.length === 0 ? (
        <EmptyState icon="bi-receipt" title="No sales recorded yet" text="Import the company sales spreadsheet (CSV) or add records one at a time." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`table table-hover ${styles.table}`}>
            <thead>
              <tr><th>Company</th><th>Period</th><th>Brand</th><th>Product</th><th className={styles.num}>Size</th><th className={styles.num}>Quantity</th><th>Source</th>{access.canWrite && <th aria-label="Actions" />}</tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.$id}>
                  <td className={styles.strong}>{companyName.get(s.companyId) || <span className={styles.muted}>Unknown</span>}</td>
                  <td>{s.periodLabel}</td>
                  <td>{s.brand}</td>
                  <td className={styles.muted}>{s.product || 'EPC'}</td>
                  <td className={styles.num}>{s.sizeLitres ? `${s.sizeLitres}L` : '—'}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{fmt(s.quantity)}</td>
                  <td><span className={`${styles.pill} ${s.source === 'import' ? styles.pillMuted : ''}`}>{s.source === 'import' ? 'Imported' : 'Manual'}</span></td>
                  {access.canWrite && (
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="link" className="p-1" aria-label="Edit" onClick={() => setEditing(s)}><i className="bi bi-pencil" /></Button>
                      {access.canManage && <Button size="sm" variant="link" className="p-1 text-danger" aria-label="Delete" onClick={() => remove(s)}><i className="bi bi-trash" /></Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SaleModal
        show={showAdd || Boolean(editing)}
        onHide={() => { setShowAdd(false); setEditing(null); }}
        projectId={projectId}
        companies={companies}
        brands={brands}
        sale={editing}
        showToast={showToast}
      />
      <ImportModal show={showImport} onHide={() => setShowImport(false)} projectId={projectId} showToast={showToast} />
    </SectionCard>
  );
}
