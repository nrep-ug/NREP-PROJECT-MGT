'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, Form, InputGroup, ButtonGroup, Card as BootstrapCard } from 'react-bootstrap';
import { useProjectTasks } from '@/hooks/useProjects';
import { formatDate } from '@/lib/date';

export default function ProjectTasks({ project, user, showToast, canModify }) {
  const router = useRouter();
  const { data: tasks = [], isLoading: loading } = useProjectTasks(project?.$id);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'secondary',
      medium: 'info',
      high: 'warning',
      critical: 'danger'
    };
    return colors[priority] || 'secondary';
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'secondary',
      in_progress: 'primary',
      blocked: 'danger',
      done: 'success'
    };
    return colors[status] || 'secondary';
  };

  const getStatusIcon = (status) => {
    const icons = {
      todo: 'bi-circle',
      in_progress: 'bi-arrow-clockwise',
      blocked: 'bi-x-octagon',
      done: 'bi-check-circle-fill'
    };
    return icons[status] || 'bi-circle';
  };

  const getStatusCardStyles = (status) => {
    const styles = {
      todo: { bg: '#f1f5f9', icon: '#64748b' },
      in_progress: { bg: '#ecfdf5', icon: '#054653' },
      blocked: { bg: '#fee2e2', icon: '#dc3545' },
      done: { bg: '#dcfce7', icon: '#16a34a' }
    };
    return styles[status] || { bg: '#f1f5f9', icon: '#64748b' };
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  // Group tasks by status
  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    blocked: filteredTasks.filter(t => t.status === 'blocked'),
    done: filteredTasks.filter(t => t.status === 'done'),
  };

  const statusLabels = {
    todo: 'To Do',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    done: 'Done'
  };

  const TaskCard = ({ task }) => (
    <div
      className="task-card mb-3"
      onClick={() => router.push(`/projects/${project.$id}/tasks/${task.$id}`)}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <BootstrapCard className="border-0 shadow-sm h-100">
        <BootstrapCard.Body>
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h6 className="mb-0 flex-grow-1">{task.title}</h6>
            <Badge bg={getPriorityColor(task.priority)} className="ms-2">
              {task.priority}
            </Badge>
          </div>

          {task.description && (
            <p className="small text-muted mb-2" style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {task.description}
            </p>
          )}

          <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
            {task.dueDate && (
              <small className="text-muted">
                <i className="bi bi-calendar-event me-1"></i>
                {formatDate(task.dueDate)}
              </small>
            )}
            {task.estimatedHours > 0 && (
              <small className="text-muted">
                <i className="bi bi-clock me-1"></i>
                {task.estimatedHours}h
              </small>
            )}
            {task.assignedTo && task.assignedTo.length > 0 && (
              <small className="text-muted">
                <i className="bi bi-person me-1"></i>
                {task.assignedTo.length}
              </small>
            )}
          </div>
        </BootstrapCard.Body>
      </BootstrapCard>
    </div>
  );

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div>
      {/* Header with Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">Tasks</h5>
          <Badge bg="secondary">{filteredTasks.length}</Badge>
        </div>

        <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
          {/* Search */}
          <InputGroup style={{ maxWidth: '300px' }}>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          {/* Priority Filter */}
          <Form.Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ maxWidth: '150px' }}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Form.Select>

          {/* View Toggle */}
          <ButtonGroup size="sm">
            <Button
              variant={viewMode === 'kanban' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('kanban')}
            >
              <i className="bi bi-kanban"></i>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('list')}
            >
              <i className="bi bi-list-ul"></i>
            </Button>
          </ButtonGroup>

          {/* Add Task Button */}
          {canModify && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/projects/${project.$id}/tasks/new`)}
            >
              <i className="bi bi-plus-circle me-1"></i>
              <span className="d-none d-sm-inline">New Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Task Statistics */}
      <div className="row mb-4">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
          const cardStyles = getStatusCardStyles(status);
          return (
            <div key={status} className="col-6 col-md-3 mb-2">
              <BootstrapCard className="border-0 shadow-sm h-100">
                <BootstrapCard.Body className="p-3">
                  <div className="d-flex align-items-center">
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: cardStyles.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '0.5rem',
                        flexShrink: 0
                      }}
                    >
                      <i className={getStatusIcon(status)} style={{ fontSize: '1.5rem', color: cardStyles.icon }}></i>
                    </div>
                    <div>
                      <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>{statusLabels[status]}</div>
                      <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{statusTasks.length}</h4>
                    </div>
                  </div>
                </BootstrapCard.Body>
              </BootstrapCard>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-3">
            <i className="bi bi-list-task" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          </div>
          <h5>{searchTerm || priorityFilter !== 'all' ? 'No tasks found' : 'No Tasks Yet'}</h5>
          <p className="text-muted mb-3">
            {searchTerm || priorityFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first task to start managing work'}
          </p>
          {!searchTerm && priorityFilter === 'all' && canModify && (
            <Button
              variant="primary"
              onClick={() => router.push(`/projects/${project.$id}/tasks/new`)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Create Task
            </Button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="kanban-board" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginTop: '1rem'
        }}>
          {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
            <div key={status} className="kanban-column">
              <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <i className={`${getStatusIcon(status)} text-${getStatusColor(status)}`}></i>
                  <h6 className="mb-0 text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>
                    {statusLabels[status]}
                  </h6>
                  <Badge bg={getStatusColor(status)} pill>
                    {statusTasks.length}
                  </Badge>
                </div>
              </div>

              <div className="kanban-cards">
                {statusTasks.length === 0 ? (
                  <p className="text-muted text-center small fst-italic py-3">No tasks</p>
                ) : (
                  statusTasks.map(task => <TaskCard key={task.$id} task={task} />)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="list-view mt-3">
          {filteredTasks.map(task => (
            <BootstrapCard
              key={task.$id}
              className="mb-2 border-0 shadow-sm"
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/projects/${project.$id}/tasks/${task.$id}`)}
            >
              <BootstrapCard.Body className="p-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="flex-shrink-0">
                    <i className={`${getStatusIcon(task.status)} text-${getStatusColor(task.status)}`} style={{ fontSize: '1.5rem' }}></i>
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="mb-1">{task.title}</h6>
                      <div className="d-flex gap-2">
                        <Badge bg={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge bg={getStatusColor(task.status)}>
                          {statusLabels[task.status]}
                        </Badge>
                      </div>
                    </div>
                    {task.description && (
                      <p className="small text-muted mb-2" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {task.description}
                      </p>
                    )}
                    <div className="d-flex flex-wrap gap-3 small text-muted">
                      {task.dueDate && (
                        <span>
                          <i className="bi bi-calendar-event me-1"></i>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.estimatedHours > 0 && (
                        <span>
                          <i className="bi bi-clock me-1"></i>
                          {task.estimatedHours} hours
                        </span>
                      )}
                      {task.assignedTo && task.assignedTo.length > 0 && (
                        <span>
                          <i className="bi bi-person me-1"></i>
                          {task.assignedTo.length} assigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </BootstrapCard.Body>
            </BootstrapCard>
          ))}
        </div>
      )}

      <style jsx global>{`
        .task-card:hover .card {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }

        .kanban-column {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 0.5rem;
          min-height: 200px;
        }

        .kanban-cards {
          max-height: 70vh;
          overflow-y: auto;
        }

        .kanban-cards::-webkit-scrollbar {
          width: 6px;
        }

        .kanban-cards::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .kanban-cards::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }

        .kanban-cards::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        .list-view .card:hover {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
    </div>
  );
}
