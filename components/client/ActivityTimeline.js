'use client';

import { Badge } from 'react-bootstrap';
import { formatDateTime } from '@/lib/date';

export default function ActivityTimeline({ activities }) {
  const getActivityIcon = (type) => {
    const icons = {
      task: 'bi-list-task',
      milestone: 'bi-flag',
      document: 'bi-file-earmark-text',
      project: 'bi-folder'
    };
    return icons[type] || 'bi-circle';
  };

  const getActivityColor = (type) => {
    const colors = {
      task: 'primary',
      milestone: 'success',
      document: 'info',
      project: 'warning'
    };
    return colors[type] || 'secondary';
  };

  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'task':
        return (
          <>
            Task <strong>{activity.title}</strong> was updated
            {activity.status && (
              <Badge bg="secondary" className="ms-2" style={{ fontSize: '0.65rem' }}>
                {activity.status.replace('_', ' ')}
              </Badge>
            )}
          </>
        );
      case 'milestone':
        return (
          <>
            Milestone <strong>{activity.title}</strong> status changed
            {activity.status && (
              <Badge bg="success" className="ms-2" style={{ fontSize: '0.65rem' }}>
                {activity.status}
              </Badge>
            )}
          </>
        );
      case 'document':
        return (
          <>
            Document <strong>{activity.title}</strong> was uploaded
          </>
        );
      case 'project':
        return (
          <>
            Project <strong>{activity.title}</strong> was updated
          </>
        );
      default:
        return activity.title;
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="bi bi-clock-history" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
        <p className="text-muted mb-0 mt-3">No recent activities</p>
      </div>
    );
  }

  return (
    <div className="activity-timeline">
      {activities.map((activity, index) => (
        <div key={activity.id || index} className="activity-item d-flex mb-3 pb-3 border-bottom">
          <div className="activity-icon me-3">
            <div
              className={`rounded-circle bg-${getActivityColor(activity.type)} bg-opacity-10 d-flex align-items-center justify-content-center`}
              style={{ width: '40px', height: '40px', minWidth: '40px' }}
            >
              <i className={`bi ${getActivityIcon(activity.type)} text-${getActivityColor(activity.type)}`}></i>
            </div>
          </div>
          <div className="activity-content flex-grow-1">
            <div className="activity-message mb-1">
              {getActivityMessage(activity)}
            </div>
            <div className="activity-meta">
              <small className="text-muted">
                <i className="bi bi-clock me-1"></i>
                {formatDateTime(activity.date)}
              </small>
              {activity.projectName && (
                <small className="text-muted ms-3">
                  <i className="bi bi-folder me-1"></i>
                  {activity.projectName}
                </small>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
