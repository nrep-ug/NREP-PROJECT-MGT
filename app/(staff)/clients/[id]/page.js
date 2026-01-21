'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button, Table, Tab, Nav } from 'react-bootstrap';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ClientDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { toast, showToast, hideToast } = useToast();

    const [client, setClient] = useState(null);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (user?.organizationId && params.id) {
            loadData();
        }
    }, [user, params.id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Fetch Client Details
            const clientRes = await fetch(`/api/clients/${params.id}`);
            if (!clientRes.ok) throw new Error('Failed to fetch client details');
            const clientData = await clientRes.json();
            setClient(clientData.client);

            // Fetch Projects linked to this client
            const projectsRes = await fetch(`/api/projects?organizationId=${user.organizationId}&clientId=${params.id}`);
            if (projectsRes.ok) {
                const projectsData = await projectsRes.json();
                setProjects(projectsData.projects || []);
            }

            // Fetch Users linked to this client
            const usersRes = await fetch(`/api/admin/users?organizationId=${user.organizationId}&clientOrganizationId=${params.id}`);
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                setUsers(usersData.users || []);
            }

        } catch (error) {
            console.error('Error loading client data:', error);
            showToast('Failed to load client information', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusColors = {
            active: 'success',
            inactive: 'secondary',
            suspended: 'danger',
            on_hold: 'warning',
            completed: 'success',
            planned: 'info',
            in_progress: 'primary'
        };
        return <Badge bg={statusColors[status] || 'secondary'} className="text-uppercase">{status?.replace('_', ' ') || 'Unknown'}</Badge>;
    };

    if (authLoading || loading) {
        return (
            <AppLayout user={user}>
                <LoadingSpinner message="Loading client details..." />
            </AppLayout>
        );
    }

    if (!client) {
        return (
            <AppLayout user={user}>
                <div className="text-center py-5">
                    <h3>Client Not Found</h3>
                    <Button variant="primary" onClick={() => router.push('/clients')} className="mt-3">
                        Back to Clients
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <div className="text-muted small mb-1">
                        <span className="cursor-pointer text-primary" onClick={() => router.push('/clients')}>Clients</span>
                        <span className="mx-2">/</span>
                        {client.name}
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <h2 className="mb-0">{client.name}</h2>
                        {getStatusBadge(client.status)}
                    </div>
                </div>
                {user?.isAdmin && (
                    <Button variant="outline-primary" onClick={() => router.push(`/clients/${client.$id}/edit`)}>
                        <i className="bi bi-pencil me-2"></i>
                        Edit Details
                    </Button>
                )}
            </div>

            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                <Nav variant="tabs" className="mb-4">
                    <Nav.Item>
                        <Nav.Link eventKey="overview">Overview</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="projects">
                            Projects
                            <Badge bg="secondary" className="ms-2 rounded-pill" style={{ opacity: 0.8 }}>{projects.length}</Badge>
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="contacts">
                            Contacts
                            <Badge bg="secondary" className="ms-2 rounded-pill" style={{ opacity: 0.8 }}>{users.length}</Badge>
                        </Nav.Link>
                    </Nav.Item>
                </Nav>

                <Tab.Content>
                    <Tab.Pane eventKey="overview">
                        <Row>
                            <Col md={8}>
                                {/* Organization Details Card */}
                                <Card className="border-0 shadow-sm mb-4">
                                    <Card.Header className="bg-white py-3">
                                        <h5 className="mb-0 fw-bold">Organization Details</h5>
                                    </Card.Header>
                                    <Card.Body>
                                        <Row className="g-4">
                                            <Col md={6}>
                                                <div className="mb-3">
                                                    <label className="text-muted small fw-bold text-uppercase">Code</label>
                                                    <div className="fs-5">{client.code || '-'}</div>
                                                </div>
                                                <div className="mb-3">
                                                    <label className="text-muted small fw-bold text-uppercase">Website</label>
                                                    <div>
                                                        {client.website ? (
                                                            <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                                                                {client.website} <i className="bi bi-box-arrow-up-right small ms-1"></i>
                                                            </a>
                                                        ) : '-'}
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col md={6}>
                                                <div className="mb-3">
                                                    <label className="text-muted small fw-bold text-uppercase">Email</label>
                                                    <div>
                                                        {client.email ? (
                                                            <a href={`mailto:${client.email}`} className="text-decoration-none">
                                                                {client.email}
                                                            </a>
                                                        ) : '-'}
                                                    </div>
                                                </div>
                                                <div className="mb-3">
                                                    <label className="text-muted small fw-bold text-uppercase">Phone</label>
                                                    <div>{client.phone || '-'}</div>
                                                </div>
                                            </Col>
                                            <Col md={12}>
                                                <div>
                                                    <label className="text-muted small fw-bold text-uppercase">Address</label>
                                                    <div style={{ whiteSpace: 'pre-line' }}>{client.address || '-'}</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>

                                {/* Notes Card */}
                                {client.notes && (
                                    <Card className="border-0 shadow-sm mb-4">
                                        <Card.Header className="bg-white py-3">
                                            <h5 className="mb-0 fw-bold">Notes</h5>
                                        </Card.Header>
                                        <Card.Body>
                                            <div className="text-muted" style={{ whiteSpace: 'pre-line' }}>
                                                {client.notes}
                                            </div>
                                        </Card.Body>
                                    </Card>
                                )}
                            </Col>

                            <Col md={4}>
                                {/* Primary Contact Card */}
                                <Card className="border-0 shadow-sm mb-4">
                                    <Card.Header className="bg-white py-3">
                                        <h5 className="mb-0 fw-bold">Primary Contact</h5>
                                    </Card.Header>
                                    <Card.Body>
                                        {client.primaryContact ? (
                                            <div className="d-flex align-items-center mb-3">
                                                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3 border"
                                                    style={{ width: '50px', height: '50px' }}>
                                                    <i className="bi bi-person text-secondary fs-4"></i>
                                                </div>
                                                <div>
                                                    <div className="fw-bold">{client.primaryContact.firstName} {client.primaryContact.lastName}</div>
                                                    <div className="text-muted small">{client.primaryContact.title || 'Client Representative'}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-muted fst-italic mb-3">No primary contact assigned.</div>
                                        )}

                                        {client.primaryContact && (
                                            <div className="d-flex flex-column gap-2 mt-3 pt-3 border-top">
                                                <div className="d-flex align-items-center gap-2 small">
                                                    <i className="bi bi-envelope text-muted"></i>
                                                    <a href={`mailto:${client.primaryContact.email}`} className="text-decoration-none text-body">
                                                        {client.primaryContact.email}
                                                    </a>
                                                </div>
                                                <div className="d-flex align-items-center gap-2 small">
                                                    <i className="bi bi-person-badge text-muted"></i>
                                                    <span className="text-muted">@{client.primaryContact.username}</span>
                                                </div>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>

                                {/* Stats Card */}
                                <Card className="border-0 shadow-sm">
                                    <Card.Header className="bg-white py-3">
                                        <h5 className="mb-0 fw-bold">Statistics</h5>
                                    </Card.Header>
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <span>Total Projects</span>
                                            <Badge bg="light" text="dark" className="border fs-6">{projects.length}</Badge>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span>Active Projects</span>
                                            <Badge bg="light" text="dark" className="border fs-6">
                                                {projects.filter(p => p.status === 'in_progress' || p.status === 'planned').length}
                                            </Badge>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    </Tab.Pane>

                    <Tab.Pane eventKey="projects">
                        <Card className="border-0 shadow-sm">
                            <Card.Body className="p-0">
                                <div className="table-responsive">
                                    <Table hover className="mb-0 align-middle">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4 py-3 border-0">Project</th>
                                                <th className="py-3 border-0">Status</th>
                                                <th className="py-3 border-0">Timeline</th>
                                                <th className="py-3 border-0 text-end pe-4">Budget</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {projects.length > 0 ? projects.map(project => (
                                                <tr key={project.$id} className="cursor-pointer" onClick={() => router.push(`/projects/${project.$id}`)}>
                                                    <td className="ps-4">
                                                        <div className="fw-semibold text-primary">{project.name}</div>
                                                        <div className="small text-muted">{project.code}</div>
                                                    </td>
                                                    <td>{getStatusBadge(project.status)}</td>
                                                    <td>
                                                        <div className="small">
                                                            {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="text-end pe-4">
                                                        {project.budgetAmount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.budgetAmount) : '-'}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-5 text-muted">
                                                        No projects found for this client.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>
                        </Card>
                    </Tab.Pane>

                    <Tab.Pane eventKey="contacts">
                        <Card className="border-0 shadow-sm">
                            <Card.Body className="p-0">
                                <div className="table-responsive">
                                    <Table hover className="mb-0 align-middle">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4 py-3 border-0">User</th>
                                                <th className="py-3 border-0">Contact</th>
                                                <th className="py-3 border-0">Role</th>
                                                <th className="py-3 border-0">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.length > 0 ? users.map(u => (
                                                <tr key={u.$id}>
                                                    <td className="ps-4">
                                                        <div className="d-flex align-items-center">
                                                            <div className="rounded-circle bg-light d-flex align-items-center justify-content-center me-2 border" style={{ width: '32px', height: '32px' }}>
                                                                <span className="small fw-bold text-secondary">{u.firstName?.[0]}{u.lastName?.[0]}</span>
                                                            </div>
                                                            <div>
                                                                <div className="fw-semibold">{u.firstName} {u.lastName}</div>
                                                                <div className="small text-muted">@{u.username}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <a href={`mailto:${u.email}`} className="text-decoration-none small text-body">
                                                            <i className="bi bi-envelope me-1 text-muted"></i>
                                                            {u.email}
                                                        </a>
                                                    </td>
                                                    <td>
                                                        {u.roles?.map(role => (
                                                            <Badge key={role} bg="light" text="dark" className="border me-1 text-capitalize">
                                                                {role}
                                                            </Badge>
                                                        ))}
                                                    </td>
                                                    <td>
                                                        <Badge bg={u.status === 'active' ? 'success' : 'secondary'} className="rounded-pill" style={{ fontSize: '0.7em' }}>
                                                            {u.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-5 text-muted">
                                                        No contacts found linked to this organization.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>
                        </Card>
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
        </AppLayout>
    );
}
