import styles from './WorkspaceUI.module.css';

export default function MetricCard({ label, value, hint, icon = 'bi-graph-up' }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricTopline}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricIcon}><i className={`bi ${icon}`} /></span>
      </div>
      <div className={styles.metricValue}>{value}</div>
      {hint && <div className={styles.metricHint}>{hint}</div>}
    </div>
  );
}
