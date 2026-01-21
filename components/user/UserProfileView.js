'use client';

import { Card, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import { useState, useEffect } from 'react';

/**
 * Reusable User Profile View Component
 * Displays detailed information about a user (Staff or Client)
 * 
 * @param {Object} props
 * @param {Object} props.user - The user object to display (from pms_users collection)
 * @param {boolean} props.showAdminControls - Whether to show admin-specific controls (edit button, etc.)
 */
export default function UserProfileView({ user, showAdminControls = false }) {
    const [clientOrgs, setClientOrgs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loadingExtras, setLoadingExtras] = useState(false);

    // Load extra details for client users (names of orgs/projects) if only IDs are present
    // Note: user object might already have them expanded if fetched via certain APIs,
    // but usually pms_users stores IDs.
    useEffect(() => {
        if (user && user.userType === 'client' && (user.clientOrganizationIds?.length > 0 || user.projectIds?.length > 0)) {
            loadClientExtras();
        }
    }, [user]);

    const loadClientExtras = async () => {
        setLoadingExtras(true);
        try {
            // We need to fetch the names for the IDs.
            // Assuming we can use the generic generic public API or we might need a specific one.
            // For now, let's assume we can fetch project details via the projects API (filtered)
            // and client orgs via clients API.

            // Fetch Client Orgs
            // Using Promise.allSettled to handle potential failures gracefully
            const orgsPromise = user.clientOrganizationIds?.length > 0
                ? Promise.all(user.clientOrganizationIds.map(id => fetch(`/api/clients/${id}`).then(r => r.json()).catch(() => null)))
                : Promise.resolve([]);

            // Fetch Projects
            // Note: Individual project fetch endpoint might be needed if /api/projects is list-only
            // Assuming we can fetch project by ID: /api/projects/[id] (Wait, do we have that? Yes, usually)
            // Or filter list by IDs. Let's try individual fetch for now.
            const projectsPromise = user.projectIds?.length > 0
                ? Promise.all(user.projectIds.map(id => fetch(`/api/projects?id=${id}`).then(r => r.json()).then(d => d.projects?.[0]).catch(() => null)))
                : Promise.resolve([]);
            // Note: api/projects?id=... is not standard list filter usually. 
            // Often list is ?search=... or similar. 
            // Actually, let's use the `/api/projects/[id]` endpoint if it exists. 
            // Checking previous files... `api/projects/[id]/route.js` exists.
            // So:
            const projectsPromiseFixed = user.projectIds?.length > 0
                ? Promise.all(user.projectIds.map(id => fetch(`/api/projects/${id}`).then(r => r.json()).then(d => d.project).catch(() => null)))
                : Promise.resolve([]);

            const [orgsResults, projectsResults] = await Promise.all([orgsPromise, projectsPromiseFixed]);

            setClientOrgs(orgsResults.filter(o => o && o.client).map(o => o.client)); // API returns { client: ... }
            setProjects(projectsResults.filter(p => p));

        } catch (e) {
            console.error("Failed to load profile extras", e);
        } finally {
            setLoadingExtras(false);
        }
    };


    if (!user) {
        return <div className="text-center py-5 text-muted">User profile not available</div>;
    }

    const getStatusBadge = (status) => {
        const variants = {
            active: 'success',
            inactive: 'secondary',
            invited: 'warning',
            suspended: 'danger'
        };
        return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
    };

    const getUserTypeBadge = (type) => {
        return <Badge bg={type === 'client' ? 'info' : 'primary'}>{type}</Badge>;
    };

    return (
        <div className="user-profile-view">
            {/* Header Card */}
            <Card className="border-0 shadow-sm mb-4 bg-white">
                <Card.Body className="p-4">
                    <Row className="align-items-center">
                        <Col md={2} className="text-center">
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center mx-auto shadow-sm"
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                                    color: 'white',
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                        </Col>
                        <Col md={10}>
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <h2 className="mb-1 fw-bold">{user.firstName} {user.lastName}</h2>
                                    <div className="text-muted mb-2">@{user.username}</div>
                                    <div className="d-flex gap-2">
                                        {getStatusBadge(user.status)}
                                        {getUserTypeBadge(user.userType)}
                                        {user.isAdmin && <Badge bg="danger">Admin</Badge>}
                                    </div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Row className="g-4">
                {/* Left Column: Contact & Personal Info */}
                <Col md={4}>
                    <Card className="border-0 shadow-sm mb-4 h-100">
                        <Card.Header className="bg-white py-3 border-bottom">
                            <h5 className="mb-0 fw-bold">Contact Info</h5>
                        </Card.Header>
                        <Card.Body>
                            <ListGroup variant="flush">
                                <ListGroup.Item className="px-0 py-3 border-bottom">
                                    <i className="bi bi-envelope text-primary me-2"></i>
                                    <span className="text-muted small d-block mb-1">Email Address</span>
                                    <span className="fw-medium">{user.email}</span>
                                </ListGroup.Item>
                                <ListGroup.Item className="px-0 py-3 border-bottom">
                                    <i className="bi bi-person-badge text-primary me-2"></i>
                                    <span className="text-muted small d-block mb-1">Job Title</span>
                                    <span className="fw-medium">{user.title || 'Not Specified'}</span>
                                </ListGroup.Item>
                                {user.userType === 'staff' && (
                                    <ListGroup.Item className="px-0 py-3">
                                        <i className="bi bi-building text-primary me-2"></i>
                                        <span className="text-muted small d-block mb-1">Department</span>
                                        <span className="fw-medium">{user.department || 'General'}</span>
                                    </ListGroup.Item>
                                )}
                            </ListGroup>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Right Column: Role Specific Details */}
                <Col md={8}>
                    {user.userType === 'staff' ? (
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Header className="bg-white py-3 border-bottom">
                                <h5 className="mb-0 fw-bold">System Privileges</h5>
                            </Card.Header>
                            <Card.Body>
                                <Row className="g-3">
                                    <Col md={6}>
                                        <div className="p-3 bg-light rounded border">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-shield-check text-primary fs-4 me-2"></i>
                                                <span className="fw-bold">Role Access</span>
                                            </div>
                                            <div>
                                                {user.role?.map(r => (
                                                    <Badge key={r} bg="secondary" className="me-1 text-capitalize">{r}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="p-3 bg-light rounded border">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-person-check text-success fs-4 me-2"></i>
                                                <span className="fw-bold">Supervisor Status</span>
                                            </div>
                                            <div>
                                                {user.isSupervisor ? (
                                                    <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Is a Supervisor</span>
                                                ) : (
                                                    <span className="text-muted">Not a Supervisor</span>
                                                )}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>

                                {user.supervisorId && (
                                    <div className="mt-4 pt-3 border-top">
                                        <h6 className="text-muted small text-uppercase fw-bold mb-3">Report To</h6>
                                        <div className="d-flex align-items-center">
                                            <div className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3 border" style={{ width: '40px', height: '40px' }}>
                                                <i className="bi bi-person text-secondary"></i>
                                            </div>
                                            <div>
                                                <div className="fw-bold">Supervisor Assigned</div>
                                                <div className="text-muted small">ID: {user.supervisorId}</div>
                                                {/* Ideally we would fetch supervisor name, but keeping it simple for now */}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    ) : (
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Header className="bg-white py-3 border-bottom">
                                <h5 className="mb-0 fw-bold">Client Access Scope</h5>
                            </Card.Header>
                            <Card.Body>
                                <div className="mb-4">
                                    <h6 className="text-muted small text-uppercase fw-bold mb-3">Linked Organizations</h6>
                                    {clientOrgs.length > 0 ? (
                                        <Row className="g-2">
                                            {clientOrgs.map(org => (
                                                <Col key={org.$id} md={6}>
                                                    <div className="p-3 border rounded d-flex align-items-center bg-light">
                                                        <i className="bi bi-building text-secondary fs-4 me-3"></i>
                                                        <div>
                                                            <div className="fw-bold">{org.name}</div>
                                                            <div className="small text-muted">{org.code || 'No Code'}</div>
                                                        </div>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    ) : (
                                        <p className="text-muted small fst-italic">No organizations linked yet (or loading...)</p>
                                    )}
                                </div>

                                <div>
                                    <h6 className="text-muted small text-uppercase fw-bold mb-3">Linked Projects</h6>
                                    {projects.length > 0 ? (
                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Project Name</th>
                                                        <th>Code</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {projects.map(p => (
                                                        <tr key={p.$id}>
                                                            <td>{p.name}</td>
                                                            <td>{p.code}</td>
                                                            <td><Badge bg="light" text="dark" className="border">{p.status}</Badge></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-muted small fst-italic">No projects linked yet (or loading...)</p>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>
        </div>
    );
}
