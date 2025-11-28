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
      <Card className="border-0 shadow-sm">
        <Card.Body>
          {filteredClients.length === 0 ? (
            <div className="text-center py-5">
              {clients.length === 0 ? (
                <>
                  <div className="mb-3">
                    <i className="bi bi-people" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
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
                    <i className="bi bi-search" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                  </div>
                  <h5>No Clients Found</h5>
                  <p className="text-muted">Try adjusting your search criteria</p>
                </>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>Organization Name</th>
                    <th>Code</th>
                    <th>Primary Contact</th>
                    <th>Contact Email</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.$id}>
                      <td>
                        <div>
                          <strong>{client.name}</strong>
                          {client.website && (
                            <div className="small text-muted">
                              <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                                <i className="bi bi-link-45deg me-1"></i>
                                {client.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {client.code ? (
                          <Badge bg="secondary">{client.code}</Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {client.primaryContact ? (
                          <div>
                            <div>{client.primaryContact.firstName} {client.primaryContact.lastName}</div>
                            <small className="text-muted">@{client.primaryContact.username}</small>
                            {client.primaryContact.title && (
                              <div className="small text-muted">{client.primaryContact.title}</div>
                            )}
                          </div>
                        ) : client.contactName ? (
                          <div>
                            <div>{client.contactName}</div>
                            <small className="text-muted">(Legacy contact)</small>
                          </div>
                        ) : (
                          <span className="text-muted">No contact assigned</span>
                        )}
                      </td>
                      <td>
                        {client.primaryContact?.email ? (
                          <a href={`mailto:${client.primaryContact.email}`} className="text-decoration-none">
                            {client.primaryContact.email}
                          </a>
                        ) : client.contactEmail ? (
                          <a href={`mailto:${client.contactEmail}`} className="text-decoration-none">
                            {client.contactEmail} <small className="text-muted">(legacy)</small>
                          </a>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <Badge bg={client.status === 'active' ? 'success' : client.status === 'inactive' ? 'secondary' : 'danger'}>
                          {client.status || 'active'}
                        </Badge>
                      </td>
                      <td className="text-center">
                        {user?.isAdmin && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => router.push(`/clients/${client.$id}/edit`)}
                            title="Edit client organization"
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                        )}
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
