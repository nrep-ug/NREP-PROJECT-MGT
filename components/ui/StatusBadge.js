import styles from './WorkspaceUI.module.css';

const TONE = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  returned: 'info',
  rejected: 'danger',
  active: 'success',
  completed: 'success',
  planned: 'info',
  on_hold: 'warning',
};

const ICON = {
  draft: 'bi-pencil',
  submitted: 'bi-hourglass-split',
  approved: 'bi-check2-circle',
  returned: 'bi-arrow-return-left',
  rejected: 'bi-x-circle',
};

export default function StatusBadge({ status }) {
  const normalized = String(status || 'unknown').toLowerCase();
  const tone = TONE[normalized] || 'neutral';
  const toneClass = styles[`status${tone.charAt(0).toUpperCase()}${tone.slice(1)}`];
  return (
    <span className={`${styles.statusBadge} ${toneClass}`}>
      <i className={`bi ${ICON[normalized] || 'bi-circle-fill'}`} />
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}
