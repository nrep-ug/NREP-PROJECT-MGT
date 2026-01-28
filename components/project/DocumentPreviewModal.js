'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS } from '@/lib/appwriteClient';

export default function DocumentPreviewModal({ show, onHide, document }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [fileType, setFileType] = useState(null); // 'image' or 'pdf' or 'other'

    useEffect(() => {
        if (show && document) {
            loadPreview();
        } else {
            // Reset state when closed
            setFileUrl(null);
            setFileType(null);
            setError(null);
        }
    }, [show, document]);

    const loadPreview = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get the latest version to find the fileId
            // We assume we want to preview the latest version
            const versions = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.DOCUMENT_VERSIONS,
                [
                    Query.equal('documentId', document.$id),
                    Query.orderDesc('versionNo'),
                    Query.limit(1)
                ]
            );

            if (versions.documents.length === 0) {
                throw new Error('No file versions found for this document.');
            }

            const latestVersion = versions.documents[0];
            const mimeType = latestVersion.mimeType;

            // Determine type
            let type = 'other';
            if (mimeType.startsWith('image/')) type = 'image';
            else if (mimeType === 'application/pdf') type = 'pdf';

            setFileType(type);

            // 2. Generate URL
            // Use getFileView for previewable content
            const url = storage.getFileView(BUCKET_DOCS, latestVersion.fileId);
            setFileUrl(url.href);

        } catch (err) {
            console.error('Failed to load preview:', err);
            setError('Failed to load document preview. ' + (err.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-3 text-muted">Loading content...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="d-flex align-items-center justify-content-center h-100 p-4">
                    <Alert variant="danger">{error}</Alert>
                </div>
            );
        }

        if (!fileUrl) return null;

        if (fileType === 'image') {
            return (
                <div className="d-flex align-items-center justify-content-center h-100 bg-dark" style={{ overflow: 'auto' }}>
                    <img
                        src={fileUrl}
                        alt={document?.title}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                </div>
            );
        }

        if (fileType === 'pdf') {
            return (
                <iframe
                    src={`${fileUrl}#toolbar=0`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={document?.title}
                />
            );
        }

        return (
            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                <i className="bi bi-file-earmark-text" style={{ fontSize: '4rem', color: '#64748b' }}></i>
                <h5 className="mt-3">Preview not available</h5>
                <p className="text-muted">This file type cannot be previewed directly.</p>
                <Button
                    variant="primary"
                    onClick={() => window.open(fileUrl, '_blank')}
                >
                    <i className="bi bi-download me-2"></i>
                    Download to View
                </Button>
            </div>
        );
    };

    return (
        <Modal show={show} onHide={onHide} size="xl" centered contentClassName="h-100">
            <Modal.Header closeButton>
                <Modal.Title>{document?.title || 'Preview'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0" style={{ height: '80vh', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                {renderContent()}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Close</Button>
                {fileUrl && (
                    <Button variant="primary" onClick={() => window.open(fileUrl, '_blank')}>
                        <i className="bi bi-download me-2"></i>
                        Download
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}
