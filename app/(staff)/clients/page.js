'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Button, Row, Col, InputGroup, Badge, Form } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ClientsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: clients = [], isLoading: loading } = useClients(user?.organizationId);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast, showToast, hideToast } = useToast();

  // Filter clients by search term
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.primaryContact?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.primaryContact?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.primaryContact?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading clients..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Client Organizations</h2>
          <p className="text-muted mb-0">Manage your organization&apos;s client organizations and contacts</p>
        </div>
        {user?.isAdmin && (
          <Button variant="primary" onClick={() => router.push('/clients/new')}>
            <i className="bi bi-plus-circle me-2"></i>
            New Client Organization
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Total Organizations</p>
                  <h3 className="mb-0">{stats.total}</h3>
                </div>
                <div className="fs-2 text-primary opacity-50">
                  <i className="bi bi-building"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">Active Organizations</p>
                  <h3 className="mb-0">{stats.active}</h3>
                </div>
                <div className="fs-2 text-success opacity-50">
                  <i className="bi bi-check-circle"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1 small">With Primary Contact</p>
                  <h3 className="mb-0">{clients.filter(c => c.primaryContactId).length}</h3>
                </div>
                <div className="fs-2 text-info opacity-50">
                  <i className="bi bi-person-check"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Search Bar */}
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={9}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search client organizations by name, code, contact person, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3} className="text-end">
              <small className="text-muted">
                Showing {filteredClients.length} of {clients.length} client organizations
              </small>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Clients Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Card.Body className="p-0">
          {filteredClients.length === 0 ? (
            <div className="text-center py-5">
              {clients.length === 0 ? (
                <>
                  <div className="mb-3">
                    <div className="d-inline-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '80px', height: '80px' }}>
                      <i className="bi bi-people" style={{ fontSize: '2.5rem', opacity: 0.5 }}></i>
                    </div>
                  </div>
                  <h5>No Client Organizations Yet</h5>
                  <p className="text-muted">
                    {user?.isAdmin
                      ? 'Get started by adding your first client organization'
                      : 'No client organizations have been added yet'}
                  </p>
                  {user?.isAdmin && (
                    <Button variant="primary" onClick={() => router.push('/clients/new')}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Add Your First Client Organization
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <i className="bi bi-search" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  </div>
                  <h5>No Clients Found</h5>
                  <p className="text-muted">Try adjusting your search criteria</p>
                </>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 aligned-table">
                <thead className="bg-light">
                  <tr>
                    <th className="py-3 ps-4 border-0">Organization</th>
                    <th className="py-3 border-0">Contact Info</th>
                    <th className="py-3 border-0">Primary Person</th>
                    <th className="py-3 border-0">Status</th>
                    <th className="py-3 pe-4 border-0 text-center" style={{ width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.$id}>
                      <td className="ps-4 align-middle">
                        <div className="d-flex align-items-center">
                          <div className="rounded d-flex align-items-center justify-content-center me-3 text-white fw-bold shadow-sm"
                            style={{
                              width: '40px',
                              height: '40px',
                              background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                              fontSize: '1rem'
                            }}>
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{client.name}</div>
                            <div className="d-flex gap-2 align-items-center mt-1">
                              {client.code && (
                                <Badge bg="light" text="dark" className="border">
                                  {client.code}
                                </Badge>
                              )}
                              {client.website && (
                                <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-muted text-decoration-none small" title="Visit Website">
                                  <i className="bi bi-globe me-1"></i>
                                  Website
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle">
                        <div className="d-flex flex-column gap-1">
                          {client.email ? (
                            <a href={`mailto:${client.email}`} className="text-decoration-none text-body small">
                              <i className="bi bi-envelope text-muted me-2"></i>
                              {client.email}
                            </a>
                          ) : (
                            <span className="text-muted small fst-italic ps-1">No email</span>
                          )}

                          {client.phone ? (
                            <span className="small text-body">
                              <i className="bi bi-telephone text-muted me-2"></i>
                              {client.phone}
                            </span>
                          ) : (
                            <span className="text-muted small fst-italic ps-1">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="align-middle">
                        {client.primaryContact ? (
                          <div className="d-flex align-items-center">
                            <div className="rounded-circle bg-light d-flex align-items-center justify-content-center me-2 border"
                              style={{ width: '32px', height: '32px' }}>
                              <i className="bi bi-person text-secondary"></i>
                            </div>
                            <div>
                              <div className="small fw-semibold">{client.primaryContact.firstName} {client.primaryContact.lastName}</div>
                              <a href={`mailto:${client.primaryContact.email}`} className="text-muted text-decoration-none small d-block">
                                {client.primaryContact.email}
                              </a>
                            </div>
                          </div>
                        ) : client.contactName ? (
                          <div className="text-muted small">
                            <div><i className="bi bi-person me-1"></i> {client.contactName}</div>
                            {client.contactEmail && <div>{client.contactEmail}</div>}
                            <div className="fst-italic scale-80">(Legacy)</div>
                          </div>
                        ) : (
                          <Badge bg="light" text="secondary" className="fw-normal border">
                            Not Assigned
                          </Badge>
                        )}
                      </td>
                      <td className="align-middle">
                        <Badge
                          bg={client.status === 'active' ? 'success' : client.status === 'inactive' ? 'secondary' : 'warning'}
                          className="text-uppercase"
                          style={{
                            letterSpacing: '0.5px',
                            fontSize: '0.7rem',
                            opacity: 0.9
                          }}
                        >
                          {client.status || 'active'}
                        </Badge>
                      </td>
                      <td className="align-middle pe-4 text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <Button
                            size="sm"
                            variant="light"
                            className="text-primary border-0 shadow-sm"
                            onClick={() => router.push(`/clients/${client.$id}`)}
                            title="View Details"
                            style={{ width: '32px', height: '32px', padding: 0 }}
                          >
                            <i className="bi bi-eye-fill" style={{ fontSize: '0.9rem' }}></i>
                          </Button>
                          {user?.isAdmin && (
                            <Button
                              size="sm"
                              variant="light"
                              className="text-primary border-0 shadow-sm"
                              onClick={() => router.push(`/clients/${client.$id}/edit`)}
                              title="Edit Details"
                              style={{ width: '32px', height: '32px', padding: 0 }}
                            >
                              <i className="bi bi-pencil-fill" style={{ fontSize: '0.9rem' }}></i>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </AppLayout>
  );
}
