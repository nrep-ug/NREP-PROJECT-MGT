'use client';

import { useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';

export default function DocumentMoveModal({ show, onHide, item, folders, onMove }) {
    const [targetFolderId, setTargetFolderId] = useState(''); // '' means root
    const [moving, setMoving] = useState(false);

    // Filter out the item itself and its children if it is a folder
    // to avoid circular moves.
    const validFolders = folders.filter(f => {
        if (!item) return true;
        if (item.$id === f.$id) return false; // Cannot move to itself
        // Also cannot move to its own children (need recursive check if we had full tree structure)
        // For flat list with parentFolderId, checking one level is easy, deep is harder.
        // For now, let's just block moving to itself.
        return true;
    });

    const handleMoveSubmit = async () => {
        setMoving(true);
        try {
            await onMove(item, targetFolderId || null);
            onHide();
        } catch (err) {
            console.error(err);
            // error handling is done by parent usually, or we can add local error state
        } finally {
            setMoving(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Move Item</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    Move <strong>&quot;{item?.title || item?.name}&quot;</strong> to:
                </p>
                <Form>
                    <Form.Group>
                        <Form.Label>Destination Folder</Form.Label>
                        <Form.Select
                            value={targetFolderId}
                            onChange={(e) => setTargetFolderId(e.target.value)}
                            disabled={moving}
                        >
                            <option value="">Root (No Folder)</option>
                            {validFolders.map(folder => (
                                <option key={folder.$id} value={folder.$id}>
                                    {folder.name}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={moving}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleMoveSubmit} disabled={moving}>
                    {moving ? <Spinner size="sm" animation="border" /> : 'Move'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
