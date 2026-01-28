'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Badge } from 'react-bootstrap';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS } from '@/lib/appwriteClient';
import { formatDateTime } from '@/lib/date';

export default function DocumentHistoryModal({ show, onHide, document }) {
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState([]);
    // We might want to fetch user names if uploaderId is just an ID. 
    // For simplicity, we'll show the ID or fetch if needed. 
    // Given `ProjectDocumentsNew.js` logic, usually we might not have user names readily available for all IDs without a lookup.
    // We will assume `uploadedBy` is an ID and just show it or try to find it in a passed staff list?
    // Let's keep it simple for now and maybe just show the date and size.

    useEffect(() => {
        if (show && document) {
            loadHistory();
        } else {
            setVersions([]);
        }
    }, [show, document]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.DOCUMENT_VERSIONS,
                [
                    Query.equal('documentId', document.documentId),
                    Query.orderDesc('versionNo'), // Newest first
                    Query.limit(50)
                ]
            );

            setVersions(response.documents);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (fileId) => {
        const result = storage.getFileDownload(BUCKET_DOCS, fileId);
        const url = result.href ? result.href : result;
        window.open(url, '_blank');
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>Version History: {document?.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : versions.length === 0 ? (
                    <p className="text-center text-muted my-3">No version history found.</p>
                ) : (
                    <Table hover responsive>
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Date</th>
                                <th>Size</th>
                                <th>Uploaded By</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {versions.map((ver) => (
                                <tr key={ver.$id} className={ver.versionNo === document.currentVersion ? 'table-active' : ''}>
                                    <td>
                                        <Badge bg={ver.versionNo === document.currentVersion ? 'success' : 'secondary'} pill>
                                            v{ver.versionNo}
                                        </Badge>
                                    </td>
                                    <td>{formatDateTime(ver.uploadedAt)}</td>
                                    <td>{formatSize(ver.sizeBytes)}</td>
                                    <td className="text-muted small">
                                        {/* Ideally we map this ID to a name if possible, or just truncated ID */}
                                        {/* For now, simplified */}
                                        User {ver.uploadedBy?.substring(0, 5)}...
                                    </td>
                                    <td className="text-end">
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => handleDownload(ver.fileId)}
                                        >
                                            <i className="bi bi-download"></i>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
}
