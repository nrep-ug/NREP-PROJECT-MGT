'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Row, Col, Badge, Table, ProgressBar } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, Query } from '@/lib/appwriteClient';
import { useProjectMembers } from '@/hooks/useProjects';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/date';

export default function ComponentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { data: teamMembers = [] } = useProjectMembers(params.id);
    const [project, setProject] = useState(null);
    const [component, setComponent] = useState(null);
    const [linkedMilestones, setLinkedMilestones] = useState([]);
    const [milestoneTasks, setMilestoneTasks] = useState({}); // Map of milestoneId -> tasks
    const [loading, setLoading] = useState(true);
    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        if (user && params.id && params.componentId) {
            loadData();
        }
    }, [user, params.id, params.componentId]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. Load Project
            const projectDoc = await databases.getDocument(
                DB_ID,
                COLLECTIONS.PROJECTS,
                params.id
            );
            setProject(projectDoc);

            // 2. Load Component
            const componentDoc = await databases.getDocument(
                DB_ID,
                COLLECTIONS.PROJECT_COMPONENTS,
                params.componentId
            );
            setComponent(componentDoc);

            // 3. Load Project Milestones (then filter in memory for 'components' array)
            // Note: Appwrite 1.4+ supports array contains queries, but filtering client side for safety/compatibility
            const milestonesResponse = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.MILESTONES,
                [
                    Query.equal('projectId', params.id),
                    Query.limit(100) // Adjust limit as needed
                ]
            );

            const relatedMilestones = milestonesResponse.documents.filter(m =>
                m.components && m.components.includes(params.componentId)
            );
            setLinkedMilestones(relatedMilestones);

            // 4. Load Tasks for these milestones to calculate progress
            // Optimization: Could be done in parallel or lazy loaded
            if (relatedMilestones.length > 0) {
                const milestoneIds = relatedMilestones.map(m => m.$id);
                const tasksResponse = await databases.listDocuments(
                    DB_ID,
                    COLLECTIONS.TASKS,
                    [
                        Query.equal('milestoneId', milestoneIds),
                        Query.limit(100 * milestoneIds.length) // Rough limit
                    ]
                );

                // Group tasks by milestone
                const taskMap = {};
                tasksResponse.documents.forEach(task => {
                    if (!taskMap[task.milestoneId]) taskMap[task.milestoneId] = [];
                    taskMap[task.milestoneId].push(task);
                });
                setMilestoneTasks(taskMap);
            }

        } catch (err) {
            console.error('Failed to load component data:', err);
            showToast('Failed to load component details.', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const getLeader = () => {
        if (!component?.leaderId || !teamMembers.length) return null;
        return teamMembers.find(m => m.accountId === component.leaderId);
    };

    const getStatusColor = (status) => {
        const colors = { open: 'primary', reached: 'success', closed: 'secondary' };
        return colors[status] || 'secondary';
    };

    const getMilestoneProgress = (milestoneId) => {
        const tasks = milestoneTasks[milestoneId] || [];
        if (tasks.length === 0) return 0;
        const completed = tasks.filter(t => t.status === 'done').length;
        return Math.round((completed / tasks.length) * 100);
    };

    if (authLoading || loading) {
        return (
            <AppLayout user={user}>
                <LoadingSpinner message="Loading component details..." />
            </AppLayout>
        );
    }

    if (!project || !component) {
        return (
            <AppLayout user={user}>
                <div className="alert alert-danger">Component not found</div>
            </AppLayout>
        );
    }

    const leader = getLeader();

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            <div className="mb-4">
                <div className="d-flex align-items-center gap-3 mb-3">
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => router.push(`/projects/${project.$id}?tab=components`)}
                    >
                        <i className="bi bi-arrow-left"></i> Back
                    </Button>
                    <h2 className="mb-0">{component.name}</h2>
                </div>
                <p className="text-muted">
                    Project: <strong>{project.name}</strong> ({project.code})
                </p>
            </div>

            <Row>
                <Col md={4} className="mb-4">
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-3">
                                <div
                                    className="rounded-3 d-flex align-items-center justify-content-center me-3"
                                    style={{ width: '48px', height: '48px', backgroundColor: '#f8fafc' }}
                                >
                                    <i className="bi bi-box-seam text-primary" style={{ fontSize: '1.5rem' }}></i>
                                </div>
                                <div>
                                    <h5 className="mb-1">Details</h5>
                                    <span className="text-muted small">Component Info</span>
                                </div>
                            </div>

                            {component.description && (
                                <div className="mb-4">
                                    <h6 className="text-muted small fw-bold text-uppercase">Description</h6>
                                    <p className="text-dark">{component.description}</p>
                                </div>
                            )}

                            <div className="mb-4">
                                <h6 className="text-muted small fw-bold text-uppercase">Leader</h6>
                                {leader ? (
                                    <div className="d-flex align-items-center gap-2 p-2 rounded bg-light">
                                        <div
                                            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                                            style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}
                                        >
                                            {leader.firstName[0]}{leader.lastName[0]}
                                        </div>
                                        <div>
                                            <div className="fw-semibold">{leader.firstName} {leader.lastName}</div>
                                            <div className="small text-muted">@{leader.username}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-muted fst-italic">No leader assigned</span>
                                )}
                            </div>

                            <div>
                                <h6 className="text-muted small fw-bold text-uppercase">Metadata</h6>
                                <div className="d-flex flex-column gap-1 small text-muted">
                                    <div>Created: {formatDate(component.$createdAt)}</div>
                                    <div>Updated: {formatDate(component.$updatedAt)}</div>
                                </div>
                            </div>

                        </Card.Body>
                    </Card>
                </Col>

                <Col md={8}>
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white py-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-flag text-primary"></i>
                                <h5 className="mb-0">Linked Activity Schedules</h5>
                                <Badge bg="secondary" pill>{linkedMilestones.length}</Badge>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {linkedMilestones.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-flag display-4 opacity-25"></i>
                                    <p className="mt-2">No activity schedules linked to this component.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table hover className="mb-0 align-middle">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4">Name</th>
                                                <th>Status</th>
                                                <th>Timeline</th>
                                                <th>Progress</th>
                                                <th className="text-end pe-4">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {linkedMilestones.map(milestone => {
                                                const progress = getMilestoneProgress(milestone.$id);
                                                return (
                                                    <tr key={milestone.$id}>
                                                        <td className="ps-4 fw-medium">{milestone.name}</td>
                                                        <td>
                                                            <Badge bg={getStatusColor(milestone.status)} className="text-uppercase" style={{ fontSize: '0.7em' }}>
                                                                {milestone.status}
                                                            </Badge>
                                                        </td>
                                                        <td>
                                                            <div className="small text-muted">
                                                                {milestone.dueDate ? formatDate(milestone.dueDate) : 'No due date'}
                                                            </div>
                                                        </td>
                                                        <td style={{ width: '20%' }}>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <ProgressBar
                                                                    now={progress}
                                                                    style={{ height: '6px', flexGrow: 1 }}
                                                                    variant={progress === 100 ? 'success' : 'primary'}
                                                                />
                                                                <small className="text-muted" style={{ width: '35px' }}>{progress}%</small>
                                                            </div>
                                                        </td>
                                                        <td className="text-end pe-4">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => router.push(`/projects/${project.$id}/milestones/${milestone.$id}`)}
                                                            >
                                                                View
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </AppLayout>
    );
}
