'use client';

import { useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { useCleanCookingMutation, useCleanCookingStatus } from '@/hooks/useCleanCooking';
import SectionCard from '@/components/ui/SectionCard';
import CleanCookingDashboard from './CleanCookingDashboard';
import CompanySalesPanel from './CompanySalesPanel';
import CompaniesPanel from './CompaniesPanel';
import ChampionsPanel from './ChampionsPanel';
import FieldReportsPanel from './FieldReportsPanel';
import HubsPanel from './HubsPanel';
import MarketFiguresPanel from './MarketFiguresPanel';
import styles from './CleanCooking.module.css';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { key: 'field', label: 'Field reports', icon: 'bi-clipboard-data' },
  { key: 'figures', label: 'Sales figures', icon: 'bi-bar-chart-line' },
  { key: 'sales', label: 'Company sales', icon: 'bi-receipt' },
  { key: 'companies', label: 'Companies', icon: 'bi-building' },
  { key: 'champions', label: 'Champions', icon: 'bi-people' },
  { key: 'hubs', label: 'Hubs', icon: 'bi-house-gear' },
];

/**
 * Projects → [project] → Clean Cooking.
 * Shown by the project page only when the module is enabled (or to admins,
 * who see the "enable" card).
 */
export default function CleanCookingTab({ project, user, showToast }) {
  const [section, setSection] = useState('dashboard');
  const status = useCleanCookingStatus(project.$id);
  const mutation = useCleanCookingMutation(project.$id);

  if (status.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (status.error) return <Alert variant="warning">{status.error.message}</Alert>;

  if (!status.data?.enabled) {
    return (
      <div className={styles.root}>
        <SectionCard>
          <div className={styles.enableCard}>
            <span className={styles.enableIcon}><i className="bi bi-fire" /></span>
            <h2 className="h5 fw-bold">Clean Cooking is not enabled for this project</h2>
            <p className="text-muted mb-3">
              Enabling it adds EPC company sales, champions by district and a dashboard to {project.code}.
            </p>
            {user?.isAdmin ? (
              <Button
                className={styles.primaryButton}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ method: 'POST' }, {
                  onSuccess: () => showToast?.('Clean Cooking enabled for this project.', 'success'),
                  onError: (error) => showToast?.(error.message, 'danger'),
                })}
              >
                {mutation.isPending ? 'Enabling…' : 'Enable Clean Cooking'}
              </Button>
            ) : (
              <p className="small text-muted mb-0">Ask an administrator to enable it.</p>
            )}
          </div>
        </SectionCard>
      </div>
    );
  }

  const access = status.data.access || {};

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}><i className="bi bi-fire" />Clean Cooking</span>
          <h2 className={styles.title}>EPC sales, champions &amp; hubs</h2>
          <p className={styles.subtitle}>Electric pressure cooker sales, the champions working in each district, and clean cooking hubs around the country.</p>
        </div>
        <nav className={styles.subnav} aria-label="Clean Cooking sections">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.subnavButton} ${section === s.key ? styles.subnavActive : ''}`}
              aria-current={section === s.key ? 'page' : undefined}
              onClick={() => setSection(s.key)}
            >
              <i className={`bi ${s.icon}`} />{s.label}
            </button>
          ))}
        </nav>
      </div>

      {section === 'dashboard' && <CleanCookingDashboard projectId={project.$id} onNavigate={setSection} />}
      {section === 'field' && <FieldReportsPanel projectId={project.$id} access={access} showToast={showToast} />}
      {section === 'figures' && <MarketFiguresPanel projectId={project.$id} />}
      {section === 'sales' && <CompanySalesPanel projectId={project.$id} access={access} showToast={showToast} />}
      {section === 'companies' && <CompaniesPanel projectId={project.$id} access={access} showToast={showToast} />}
      {section === 'champions' && <ChampionsPanel projectId={project.$id} access={access} showToast={showToast} />}
      {section === 'hubs' && <HubsPanel projectId={project.$id} access={access} showToast={showToast} />}
    </div>
  );
}
