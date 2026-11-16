import styles from './WorkspaceUI.module.css';

/**
 * Number card in the dashboard style: colour wash, coloured border, solid
 * icon tile. Without `tone`, neighbouring cards in a grid alternate colours
 * automatically (teal → green → blue → green), like the home screen.
 *  - tone: 'teal' | 'green' | 'blue' | 'amber' | 'red' (optional override)
 *  - layout: 'row' puts icon, label and value on one line (wide cards)
 */
export default function MetricCard({ label, value, hint, icon = 'bi-graph-up', tone, layout }) {
  if (layout === 'row') {
    return (
      <div className={`${styles.metricCard} ${styles.metricRow}`} data-tone={tone}>
        <span className={styles.metricIcon}><i className={`bi ${icon}`} /></span>
        <div className={styles.metricRowText}>
          <span className={styles.metricLabel}>{label}</span>
          {hint && <div className={styles.metricHint}>{hint}</div>}
        </div>
        <div className={styles.metricRowValue}>{value}</div>
      </div>
    );
  }
  return (
    <div className={styles.metricCard} data-tone={tone}>
      <div className={styles.metricTopline}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricIcon}><i className={`bi ${icon}`} /></span>
      </div>
      <div className={styles.metricValue}>{value}</div>
      {hint && <div className={styles.metricHint}>{hint}</div>}
    </div>
  );
}
