'use client';

import { useRouter } from 'next/navigation';
import styles from './ProjectViews.module.css';

/**
 * Quick actions shown beside the description on Projects → Overview.
 * (Project facts — timeline, budget, team — are the fact cards on the page.)
 */
export default function ProjectOverview({ project, user }) {
  const router = useRouter();
  const canEdit = user?.isAdmin || project.createdBy === user?.authUser?.$id;

  const actions = [
    canEdit && { key: 'edit', icon: 'bi-pencil-square', label: 'Edit project', hint: 'Name, dates, budget, description', href: `/projects/${project.$id}/edit` },
    canEdit && { key: 'settings', icon: 'bi-gear', label: 'Project settings', hint: 'Roles, modules, deletion', href: `/projects/${project.$id}/settings` },
  ].filter(Boolean);

  if (actions.length === 0) return null;

  return (
    <aside className={styles.quickActions} aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className={styles.overviewHeading}>Quick actions</h2>
      <div className={styles.quickActionRow}>
        {actions.map((action) => (
          <button key={action.key} type="button" className={styles.quickAction} title={action.hint} onClick={() => router.push(action.href)}>
            <span className={styles.quickActionIcon}><i className={`bi ${action.icon}`} /></span>
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
