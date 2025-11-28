'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Row, Col, Badge, Alert, Table, Form, Modal } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, Query } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/date';
import { getStaffRoleOptions, getRoleColor, getRoleName } from '@/lib/projectRoles';

export default function TeamMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [member, setMember] = useState(null);
  const [memberDetails, setMemberDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // Check if current user can manage members
  const canManage = user?.isAdmin;

  useEffect(() => {
    if (user && params.id && params.memberId) {
      loadData();
    }
  }, [user, params.id, params.memberId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load project
      const projectDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.PROJECTS,
        params.id
      );
      setProject(projectDoc);

      // Load member from project team
      const membersResponse = await fetch(`/api/projects/${params.id}/members`);
      const membersData = await membersResponse.json();

      if (membersResponse.ok) {
        const foundMember = membersData.members?.find(m => m.accountId === params.memberId);
        if (foundMember) {
          setMember(foundMember);
          setSelectedRoles(foundMember.projectRoles || []);
        } else {
          showToast('Team member not found in this project', 'danger');
        }
      }

      // Load member details from users collection
      const usersResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.USERS,
        [Query.equal('accountId', params.memberId)]
      );

      if (usersResponse.documents.length > 0) {
        setMemberDetails(usersResponse.documents[0]);
      }

      // Load tasks assigned to this member in this project
      const tasksResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.TASKS,
        [
          Query.equal('projectId', params.id),
          Query.contains('assignedTo', params.memberId),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      );
      setTasks(tasksResponse.documents);
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('Failed to load team member details', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoles = async () => {
    if (selectedRoles.length === 0) {
      showToast('Please select at least one role', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${params.id}/members/update-roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: member.membershipId,
          roles: selectedRoles,
          requesterId: user?.authUser?.$id || user?.id,
          organizationId: project.organizationId
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Roles updated successfully!', 'success');
        setShowEditRoleModal(false);
        // Reload member data
        loadData();
      } else {
        showToast(data.error || 'Failed to update roles', 'danger');
      }
    } catch (error) {
      showToast('Error updating roles', 'danger');
      console.error('Error updating roles:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      todo: 'secondary',
      in_progress: 'primary',
      blocked: 'danger',
      done: 'success'
    };
    return colors[status] || 'secondary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'secondary',
      medium: 'info',
      high: 'warning',
      critical: 'danger'
    };
    return colors[priority] || 'secondary';
  };

  const getTaskStats = () => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading team member..." />
      </AppLayout>
    );
  }

  if (!project || !member) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Team member not found or you don&apos;t have permission to access this project.
        </Alert>
      </AppLayout>
    );
  }

  const stats = getTaskStats();

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => router.push(`/projects/${project.$id}?tab=team`)}
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back to Team
              </Button>
            </div>
            <div className="d-flex align-items-center gap-3 mb-2">
              <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                   style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-person-fill text-primary" style={{ fontSize: '2rem' }}></i>
              </div>
              <div>
                <h2 className="mb-1">{member.firstName} {member.lastName}</h2>
                <p className="text-muted mb-0">
                  @{member.username} | {member.email}
                </p>
              </div>
            </div>
            <p className="text-muted mb-0">
              Project: <strong>{project.name}</strong> ({project.code})
            </p>
          </div>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowEditRoleModal(true)}
            >
              <i className="bi bi-pencil me-1"></i>
              Edit Roles
            </Button>
          )}
        </div>
      </div>

      {/* Task Statistics */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-list-task" style={{ fontSize: '2rem', color: '#6c757d' }}></i>
              </div>
              <h3 className="mb-1">{stats.total}</h3>
              <div className="text-muted small">Total Tasks</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-arrow-clockwise" style={{ fontSize: '2rem', color: '#054653' }}></i>
              </div>
              <h3 className="mb-1">{stats.inProgress}</h3>
              <div className="text-muted small">In Progress</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-x-octagon" style={{ fontSize: '2rem', color: '#dc3545' }}></i>
              </div>
              <h3 className="mb-1">{stats.blocked}</h3>
              <div className="text-muted small">Blocked</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#198754' }}></i>
              </div>
              <h3 className="mb-1">{stats.done}</h3>
              <div className="text-muted small">Completed</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Member Details & Tasks */}
      <Row>
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Member Information</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <h6 className="text-muted mb-2">Full Name</h6>
                <p className="mb-0">{member.firstName} {member.lastName}</p>
              </div>

              <div className="mb-3">
                <h6 className="text-muted mb-2">Username</h6>
                <p className="mb-0">@{member.username}</p>
              </div>

              <div className="mb-3">
                <h6 className="text-muted mb-2">Email</h6>
                <p className="mb-0">{member.email}</p>
              </div>

              <div className="mb-3">
                <h6 className="text-muted mb-2">Project Roles</h6>
                <div className="d-flex flex-wrap gap-1">
                  {member.projectRoles && member.projectRoles.length > 0 ? (
                    member.projectRoles.map((role) => (
                      <Badge key={role} bg={getRoleColor(role)}>
                        {getRoleName(role)}
                      </Badge>
                    ))
                  ) : (
                    <Badge bg="light" text="dark">No roles assigned</Badge>
                  )}
                </div>
              </div>

              <div>
                <h6 className="text-muted mb-2">Organization Roles</h6>
                <div className="d-flex flex-wrap gap-1">
                  {member.roles && member.roles.length > 0 ? (
                    member.roles.map((role) => (
                      <Badge key={role} bg="light" text="dark">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge bg="light" text="dark">None</Badge>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>

          {memberDetails && (
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h5 className="mb-0">Account Details</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Account Status</h6>
                  <Badge bg={memberDetails.status === 'active' ? 'success' : 'secondary'}>
                    {memberDetails.status || 'active'}
                  </Badge>
                </div>

                {memberDetails.$createdAt && (
                  <div className="mb-3">
                    <h6 className="text-muted mb-2">Account Created</h6>
                    <p className="mb-0">{formatDate(memberDetails.$createdAt)}</p>
                  </div>
                )}

                {memberDetails.organizationId && (
                  <div>
                    <h6 className="text-muted mb-2">Organization ID</h6>
                    <p className="mb-0 text-muted" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {memberDetails.organizationId}
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Assigned Tasks ({tasks.length})</h5>
            </Card.Header>
            <Card.Body className="p-0">
              {tasks.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  </div>
                  <h6>No Tasks Assigned</h6>
                  <p className="text-muted mb-3">This team member has no tasks assigned in this project</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due Date</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr
                          key={task.$id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/projects/${project.$id}/tasks/${task.$id}`)}
                        >
                          <td>
                            <strong>{task.title}</strong>
                            {task.description && (
                              <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <Badge bg={getTaskStatusColor(task.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={getPriorityColor(task.priority)} style={{ fontSize: '0.7rem' }}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td>
                            {task.dueDate ? (
                              <small>{formatDate(task.dueDate)}</small>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                          <td>
                            <small>{task.estimatedHours || 0}h</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Edit Roles Modal */}
      <Modal show={showEditRoleModal} onHide={() => setShowEditRoleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Project Roles</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Update roles for <strong>{member.firstName} {member.lastName}</strong> in this project.
          </p>
          <Form.Group className="mb-3">
            <Form.Label>Project Roles</Form.Label>
            {getStaffRoleOptions().map((roleOption) => (
              <Form.Check
                key={roleOption.value}
                type="checkbox"
                id={`role-${roleOption.value}`}
                label={
                  <>
                    <strong>{roleOption.label}</strong> - {roleOption.description}
                  </>
                }
                checked={selectedRoles.includes(roleOption.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRoles([...selectedRoles, roleOption.value]);
                  } else {
                    setSelectedRoles(selectedRoles.filter(r => r !== roleOption.value));
                  }
                }}
                disabled={submitting}
              />
            ))}
            <Form.Text className="text-muted">
              Select one or more roles for this team member
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditRoleModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateRoles}
            disabled={submitting || selectedRoles.length === 0}
          >
            {submitting ? 'Updating...' : 'Update Roles'}
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}
