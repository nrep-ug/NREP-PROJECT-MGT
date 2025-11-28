'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonGroup, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours, getWeekStart, getWeekEnd } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import TimesheetHeader from '@/components/timesheets/TimesheetHeader';
import TimesheetSummary from '@/components/timesheets/TimesheetSummary';
import TimesheetEntryList from '@/components/timesheets/TimesheetEntryList';
import WeeklyGridView from '@/components/timesheets/WeeklyGridView';
import DayEntriesModal from '@/components/timesheets/DayEntriesModal';

export default function TimesheetsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const weekEnd = getWeekEnd(weekStart);
  const canEdit = !timesheet || timesheet.status === 'draft' || timesheet.status === 'rejected';

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTimesheetData();
    }
  }, [user, weekStart]);

  const loadProjects = async () => {
    try {
      const response = await fetch(`/api/projects?organizationId=${user.organizationId}`);
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects?.filter(p => p.status === 'active') || []);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadTimesheetData = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/timesheets?accountId=${user.authUser.$id}&weekStart=${weekStart}`);
      const data = await response.json();

      if (response.ok && data.timesheet) {
        setTimesheet(data.timesheet);
        setEntries(data.entries || []);
      } else {
        setTimesheet(null);
        setEntries([]);
      }
    } catch (err) {
      console.error('Failed to load timesheet:', err);
      showToast('Failed to load timesheet data', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setWeekStart(getWeekStart(newWeekStart));
  };

  const handleNextWeek = () => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setWeekStart(getWeekStart(newWeekStart));
  };

  const handleCellClick = (date, project) => {
    setSelectedDate(date);
    setSelectedProject(project);
    setShowDayModal(true);
  };

  const handleAddEntry = (date = null, projectId = null) => {
    const params = new URLSearchParams({
      weekStart,
      weekEnd,
    });

    if (date) {
      params.append('date', formatDate(date, 'YYYY-MM-DD'));
    }

    if (projectId) {
      params.append('projectId', projectId);
    }

    router.push(`/timesheets/entry?${params.toString()}`);
  };

  const handleEditEntry = (entry) => {
    const params = new URLSearchParams({
      entryId: entry.$id,
      weekStart,
      weekEnd,
    });

    router.push(`/timesheets/entry?${params.toString()}`);
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm(`Delete this ${formatHours(entry.hours)} time entry?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/timesheets/entries/${entry.$id}?requesterId=${user.authUser.$id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete entry');
      }

      showToast('Entry deleted successfully!', 'success');
      loadTimesheetData();
    } catch (err) {
      showToast(err.message || 'Failed to delete entry', 'danger');
    }
  };

  const handleSubmit = async () => {
    if (!timesheet || entries.length === 0) {
      showToast('Cannot submit an empty timesheet', 'warning');
      return;
    }

    const confirmMessage = timesheet.status === 'rejected'
      ? 'Resubmit this timesheet for approval? Previous rejection comments will be cleared.'
      : 'Submit this timesheet for approval?';

    if (!confirm(confirmMessage)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/timesheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.$id,
          action: 'submit'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit timesheet');
      }

      const successMessage = timesheet.status === 'rejected'
        ? 'Timesheet resubmitted for approval!'
        : 'Timesheet submitted for approval!';

      showToast(successMessage, 'success');
      loadTimesheetData();
    } catch (err) {
      showToast(err.message || 'Failed to submit timesheet', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsubmit = async () => {
    if (!confirm('Unsubmit this timesheet? You will be able to make changes again.')) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/timesheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: timesheet.$id,
          action: 'unsubmit'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unsubmit timesheet');
      }

      showToast('Timesheet unsubmitted. You can now edit it.', 'success');
      loadTimesheetData();
    } catch (err) {
      showToast(err.message || 'Failed to unsubmit timesheet', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading timesheets..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header with week navigation and submit button */}
      <TimesheetHeader
        timesheet={timesheet}
        weekStart={weekStart}
        weekEnd={weekEnd}
        canEdit={canEdit}
        onPreviousWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onSubmit={handleSubmit}
        onUnsubmit={handleUnsubmit}
        submitting={submitting}
      />

      {/* Summary Cards */}
      <TimesheetSummary entries={entries} />

      {/* View Toggle and Action Buttons */}
      <div className="mb-3 d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-2">
        <ButtonGroup size="sm">
          <Button
            variant={viewMode === 'list' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('list')}
          >
            <i className="bi bi-list-ul me-2"></i>
            <span className="d-none d-sm-inline">List View</span>
            <span className="d-inline d-sm-none">List</span>
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('calendar')}
          >
            <i className="bi bi-calendar-week me-2"></i>
            <span className="d-none d-sm-inline">Calendar View</span>
            <span className="d-inline d-sm-none">Calendar</span>
          </Button>
        </ButtonGroup>

        <div className="d-flex gap-2">
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleAddEntry()}>
              <i className="bi bi-plus-circle me-2"></i>
              <span className="d-none d-sm-inline">Add Entry</span>
              <span className="d-inline d-sm-none">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Entry Views */}
      {viewMode === 'list' ? (
        <TimesheetEntryList
          entries={entries}
          projects={projects}
          canEdit={canEdit}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
        />
      ) : (
        <WeeklyGridView
          entries={entries}
          projects={projects}
          weekStart={weekStart}
          canEdit={canEdit}
          onCellClick={handleCellClick}
        />
      )}

      {/* Day Entries Modal */}
      <DayEntriesModal
        show={showDayModal}
        onHide={() => setShowDayModal(false)}
        date={selectedDate}
        project={selectedProject}
        entries={entries}
        canEdit={canEdit}
        onEditEntry={handleEditEntry}
        onAddEntry={handleAddEntry}
      />
    </AppLayout>
  );
}
