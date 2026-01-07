'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert, Modal, InputGroup } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export const dynamic = 'force-dynamic';

function TimesheetEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Get params from URL
  const entryId = searchParams.get('entryId');
  const weekStartRaw = searchParams.get('weekStart');
  const weekEndRaw = searchParams.get('weekEnd');
  const preselectedDate = searchParams.get('date');
  const preselectedProject = searchParams.get('projectId');

  // Convert ISO dates to YYYY-MM-DD format for date input
  const weekStart = weekStartRaw ? formatDate(weekStartRaw, 'YYYY-MM-DD') : null;
  const weekEnd = weekEndRaw ? formatDate(weekEndRaw, 'YYYY-MM-DD') : null;

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]); // For validation
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [entryForm, setEntryForm] = useState({
    projectId: preselectedProject || '',
    taskId: '',
    workDate: preselectedDate || formatDate(new Date(), 'YYYY-MM-DD'),
    title: '',
    startTime: '',
    endTime: '',
    hours: '',
    notes: '',
    billable: true,
  });

  useEffect(() => {
    if (user) {
      loadProjects();
      loadWeekEntries();
      loadTemplates();
      if (entryId) {
        loadEntry();
      }
    }
  }, [user, entryId]);

  useEffect(() => {
    if (entryForm.projectId) {
      loadTasksForProject(entryForm.projectId);
    }
  }, [entryForm.projectId]);

  // Auto-calculate hours when start or end time changes
  useEffect(() => {
    if (entryForm.startTime && entryForm.endTime) {
      const start = new Date(`1970-01-01T${entryForm.startTime}`);
      const end = new Date(`1970-01-01T${entryForm.endTime}`);

      if (end > start) {
        const diffMs = end - start;
        const diffHrs = diffMs / (1000 * 60 * 60);
        // Round to 2 decimal places
        const roundedHrs = Math.round(diffHrs * 100) / 100;
        setEntryForm(prev => ({ ...prev, hours: roundedHrs.toString() }));
      }
    }
  }, [entryForm.startTime, entryForm.endTime]);

  const loadProjects = async () => {
    try {
      const response = await fetch(`/api/projects?organizationId=${user.organizationId}`);
      const data = await response.json();

      if (response.ok) {
        const activeProjects = data.projects?.filter(p => p.status === 'active') || [];
        setProjects(activeProjects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      showToast('Failed to load projects', 'danger');
    }
  };

  const loadTasksForProject = async (projectId) => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const loadWeekEntries = async () => {
    try {
      const response = await fetch(`/api/timesheets?accountId=${user.authUser.$id}&weekStart=${weekStartRaw}`);
      const data = await response.json();

      if (response.ok) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load entries:', err);
    }
  };

  const loadEntry = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/timesheets/entries/${entryId}`);
      const data = await response.json();

      if (response.ok && data.entry) {
        const workDate = formatDate(data.entry.workDate, 'YYYY-MM-DD');

        let startTime = '';
        let endTime = '';

        if (data.entry.startTime) {
          const startDate = new Date(data.entry.startTime);
          startTime = startDate.toISOString().substr(11, 5);
        }

        if (data.entry.endTime) {
          const endDate = new Date(data.entry.endTime);
          endTime = endDate.toISOString().substr(11, 5);
        }

        setEntryForm({
          projectId: data.entry.projectId,
          taskId: data.entry.taskId || '',
          workDate: workDate,
          title: data.entry.title || '',
          startTime: startTime,
          endTime: endTime,
          hours: data.entry.hours,
          notes: data.entry.notes || '',
          billable: data.entry.billable
        });
      } else {
        showToast('Failed to load entry', 'danger');
      }
    } catch (err) {
      console.error('Failed to load entry:', err);
      showToast('Failed to load entry', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(
        `/api/timesheets/templates?accountId=${user.authUser.$id}&organizationId=${user.organizationId}`
      );
      const data = await response.json();

      if (response.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const applyTemplate = (templateId) => {
    const template = templates.find(t => t.$id === templateId);
    if (!template) return;

    setEntryForm({
      ...entryForm,
      projectId: template.projectId,
      taskId: template.taskId || '',
      hours: template.hours,
      notes: template.notes || '',
      billable: template.billable,
      startTime: '', // Reset times when applying template as they are specific to day
      endTime: ''
    });

    showToast(`Template "${template.name}" applied!`, 'success');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      showToast('Please enter a template name', 'warning');
      return;
    }

    if (!entryForm.projectId || !entryForm.hours) {
      showToast('Please select a project and enter hours first', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/timesheets/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user.authUser.$id,
          organizationId: user.organizationId,
          name: templateName,
          projectId: entryForm.projectId,
          taskId: entryForm.taskId || null,
          hours: parseFloat(entryForm.hours),
          notes: entryForm.notes || null,
          billable: entryForm.billable
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      showToast('Template saved successfully!', 'success');
      setTemplateName('');
      setShowTemplateModal(false);
      loadTemplates(); // Reload templates
    } catch (err) {
      showToast(err.message || 'Failed to save template', 'danger');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!entryForm.title) {
      showToast('Please enter a Title', 'warning');
      return;
    }

    if (!entryForm.startTime || !entryForm.endTime) {
      showToast('Please enter Start and End Time', 'warning');
      return;
    }

    const hours = parseFloat(entryForm.hours);

    // Validation
    if (!hours || hours <= 0) {
      showToast('Invalid hours calculated', 'warning');
      return;
    }

    if (hours > 24) {
      showToast('Hours cannot exceed 24 per day', 'warning');
      return;
    }

    if (!entryForm.projectId) {
      showToast('Please select a project', 'warning');
      return;
    }

    // Validate Start/End time logic if provided
    if (entryForm.startTime && entryForm.endTime) {
      if (entryForm.startTime >= entryForm.endTime) {
        showToast('End time must be after start time', 'warning');
        return;
      }
    }

    // Check total hours for the day (excluding current entry if editing)
    const dailyEntries = entries.filter(e =>
      e.workDate === entryForm.workDate &&
      (!entryId || e.$id !== entryId)
    );
    const dailyTotal = dailyEntries.reduce((sum, e) => sum + e.hours, 0);

    if (dailyTotal + hours > 24) {
      showToast(
        `This would exceed 24 hours for ${formatDate(entryForm.workDate)}. Current: ${dailyTotal}h`,
        'warning'
      );
      return;
    }

    try {
      setLoading(true);

      // Construct ISO DateTimes for start/end
      let isoStartTime = null;
      let isoEndTime = null;

      if (entryForm.startTime) {
        isoStartTime = new Date(`${entryForm.workDate}T${entryForm.startTime}`).toISOString();
      }
      if (entryForm.endTime) {
        isoEndTime = new Date(`${entryForm.workDate}T${entryForm.endTime}`).toISOString();
      }

      const payload = {
        ...entryForm,
        taskId: entryForm.taskId || null,
        title: entryForm.title,
        hours,
        startTime: isoStartTime,
        endTime: isoEndTime,
        requesterId: user.authUser.$id
      };

      if (entryId) {
        // Update existing entry
        console.log('PUT /timesheets/entries/[id] payload:', payload);
        const response = await fetch(`/api/timesheets/entries/${entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update entry');
        }

        showToast('Entry updated successfully!', 'success');
      } else {
        // Create new entry
        const response = await fetch('/api/timesheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: user.authUser.$id,
            organizationId: user.organizationId,
            weekStart: weekStartRaw, // Use ISO format for API
            entries: [payload]
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add entry');
        }

        showToast('Entry added successfully!', 'success');
      }

      // Navigate back to timesheets page
      router.push('/timesheets/my');
    } catch (err) {
      showToast(err.message || 'Failed to save entry', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/timesheets/my');
  };

  if (authLoading || (entryId && loading)) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message={entryId ? 'Loading entry...' : 'Loading...'} />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center">
          <Button variant="link" onClick={handleCancel} className="p-0 me-3">
            <i className="bi bi-arrow-left fs-4"></i>
          </Button>
          <div>
            <h2 className="mb-0">{entryId ? 'Edit Time Entry' : 'Add Time Entry'}</h2>
            <p className="text-muted mb-0">
              Week of {formatDate(weekStartRaw)}
            </p>
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          {/* Template Selector */}
          {templates.length > 0 && !entryId && (
            <Alert variant="info" className="mb-4">
              <Row className="g-2">
                <Col xs={12} md={8}>
                  <Form.Label className="mb-2">
                    <i className="bi bi-lightning-charge me-2"></i>
                    Quick Start: Use a Template
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                    defaultValue=""
                  >
                    <option value="">Select a template to apply...</option>
                    {templates.map((template) => (
                      <option key={template.$id} value={template.$id}>
                        {template.name} - {template.project?.name} ({template.hours}h)
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12} md={4} className="text-md-end d-grid d-md-block">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => router.push('/timesheets/templates')}
                  >
                    Manage Templates
                  </Button>
                </Col>
              </Row>
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label>Title *</Form.Label>
              <Form.Control
                type="text"
                value={entryForm.title}
                onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                placeholder="e.g., Development, Meeting, etc."
                required
                size="lg"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Project *</Form.Label>
              <Form.Select
                value={entryForm.projectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  setEntryForm({ ...entryForm, projectId, taskId: '' });
                }}
                required
                size="lg"
              >
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.$id} value={p.$id}>
                    {p.code ? `[${p.code}] ` : ''}{p.name}
                  </option>
                ))}
              </Form.Select>
              {projects.length === 0 && (
                <Form.Text className="text-danger">
                  No active projects available. Please contact your administrator.
                </Form.Text>
              )}
            </Form.Group>

            {entryForm.projectId && (
              <Form.Group className="mb-4">
                <Form.Label>Task (Optional)</Form.Label>
                <Form.Select
                  value={entryForm.taskId}
                  onChange={(e) => setEntryForm({ ...entryForm, taskId: e.target.value })}
                  size="lg"
                >
                  <option value="">No specific task</option>
                  {tasks.map((t) => (
                    <option key={t.$id} value={t.$id}>
                      {t.title} {t.status && `(${t.status})`}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Link this time to a specific task (optional)
                </Form.Text>
              </Form.Group>
            )}

            <Row className="g-3">
              <Col xs={12} md={4}>
                <Form.Group className="mb-4">
                  <Form.Label>Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={entryForm.workDate}
                    onChange={(e) => setEntryForm({ ...entryForm, workDate: e.target.value })}
                    min={weekStart}
                    max={weekEnd}
                    required
                    size="lg"
                  />
                  <Form.Text className="text-muted d-block">
                    Within week ({formatDate(weekStartRaw)} - {formatDate(weekEndRaw)})
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group className="mb-4">
                  <Form.Label>Start Time *</Form.Label>
                  <Form.Control
                    type="time"
                    value={entryForm.startTime}
                    onChange={(e) => setEntryForm({ ...entryForm, startTime: e.target.value })}
                    size="lg"
                    required
                  />
                </Form.Group>
              </Col>
              <Col xs={12} md={4}>
                <Form.Group className="mb-4">
                  <Form.Label>End Time *</Form.Label>
                  <Form.Control
                    type="time"
                    value={entryForm.endTime}
                    onChange={(e) => setEntryForm({ ...entryForm, endTime: e.target.value })}
                    size="lg"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Total Hours</Form.Label>
              <Form.Control
                type="number"
                value={entryForm.hours}
                readOnly
                className="bg-light"
                placeholder="0.0"
                size="lg"
              />
              <Form.Text className="text-muted">
                Auto-calculated from Start/End time.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={entryForm.notes}
                onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                placeholder="Describe what you worked on..."
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                label="Billable"
                checked={entryForm.billable}
                onChange={(e) => setEntryForm({ ...entryForm, billable: e.target.checked })}
              />
              <Form.Text className="text-muted">
                Check if this time should be billed to the client
              </Form.Text>
            </Form.Group>

            {/* Action Buttons */}
            <div className="d-flex flex-column flex-md-row gap-2 justify-content-between mt-4 pt-3 border-top">
              <div className="d-grid d-md-block">
                {!entryId && entryForm.projectId && entryForm.hours && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShowTemplateModal(true)}
                    disabled={loading}
                  >
                    <i className="bi bi-bookmark-plus me-2"></i>
                    Save as Template
                  </Button>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-fill flex-md-grow-0"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="flex-fill flex-md-grow-0"
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    entryId ? 'Update Entry' : 'Add Entry'
                  )}
                </Button>
              </div>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Save Template Modal */}
      <Modal show={showTemplateModal} onHide={() => setShowTemplateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Save as Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Save this entry configuration as a reusable template for quick time entry in the future.
          </p>
          <Form.Group>
            <Form.Label>Template Name *</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Daily standup, Code review, etc."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              autoFocus
            />
          </Form.Group>
          <div className="mt-3 p-2 bg-light rounded">
            <small className="text-muted">
              <strong>Template will save:</strong>
              <ul className="mb-0 mt-2">
                <li>Project: {projects.find(p => p.$id === entryForm.projectId)?.name}</li>
                <li>Hours: {entryForm.hours}</li>
                <li>Billable: {entryForm.billable ? 'Yes' : 'No'}</li>
                {entryForm.notes && <li>Notes: {entryForm.notes}</li>}
              </ul>
            </small>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTemplateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
            <i className="bi bi-bookmark-plus me-2"></i>
            Save Template
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}

export default function TimesheetEntryPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TimesheetEntryContent />
    </Suspense>
  );
}
