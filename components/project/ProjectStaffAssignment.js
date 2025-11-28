'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Form, Alert, Row, Col, InputGroup } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { getStaffRoleOptions, getRoleColor, getRoleName } from '@/lib/projectRoles';

export default function ProjectStaffAssignment({ projectId, organizationId, currentUser, showToast }) {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['member']); // Default to 'member' role
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Check if current user can manage members
  // TODO: Also check if user has 'manager' role in this specific project team
  const canManage = currentUser?.isAdmin;

  // Fetch project members
  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      const data = await response.json();

      if (response.ok) {
        setMembers(data.members || []);
      } else {
        console.error('Failed to fetch members:', data.error);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  // Fetch available staff
  const fetchStaff = async () => {
    try {
      const response = await fetch(`/api/staff?organizationId=${organizationId}`);
      const data = await response.json();

      if (response.ok) {
        setAvailableStaff(data.staff || []);
      } else {
        console.error('Failed to fetch staff:', data.error);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && organizationId) {
      fetchMembers();
      fetchStaff();
    }
  }, [projectId, organizationId]);

  const handleAddMember = async () => {
    if (!selectedStaff) {
      showToast('Please select a staff member', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedStaff,
          roles: selectedRoles,
          requesterId: currentUser?.authUser?.$id || currentUser?.id,
          organizationId
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Staff member added to project successfully', 'success');
        setShowAddModal(false);
        setSelectedStaff('');
        setSelectedRoles(['member']);
        fetchMembers(); // Refresh the list
      } else {
        showToast(data.error || 'Failed to add staff member', 'danger');
      }
    } catch (error) {
      showToast('Error adding staff member', 'danger');
      console.error('Error adding member:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (membershipId, userName) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this project?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/members?membershipId=${membershipId}&requesterId=${currentUser?.authUser?.$id || currentUser?.id}&organizationId=${organizationId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok) {
        showToast('Staff member removed from project', 'success');
        fetchMembers(); // Refresh the list
      } else {
        showToast(data.error || 'Failed to remove staff member', 'danger');
      }
    } catch (error) {
      showToast('Error removing staff member', 'danger');
      console.error('Error removing member:', error);
    }
  };

  // Get badge variant for project role
  const getRoleBadgeVariant = (role) => {
    return getRoleColor(role);
  };

  // Filter out staff already in the project
  const memberUserIds = members.map(m => m.accountId);
  const staffNotInProject = availableStaff.filter(s => !memberUserIds.includes(s.accountId));

  // Filter and search members
  const filteredMembers = members.filter(member => {
    const matchesSearch =
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || member.projectRoles?.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  // Get role statistics
  const roleStats = {
    total: members.length,
    manager: members.filter(m => m.projectRoles?.includes('manager')).length,
    lead: members.filter(m => m.projectRoles?.includes('lead')).length,
    developer: members.filter(m => m.projectRoles?.includes('developer')).length,
    designer: members.filter(m => m.projectRoles?.includes('designer')).length,
  };

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <p className="text-muted">Loading project team...</p>
        </Card.Body>
      </Card>
    );
  }

  const MemberCard = ({ member }) => (
    <Card
      className="member-card border-0 shadow-sm h-100"
      style={{ cursor: 'pointer' }}
      onClick={() => router.push(`/projects/${projectId}/team/${member.accountId}`)}
    >
      <Card.Body>
        <div className="d-flex align-items-start mb-3">
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '1rem',
              flexShrink: 0
            }}
          >
            <i className="bi bi-person-fill" style={{ fontSize: '1.5rem', color: '#054653' }}></i>
          </div>
          <div className="flex-grow-1 overflow-hidden">
            <h6 className="mb-1 text-truncate">{member.firstName} {member.lastName}</h6>
            <small className="text-muted d-block text-truncate">@{member.username}</small>
            <small className="text-muted d-block text-truncate">{member.email}</small>
          </div>
        </div>

        <div className="mb-2">
          <small className="text-muted d-block mb-1">Project Roles</small>
          <div className="d-flex flex-wrap gap-1">
            {member.projectRoles && member.projectRoles.length > 0 ? (
              member.projectRoles.map((role) => (
                <Badge key={role} bg={getRoleBadgeVariant(role)} style={{ fontSize: '0.7rem' }}>
                  {getRoleName(role)}
                </Badge>
              ))
            ) : (
              <Badge bg="light" text="dark" style={{ fontSize: '0.7rem' }}>No roles</Badge>
            )}
          </div>
        </div>

        {member.roles && member.roles.length > 0 && (
          <div>
            <small className="text-muted d-block mb-1">Organization Roles</small>
            <div className="d-flex flex-wrap gap-1">
              {member.roles.map((role) => (
                <Badge key={role} bg="light" text="dark" style={{ fontSize: '0.7rem' }}>
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {canManage && (
          <div className="mt-3 pt-3 border-top">
            <Button
              size="sm"
              variant="outline-danger"
              className="w-100"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveMember(member.membershipId, `${member.firstName} ${member.lastName}`);
              }}
            >
              <i className="bi bi-trash me-1"></i>
              Remove from Project
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <>
      {/* Header with Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">Project Team</h5>
          <Badge bg="secondary">{filteredMembers.length}</Badge>
        </div>

        <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
          {/* Search */}
          <InputGroup style={{ maxWidth: '300px' }}>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          {/* Role Filter */}
          <Form.Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ maxWidth: '150px' }}
          >
            <option value="all">All Roles</option>
            <option value="manager">Manager</option>
            <option value="lead">Lead</option>
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="qa">QA</option>
            <option value="member">Member</option>
          </Form.Select>

          {/* Add Staff Button */}
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-plus-circle me-1"></i>
              <span className="d-none d-sm-inline">Add Staff</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col xs={6} md={3} className="mb-2">
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-people" style={{ fontSize: '1.5rem', color: '#64748b' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Total</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{roleStats.total}</h4>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-person-badge" style={{ fontSize: '1.5rem', color: '#054653' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Managers</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{roleStats.manager}</h4>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-code-square" style={{ fontSize: '1.5rem', color: '#16a34a' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Developers</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{roleStats.developer}</h4>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} className="mb-2">
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
            <Card.Body className="p-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '0.75rem',
                    flexShrink: 0
                  }}
                >
                  <i className="bi bi-palette" style={{ fontSize: '1.5rem', color: '#f59e0b' }}></i>
                </div>
                <div>
                  <div className="small text-muted" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Designers</div>
                  <h4 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e293b' }}>{roleStats.designer}</h4>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Team Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-3">
            <i className="bi bi-people" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          </div>
          <h5>{searchTerm || roleFilter !== 'all' ? 'No team members found' : 'No Team Members Yet'}</h5>
          <p className="text-muted mb-3">
            {searchTerm || roleFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Add staff members to start building your project team'}
          </p>
          {!searchTerm && roleFilter === 'all' && canManage && (
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Staff Member
            </Button>
          )}
        </div>
      ) : (
        <Row>
          {filteredMembers.map(member => (
            <Col key={member.$id} xs={12} md={6} lg={4} className="mb-3">
              <MemberCard member={member} />
            </Col>
          ))}
        </Row>
      )}

      {/* Add Staff Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Staff to Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {staffNotInProject.length === 0 ? (
            <Alert variant="info">
              All available staff members are already assigned to this project.
            </Alert>
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Select Staff Member</Form.Label>
                <Form.Select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Choose a staff member...</option>
                  {staffNotInProject.map((staff) => (
                    <option key={staff.$id} value={staff.accountId}>
                      {staff.firstName} {staff.lastName} (@{staff.username}) - {staff.roles?.join(', ')}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

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
                  Select one or more roles for this staff member in the project
                </Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddMember}
            disabled={submitting || !selectedStaff || selectedRoles.length === 0 || staffNotInProject.length === 0}
          >
            {submitting ? 'Adding...' : 'Add to Project'}
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx global>{`
        .member-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
          transition: all 0.2s;
        }
      `}</style>
    </>
  );
}
