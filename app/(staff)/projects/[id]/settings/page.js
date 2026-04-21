'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useProject } from '@/hooks/useProjects';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function ProjectSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { data: project, isLoading: projectLoading } = useProject(params.id);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    if (authLoading || projectLoading) {
        return (
            <AppLayout user={user}>
                <LoadingSpinner message="Loading..." />
            </AppLayout>
        );
    }

    if (!project) {
        return (
            <AppLayout user={user}>
                <Alert variant="danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Project not found
                </Alert>
            </AppLayout>
        );
    }

    // Must be admin to view settings (specifically destructive actions)
    if (!user?.isAdmin) {
        return (
            <AppLayout user={user}>
                <Alert variant="danger">
                    <i className="bi bi-shield-lock me-2"></i>
                    <strong>Access Denied.</strong> Only administrators can access project settings.
                </Alert>
                <Button
                    variant="link"
                    onClick={() => router.push(`/projects/${project.$id}`)}
                    className="p-0 text-decoration-none"
                    style={{ color: '#054653', fontWeight: '500' }}
                >
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Project
                </Button>
            </AppLayout>
        );
    }

    const handleDelete = async (e) => {
        e.preventDefault();

        if (deleteConfirmCode !== project.code) {
            showToast('Project code does not match. Deletion aborted.', 'warning');
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(`/api/projects/${project.$id}?requesterId=${user.authUser.$id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete project');
            }

            setShowDeleteModal(false);
            showToast('Project and all associated data permanently deleted.', 'success');

            // Give the toast time to render before full redirect
            setTimeout(() => {
                router.push('/projects');
            }, 1500);

        } catch (err) {
            console.error('Failed to delete project:', err);
            showToast(err.message || 'Failed to delete project', 'danger');
            setSubmitting(false);
        }
    };

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            <div className="mb-4">
                <Button
                    variant="link"
                    onClick={() => router.push(`/projects/${project.$id}`)}
                    className="p-0 mb-3 text-decoration-none"
                    style={{ color: '#054653', fontWeight: '500' }}
                >
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Project
                </Button>

                {/* Hero Header Card */}
                <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' }}>
                    <Card.Body className="text-white p-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                                <div
                                    className="rounded-circle d-flex align-items-center justify-content-center me-3"
                                    style={{
                                        width: '56px',
                                        height: '56px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    <i className="bi bi-gear-fill" style={{ fontSize: '1.75rem' }}></i>
                                </div>
                                <div>
                                    <h2 className="mb-1 fw-bold">Project Settings</h2>
                                    <p className="mb-0 opacity-90">
                                        Advanced Configuration for <strong>{project.code}</strong> — {project.name}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card.Body>
                </Card>

                {/* Danger Zone */}
                <Card className="border border-danger shadow-sm rounded-4">
                    <Card.Header className="bg-danger text-white py-3 border-bottom-0 rounded-top-4">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <h5 className="mb-0 fw-bold">Danger Zone</h5>
                        </div>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="fw-bold mb-1" style={{ color: '#0f172a' }}>Delete this project</h6>
                                <p className="mb-0 text-muted" style={{ maxWidth: '600px', fontSize: '0.95rem' }}>
                                    Once you delete a project, there is no going back. This will permanently delete the project, team, activity schedules, tasks, and documents. Timesheet entries will be marked as disconnected. Please be certain.
                                </p>
                            </div>
                            <Button
                                variant="outline-danger"
                                className="fw-semibold px-4 py-2 flex-shrink-0 ms-4"
                                onClick={() => setShowDeleteModal(true)}
                                style={{
                                    borderWidth: '2px',
                                    borderRadius: '8px'
                                }}
                            >
                                <i className="bi bi-trash me-2"></i>
                                Delete Project
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </div>

            {/* Deletion Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => !submitting && setShowDeleteModal(false)} backdrop="static" centered>
                <Modal.Header className="border-bottom-0 pt-4 px-4 pb-0">
                    <Modal.Title className="text-danger fw-bold w-100 text-center">
                        <div className="mx-auto mb-3 rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: '2rem' }}></i>
                        </div>
                        Permanent Deletion
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleDelete}>
                    <Modal.Body className="px-4 py-4 text-center">
                        <p className="mb-4" style={{ fontSize: '1.05rem', color: '#334155' }}>
                            This action <strong>CANNOT</strong> be undone. This will permanently delete the <strong>{project.name}</strong> project, its tasks, schedules, components, documents, and related team.
                        </p>
                        
                        <div className="bg-light p-3 rounded-3 mb-4 text-start">
                            <Form.Label className="small fw-semibold text-muted d-block mb-2 text-center">
                                Please type <span className="fw-bold text-danger user-select-all">{project.code}</span> to confirm.
                            </Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={project.code}
                                value={deleteConfirmCode}
                                onChange={(e) => setDeleteConfirmCode(e.target.value)}
                                className="border-secondary text-center fw-bold"
                                disabled={submitting}
                                style={{ padding: '0.75rem' }}
                                required
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="border-top-0 px-4 pb-4 pt-0 justify-content-center gap-2">
                        <Button
                            variant="light"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={submitting}
                            className="px-4 py-2 border w-100"
                            style={{ borderRadius: '8px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            type="submit"
                            disabled={submitting || deleteConfirmCode !== project.code}
                            className="px-4 py-2 fw-semibold w-100"
                            style={{ borderRadius: '8px' }}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Deleting...
                                </>
                            ) : (
                                'I understand the consequences, delete this project'
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </AppLayout>
    );
}
