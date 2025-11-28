'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Alert, Spinner, Badge, Modal, Form, ListGroup, Tabs, Tab, Accordion, ProgressBar } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function SystemSetupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [systemState, setSystemState] = useState({
    isInitialized: false,
    collectionsExist: false,
    teamsExist: false,
    checking: true,
  });

  const [operations, setOperations] = useState({
    setupCollections: { loading: false, completed: false },
    bootstrapTeams: { loading: false, completed: false },
  });

  const [collectionDetails, setCollectionDetails] = useState([]);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [expandedCollections, setExpandedCollections] = useState([]);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  const [showCollectionsModal, setShowCollectionsModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user?.isAdmin) {
      checkSystemState();
      fetchCollectionDetails();
    }
  }, [user]);

  // Check if system has been initialized
  const checkSystemState = async () => {
    try {
      setSystemState(prev => ({ ...prev, checking: true }));

      // Check collections status
      const collectionsResponse = await fetch('/api/admin/check-collections');
      const collectionsData = await collectionsResponse.json();

      // Check teams status
      const teamsResponse = await fetch('/api/admin/check-teams');
      const teamsData = await teamsResponse.json();

      const isInitialized = collectionsData.exist && teamsData.exist;

      setSystemState({
        isInitialized,
        collectionsExist: collectionsData.exist,
        teamsExist: teamsData.exist,
        checking: false,
      });
    } catch (err) {
      console.error('Failed to check system state:', err);
      showToast('Failed to check system state', 'danger');
      setSystemState(prev => ({ ...prev, checking: false }));
    }
  };

  // Fetch detailed collection status
  const fetchCollectionDetails = async () => {
    try {
      const response = await fetch('/api/admin/setup-collections');
      if (response.ok) {
        const data = await response.json();
        setCollectionDetails(data.collections || []);
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch collection details:', err);
    }
    return null;
  };

  // Confirm and setup database collections
  const confirmSetupCollections = () => {
    setShowCollectionsModal(true);
  };

  // Setup database collections
  const setupCollections = async () => {
    setShowCollectionsModal(false);
    setOperations(prev => ({
      ...prev,
      setupCollections: { loading: true, completed: false }
    }));

    try {
      const response = await fetch('/api/admin/setup-collections', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to setup collections');
      }

      const result = await response.json();

      // Save detailed results
      if (result.collections) {
        setCollectionDetails(result.collections);
      }

      setOperations(prev => ({
        ...prev,
        setupCollections: { loading: false, completed: true }
      }));

      const message = result.summary
        ? `✓ Setup completed! Created: ${result.summary.created} collections, ${result.summary.createdAttributes} attributes, ${result.summary.createdIndexes} indexes`
        : 'Database collections setup successfully!';

      showToast(message, result.success ? 'success' : 'warning');

      // Refresh system state
      setTimeout(() => {
        checkSystemState();
        fetchCollectionDetails();
      }, 1000);
    } catch (err) {
      setOperations(prev => ({
        ...prev,
        setupCollections: { loading: false, completed: false }
      }));
      showToast(err.message || 'Failed to setup collections', 'danger');
    }
  };

  // Confirm and bootstrap teams
  const confirmBootstrapTeams = () => {
    if (!user?.organizationId) {
      showToast('Organization ID not found', 'danger');
      return;
    }
    setShowTeamsModal(true);
  };

  // Bootstrap teams
  const bootstrapTeams = async () => {
    setShowTeamsModal(false);

    if (!user?.organizationId) {
      showToast('Organization ID not found', 'danger');
      return;
    }

    setOperations(prev => ({
      ...prev,
      bootstrapTeams: { loading: true, completed: false }
    }));

    try {
      const response = await fetch('/api/admin/bootstrap-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: user.organizationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to bootstrap teams');
      }

      const result = await response.json();

      setOperations(prev => ({
        ...prev,
        bootstrapTeams: { loading: false, completed: true }
      }));

      showToast('Teams bootstrapped successfully!', 'success');

      // Refresh system state
      setTimeout(() => checkSystemState(), 1000);
    } catch (err) {
      setOperations(prev => ({
        ...prev,
        bootstrapTeams: { loading: false, completed: false }
      }));
      showToast(err.message || 'Failed to bootstrap teams', 'danger');
    }
  };

  // Handle system reset
  const handleReset = async () => {
    if (resetConfirmation !== 'RESET SYSTEM') {
      showToast('Please type "RESET SYSTEM" to confirm', 'warning');
      return;
    }

    setResetting(true);

    try {
      await setupCollections();
      await bootstrapTeams();

      setShowResetModal(false);
      setResetConfirmation('');
      showToast('System has been reset and re-initialized', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to reset system', 'danger');
    } finally {
      setResetting(false);
    }
  };

  // Toggle collection expansion
  const toggleCollectionExpansion = (collectionId) => {
    setExpandedCollections(prev =>
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  // Check if user is admin
  if (!loading && user && !user.isAdmin) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <Alert.Heading>Access Denied</Alert.Heading>
          <p>You do not have permission to access system setup. Only administrators can access this page.</p>
        </Alert>
      </AppLayout>
    );
  }

  // Show loading state
  if (loading || systemState.checking) {
    return (
      <AppLayout user={user}>
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading system state...</p>
        </div>
      </AppLayout>
    );
  }

  // Calculate collection statistics
  const existingCollections = collectionDetails.filter(c => c.exists || c.status === 'exists').length;
  const totalCollections = collectionDetails.length;
  const setupProgress = totalCollections > 0 ? (existingCollections / totalCollections) * 100 : 0;

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <Button
          variant="link"
          onClick={() => router.push('/admin')}
          className="p-0 mb-3 text-decoration-none"
          style={{ color: '#054653', fontWeight: '500' }}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to Admin Dashboard
        </Button>

        {/* Hero Header Card */}
        <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)' }}>
          <Card.Body className="text-white p-4">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-2 fw-bold">
                  <i className="bi bi-gear-fill me-3"></i>
                  System Setup
                </h2>
                <p className="mb-0 opacity-90">
                  Initialize and configure your project management system
                </p>
              </div>
              <Button
                size="sm"
                variant="light"
                onClick={() => {
                  checkSystemState();
                  fetchCollectionDetails();
                }}
                disabled={systemState.checking}
                style={{ fontWeight: '500' }}
              >
                {systemState.checking ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-1" />
                    Checking...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh Status
                  </>
                )}
              </Button>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* System Status Hero */}
      <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)' }}>
        <Card.Body className="text-white p-4">
          <div className="row align-items-center">
            <div className="col-md-9">
              <h4 className="mb-4 fw-bold">
                <i className="bi bi-speedometer2 me-2"></i>
                System Status
              </h4>
              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="small opacity-75 mb-2">Overall Status</div>
                    <h5 className="mb-0 fw-bold d-flex align-items-center">
                      {systemState.isInitialized ? (
                        <>
                          <i className="bi bi-check-circle-fill me-2"></i>
                          Initialized
                        </>
                      ) : (
                        <>
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          Not Ready
                        </>
                      )}
                    </h5>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="small opacity-75 mb-2">Collections</div>
                    <h5 className="mb-0 fw-bold">
                      <i className="bi bi-database me-2"></i>
                      {existingCollections}/{totalCollections}
                    </h5>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="small opacity-75 mb-2">Teams</div>
                    <h5 className="mb-0 fw-bold">
                      {systemState.teamsExist ? (
                        <>
                          <i className="bi bi-check-circle-fill me-2"></i>
                          Ready
                        </>
                      ) : (
                        <>
                          <i className="bi bi-dash-circle-fill me-2"></i>
                          Pending
                        </>
                      )}
                    </h5>
                  </div>
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small fw-semibold">Setup Progress</span>
                  <span className="small fw-bold">{Math.round(setupProgress)}%</span>
                </div>
                <ProgressBar
                  now={setupProgress}
                  variant={setupProgress === 100 ? 'success' : 'warning'}
                  style={{
                    height: '10px',
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    borderRadius: '5px'
                  }}
                />
              </div>
            </div>
            <div className="col-md-3 text-center">
              <div style={{ fontSize: '6rem', opacity: 0.2 }}>
                <i className="bi bi-gear-wide-connected"></i>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Warning for Initialized Systems */}
      {systemState.isInitialized && (
        <Alert
          variant="warning"
          className="border-0 shadow-sm mb-4"
          style={{ borderLeft: '4px solid #ffc107' }}
        >
          <div className="d-flex align-items-start">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
              }}
            >
              <i className="bi bi-exclamation-triangle-fill text-white" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <div className="flex-grow-1">
              <h6 className="mb-2 fw-bold">System Already Initialized</h6>
              <p className="mb-3 small" style={{ lineHeight: '1.6' }}>
                Your system is fully configured. Re-running setup operations will reset configurations and may affect existing data.
              </p>
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => setShowResetModal(true)}
                style={{ fontWeight: '500', borderRadius: '6px' }}
              >
                <i className="bi bi-exclamation-octagon me-1"></i>
                Advanced: Reset System
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
        style={{
          borderBottom: '2px solid #e9ecef'
        }}
      >
        {/* Overview Tab */}
        <Tab
          eventKey="overview"
          title={
            <>
              <i className="bi bi-grid-3x3-gap me-2"></i>
              Overview
            </>
          }
        >
          <div className="row g-4 mt-1">
            {/* Database Collections Card */}
            <div className="col-lg-6">
              <Card
                className="border-0 shadow-sm h-100 position-relative overflow-hidden"
                style={{
                  transition: 'all 0.3s ease',
                  borderLeft: '4px solid #054653'
                }}
              >
                <div
                  className="position-absolute top-0 end-0"
                  style={{ fontSize: '8rem', marginTop: '-2rem', marginRight: '-2rem', opacity: '0.03' }}
                >
                  <i className="bi bi-database-fill"></i>
                </div>
                <Card.Body className="p-4 position-relative">
                  <div className="d-flex align-items-start mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                        boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <i className="bi bi-database-fill text-white" style={{ fontSize: '1.75rem' }}></i>
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="mb-1 fw-semibold">Database Collections</h5>
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg="primary" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                          {existingCollections}/{totalCollections}
                        </Badge>
                        {operations.setupCollections.completed && (
                          <Badge bg="success" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                            <i className="bi bi-check-circle me-1"></i>
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted small mb-4" style={{ lineHeight: '1.6' }}>
                    Creates all required database collections with schemas, attributes, and indexes for the project management system.
                  </p>

                  <div className="d-grid gap-2">
                    <Button
                      variant={systemState.collectionsExist ? 'outline-primary' : 'primary'}
                      onClick={confirmSetupCollections}
                      disabled={operations.setupCollections.loading}
                      style={{
                        fontWeight: '500',
                        borderRadius: '6px',
                        boxShadow: !systemState.collectionsExist ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none'
                      }}
                    >
                      {operations.setupCollections.loading ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Setting up collections...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-circle me-2"></i>
                          {systemState.collectionsExist ? 'Re-run Setup' : 'Setup Collections'}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setActiveTab('collections')}
                      style={{ fontWeight: '500', borderRadius: '6px' }}
                    >
                      <i className="bi bi-list-check me-2"></i>
                      View Detailed Status
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </div>

            {/* Teams Bootstrap Card */}
            <div className="col-lg-6">
              <Card
                className="border-0 shadow-sm h-100 position-relative overflow-hidden"
                style={{
                  transition: 'all 0.3s ease',
                  borderLeft: '4px solid #14B8A6'
                }}
              >
                <div
                  className="position-absolute top-0 end-0"
                  style={{ fontSize: '8rem', marginTop: '-2rem', marginRight: '-2rem', opacity: '0.03' }}
                >
                  <i className="bi bi-people-fill"></i>
                </div>
                <Card.Body className="p-4 position-relative">
                  <div className="d-flex align-items-start mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                        boxShadow: '0 4px 15px rgba(20, 184, 166, 0.3)'
                      }}
                    >
                      <i className="bi bi-people-fill text-white" style={{ fontSize: '1.75rem' }}></i>
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="mb-1 fw-semibold">Team Structure</h5>
                      <div className="d-flex align-items-center gap-2">
                        <Badge
                          bg={systemState.teamsExist ? 'success' : 'secondary'}
                          style={{ fontSize: '0.75rem', fontWeight: '500' }}
                        >
                          {systemState.teamsExist ? (
                            <>
                              <i className="bi bi-check-circle me-1"></i>
                              Configured
                            </>
                          ) : (
                            <>
                              <i className="bi bi-dash-circle me-1"></i>
                              Not Configured
                            </>
                          )}
                        </Badge>
                        {operations.bootstrapTeams.completed && (
                          <Badge bg="success" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                            <i className="bi bi-check-circle me-1"></i>
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted small mb-4" style={{ lineHeight: '1.6' }}>
                    Creates initial teams and role structure for your organization. Essential for managing projects and user permissions.
                  </p>

                  <div className="d-grid">
                    <Button
                      variant={systemState.teamsExist ? 'outline-success' : 'success'}
                      onClick={confirmBootstrapTeams}
                      disabled={operations.bootstrapTeams.loading || !user?.organizationId}
                      style={{
                        fontWeight: '500',
                        borderRadius: '6px',
                        boxShadow: !systemState.teamsExist ? '0 2px 8px rgba(20, 184, 166, 0.2)' : 'none'
                      }}
                    >
                      {operations.bootstrapTeams.loading ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Bootstrapping teams...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-circle me-2"></i>
                          {systemState.teamsExist ? 'Re-run Bootstrap' : 'Bootstrap Teams'}
                        </>
                      )}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>

          {/* Quick Start Guide */}
          <Card
            className="border-0 shadow-sm mt-4"
            style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #fcd34d'
            }}
          >
            <Card.Body className="p-4">
              <div className="d-flex align-items-center mb-4">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center me-3"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <i className="bi bi-lightbulb-fill text-white" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold" style={{ color: '#92400e' }}>
                    Quick Start Guide
                  </h5>
                  <p className="mb-0 small" style={{ color: '#78350f' }}>
                    Follow these steps to get your system up and running
                  </p>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      1
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold" style={{ color: '#92400e' }}>
                        Setup Collections
                      </h6>
                      <p className="mb-0 small" style={{ color: '#78350f' }}>
                        Click &quot;Setup Collections&quot; to create all database structures with attributes and indexes.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      2
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold" style={{ color: '#92400e' }}>
                        Bootstrap Teams
                      </h6>
                      <p className="mb-0 small" style={{ color: '#78350f' }}>
                        After collections are ready, click &quot;Bootstrap Teams&quot; to create the initial team structure.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      3
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold" style={{ color: '#92400e' }}>
                        Create Users
                      </h6>
                      <p className="mb-0 small" style={{ color: '#78350f' }}>
                        Navigate to Admin → Create New User to add team members.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      4
                    </div>
                    <div>
                      <h6 className="mb-1 fw-semibold" style={{ color: '#92400e' }}>
                        Start Managing
                      </h6>
                      <p className="mb-0 small" style={{ color: '#78350f' }}>
                        Begin creating projects, assigning tasks, and tracking progress!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Tab>

        {/* Collections Tab */}
        <Tab
          eventKey="collections"
          title={
            <>
              <i className="bi bi-database me-2"></i>
              Collections ({existingCollections}/{totalCollections})
            </>
          }
        >
          <Card className="border-0 shadow-sm mt-3">
            <Card.Header
              className="bg-white p-4"
              style={{ borderBottom: '2px solid #e9ecef' }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-1 fw-bold d-flex align-items-center">
                    <i className="bi bi-database-fill me-2" style={{ color: '#054653' }}></i>
                    Database Collections Status
                  </h5>
                  <p className="text-muted small mb-0">
                    Detailed view of all {totalCollections} collections and their configuration status
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={confirmSetupCollections}
                  disabled={operations.setupCollections.loading}
                  style={{
                    fontWeight: '500',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  {operations.setupCollections.loading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-play-circle me-1"></i>
                      {systemState.collectionsExist ? 'Re-run Setup' : 'Run Setup'}
                    </>
                  )}
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {collectionDetails.length === 0 ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading collection details...</p>
                </div>
              ) : (
                <Accordion flush>
                  {collectionDetails.map((col, index) => (
                    <Accordion.Item eventKey={String(index)} key={col.id} style={{ border: 'none', borderBottom: '1px solid #e9ecef' }}>
                      <Accordion.Header>
                        <div className="d-flex align-items-center justify-content-between w-100 me-3">
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                              style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                                color: 'white'
                              }}
                            >
                              <i className="bi bi-database" style={{ fontSize: '1.1rem' }}></i>
                            </div>
                            <div>
                              <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>{col.name}</div>
                              <code className="small text-muted" style={{ fontSize: '0.8rem' }}>{col.id}</code>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {col.attributes && col.attributes.length > 0 && (
                              <Badge bg="info" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-tag me-1"></i>
                                {col.attributes.length}
                              </Badge>
                            )}
                            {col.indexes && col.indexes.length > 0 && (
                              <Badge bg="warning" text="dark" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-key me-1"></i>
                                {col.indexes.length}
                              </Badge>
                            )}
                            {col.status === 'exists' || col.exists ? (
                              <Badge bg="success" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-check-circle me-1"></i>
                                Exists
                              </Badge>
                            ) : col.status === 'created' ? (
                              <Badge bg="primary" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-plus-circle me-1"></i>
                                Created
                              </Badge>
                            ) : col.status === 'error' ? (
                              <Badge bg="danger" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-x-circle me-1"></i>
                                Error
                              </Badge>
                            ) : (
                              <Badge bg="secondary" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                                <i className="bi bi-dash-circle me-1"></i>
                                Missing
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body style={{ backgroundColor: '#f8f9fa', padding: '1.5rem' }}>
                        {col.attributes && col.attributes.length > 0 && (
                          <div className="mb-3">
                            <h6 className="small text-muted mb-2">
                              <i className="bi bi-tag me-1"></i>
                              Attributes ({col.attributes.length})
                            </h6>
                            <div className="d-flex flex-wrap gap-2">
                              {col.attributes.map((attr) => (
                                <Badge
                                  key={attr.key}
                                  bg={attr.status === 'created' ? 'primary' : attr.status === 'exists' ? 'success' : 'danger'}
                                  className="px-2 py-1"
                                >
                                  {attr.key}
                                  <span className="ms-1 opacity-75">({attr.type})</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {col.indexes && col.indexes.length > 0 && (
                          <div>
                            <h6 className="small text-muted mb-2">
                              <i className="bi bi-key me-1"></i>
                              Indexes ({col.indexes.length})
                            </h6>
                            <div className="d-flex flex-wrap gap-2">
                              {col.indexes.map((idx) => (
                                <Badge
                                  key={idx.key}
                                  bg={idx.status === 'created' ? 'primary' : idx.status === 'exists' ? 'success' : 'danger'}
                                  className="px-2 py-1"
                                >
                                  {idx.key}
                                  <span className="ms-1 opacity-75">[{idx.type}]</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Help Tab */}
        <Tab
          eventKey="help"
          title={
            <>
              <i className="bi bi-question-circle me-2"></i>
              Help
            </>
          }
        >
          <div className="row g-4 mt-1">
            <div className="col-lg-8">
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center mb-4">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <i className="bi bi-question-circle-fill text-white" style={{ fontSize: '1.5rem' }}></i>
                    </div>
                    <div>
                      <h5 className="mb-0 fw-bold">Frequently Asked Questions</h5>
                      <p className="mb-0 small text-muted">Common questions about system setup</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #054653' }}>
                    <h6 className="fw-semibold mb-2" style={{ color: '#054653' }}>
                      <i className="bi bi-database me-2"></i>
                      What does &quot;Setup Collections&quot; do?
                    </h6>
                    <p className="text-muted mb-0 small" style={{ lineHeight: '1.6' }}>
                      This creates all 15 database collections required for the system, including their schemas, attributes (fields), and indexes for optimal performance. It&apos;s idempotent, meaning you can run it multiple times safely - it will only create what&apos;s missing.
                    </p>
                  </div>

                  <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #14B8A6' }}>
                    <h6 className="fw-semibold mb-2" style={{ color: '#14B8A6' }}>
                      <i className="bi bi-people me-2"></i>
                      What does &quot;Bootstrap Teams&quot; do?
                    </h6>
                    <p className="text-muted mb-0 small" style={{ lineHeight: '1.6' }}>
                      This creates the initial team structure for your organization, including admin, staff, and client teams. These teams are essential for managing permissions and project assignments.
                    </p>
                  </div>

                  <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #ffc107' }}>
                    <h6 className="fw-semibold mb-2" style={{ color: '#f59e0b' }}>
                      <i className="bi bi-arrow-repeat me-2"></i>
                      Can I run setup again after the system is initialized?
                    </h6>
                    <p className="text-muted mb-0 small" style={{ lineHeight: '1.6' }}>
                      Yes, but be cautious. The setup operations are idempotent and will create missing components without affecting existing data. However, re-running the entire setup may reset certain configurations.
                    </p>
                  </div>

                  <div className="mb-0 p-3 rounded" style={{ backgroundColor: '#f8f9fa', borderLeft: '4px solid #198754' }}>
                    <h6 className="fw-semibold mb-2" style={{ color: '#198754' }}>
                      <i className="bi bi-check-circle me-2"></i>
                      What should I do after setup is complete?
                    </h6>
                    <p className="text-muted mb-0 small" style={{ lineHeight: '1.6' }}>
                      After completing the setup, navigate to the Admin Dashboard and create your first users. Then you can start creating projects, assigning tasks, and managing your team&apos;s work.
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </div>

            <div className="col-lg-4">
              <Card
                className="border-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', border: '2px solid #7dd3fc' }}
              >
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                      }}
                    >
                      <i className="bi bi-info-circle-fill text-white"></i>
                    </div>
                    <h6 className="mb-0 fw-bold" style={{ color: '#0369a1' }}>Need Help?</h6>
                  </div>
                  <p className="small mb-3" style={{ color: '#075985', lineHeight: '1.6' }}>
                    If you encounter any issues during setup or have questions about the system configuration, please contact your system administrator.
                  </p>
                  <div className="d-grid gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push('/admin')}
                      style={{ fontWeight: '500', borderRadius: '6px' }}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
                      Back to Admin Dashboard
                    </Button>
                  </div>
                </Card.Body>
              </Card>

              <Card
                className="border-0 shadow-sm mt-3"
                style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '2px solid #fcd34d' }}
              >
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <i className="bi bi-exclamation-triangle-fill text-white"></i>
                    </div>
                    <h6 className="mb-0 fw-bold" style={{ color: '#92400e' }}>Important Notes</h6>
                  </div>
                  <ul className="small mb-0 ps-3" style={{ color: '#78350f', lineHeight: '1.8' }}>
                    <li className="mb-2">
                      <strong>Backup:</strong> Always backup your data before re-running setup operations
                    </li>
                    <li className="mb-2">
                      <strong>Permissions:</strong> Setup operations require admin privileges
                    </li>
                    <li className="mb-0">
                      <strong>Duration:</strong> Collection setup may take a few minutes to complete
                    </li>
                  </ul>
                </Card.Body>
              </Card>
            </div>
          </div>
        </Tab>
      </Tabs>

      {/* Collections Setup Confirmation Modal */}
      <Modal show={showCollectionsModal} onHide={() => setShowCollectionsModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)', border: 'none' }}>
          <Modal.Title className="text-white">
            <i className="bi bi-database-fill me-2"></i>
            {systemState.collectionsExist ? 'Re-run Collections Setup' : 'Setup Database Collections'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Alert variant={systemState.collectionsExist ? 'warning' : 'info'} className="mb-4 border-0" style={{ borderLeft: `4px solid ${systemState.collectionsExist ? '#ffc107' : '#0dcaf0'}` }}>
            <div className="d-flex">
              <i className={`bi ${systemState.collectionsExist ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-3`} style={{ fontSize: '1.5rem' }}></i>
              <div>
                <Alert.Heading className="h6 mb-2">
                  {systemState.collectionsExist ? 'Collections Already Exist' : 'Initial Setup'}
                </Alert.Heading>
                <p className="mb-0 small" style={{ lineHeight: '1.6' }}>
                  {systemState.collectionsExist
                    ? 'This operation will check all collections and create any missing components (attributes and indexes). Existing data will not be affected, but this may take a few minutes.'
                    : 'This will create all 15 database collections with their schemas, attributes, and indexes. This is a safe operation and required for system functionality.'}
                </p>
              </div>
            </div>
          </Alert>

          <div className="mb-4">
            <h6 className="fw-semibold mb-3">
              <i className="bi bi-list-check me-2" style={{ color: '#054653' }}></i>
              What will be created:
            </h6>
            <div className="row g-2">
              <div className="col-md-6">
                <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                  <i className="bi bi-database text-primary me-2"></i>
                  <strong className="small">15 Collections</strong>
                  <p className="mb-0 text-muted small">Organizations, Users, Projects, Tasks, etc.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                  <i className="bi bi-tag text-info me-2"></i>
                  <strong className="small">100+ Attributes</strong>
                  <p className="mb-0 text-muted small">Fields for all data structures</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                  <i className="bi bi-key text-warning me-2"></i>
                  <strong className="small">25+ Indexes</strong>
                  <p className="mb-0 text-muted small">For optimal query performance</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                  <i className="bi bi-shield-check text-success me-2"></i>
                  <strong className="small">Document Security</strong>
                  <p className="mb-0 text-muted small">Permission-based access control</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded" style={{ backgroundColor: '#e0f2fe', borderLeft: '4px solid #0284c7' }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-clock text-info me-2"></i>
              <small className="text-muted">
                <strong>Estimated Time:</strong> 2-3 minutes depending on your connection
              </small>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0" style={{ backgroundColor: '#f8f9fa' }}>
          <Button
            variant="outline-secondary"
            onClick={() => setShowCollectionsModal(false)}
            style={{ fontWeight: '500', borderRadius: '6px' }}
          >
            <i className="bi bi-x-circle me-1"></i>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={setupCollections}
            disabled={operations.setupCollections.loading}
            style={{ fontWeight: '500', borderRadius: '6px', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)' }}
          >
            <i className="bi bi-play-circle me-1"></i>
            {systemState.collectionsExist ? 'Re-run Setup' : 'Start Setup'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Teams Bootstrap Confirmation Modal */}
      <Modal show={showTeamsModal} onHide={() => setShowTeamsModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)', border: 'none' }}>
          <Modal.Title className="text-white">
            <i className="bi bi-people-fill me-2"></i>
            {systemState.teamsExist ? 'Re-run Teams Bootstrap' : 'Bootstrap Team Structure'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Alert variant={systemState.teamsExist ? 'warning' : 'info'} className="mb-4 border-0" style={{ borderLeft: `4px solid ${systemState.teamsExist ? '#ffc107' : '#0dcaf0'}` }}>
            <div className="d-flex">
              <i className={`bi ${systemState.teamsExist ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-3`} style={{ fontSize: '1.5rem' }}></i>
              <div>
                <Alert.Heading className="h6 mb-2">
                  {systemState.teamsExist ? 'Teams Already Configured' : 'Initial Bootstrap'}
                </Alert.Heading>
                <p className="mb-0 small" style={{ lineHeight: '1.6' }}>
                  {systemState.teamsExist
                    ? 'Re-running this operation will check existing teams and create any missing ones. This may affect team permissions and memberships.'
                    : 'This will create the initial team structure for your organization, which is essential for managing user permissions and project access.'}
                </p>
              </div>
            </div>
          </Alert>

          <div className="mb-4">
            <h6 className="fw-semibold mb-3">
              <i className="bi bi-diagram-3 me-2" style={{ color: '#14B8A6' }}></i>
              Teams to be created:
            </h6>
            <div className="row g-2">
              <div className="col-md-4">
                <div className="p-3 rounded text-center" style={{ backgroundColor: '#fef3c7', border: '2px solid #fcd34d' }}>
                  <i className="bi bi-shield-fill-exclamation" style={{ fontSize: '2rem', color: '#f59e0b' }}></i>
                  <div className="mt-2">
                    <strong className="small d-block">Admin Team</strong>
                    <small className="text-muted">Full system access</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded text-center" style={{ backgroundColor: '#dbeafe', border: '2px solid #93c5fd' }}>
                  <i className="bi bi-briefcase-fill" style={{ fontSize: '2rem', color: '#054653' }}></i>
                  <div className="mt-2">
                    <strong className="small d-block">Staff Team</strong>
                    <small className="text-muted">Internal operations</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded text-center" style={{ backgroundColor: '#ccfbf1', border: '2px solid #5eead4' }}>
                  <i className="bi bi-person-fill" style={{ fontSize: '2rem', color: '#14B8A6' }}></i>
                  <div className="mt-2">
                    <strong className="small d-block">Client Team</strong>
                    <small className="text-muted">External access</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded" style={{ backgroundColor: '#e0f2fe', borderLeft: '4px solid #0284c7' }}>
            <div className="d-flex align-items-center">
              <i className="bi bi-info-circle text-info me-2"></i>
              <small className="text-muted">
                <strong>Note:</strong> Teams are required before you can create users and assign permissions
              </small>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0" style={{ backgroundColor: '#f8f9fa' }}>
          <Button
            variant="outline-secondary"
            onClick={() => setShowTeamsModal(false)}
            style={{ fontWeight: '500', borderRadius: '6px' }}
          >
            <i className="bi bi-x-circle me-1"></i>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={bootstrapTeams}
            disabled={operations.bootstrapTeams.loading}
            style={{ fontWeight: '500', borderRadius: '6px', boxShadow: '0 2px 8px rgba(20, 184, 166, 0.2)' }}
          >
            <i className="bi bi-play-circle me-1"></i>
            {systemState.teamsExist ? 'Re-run Bootstrap' : 'Start Bootstrap'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)', border: 'none' }}>
          <Modal.Title className="text-white">
            <i className="bi bi-exclamation-octagon me-2"></i>
            Reset System
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Alert variant="danger" className="mb-4 border-0" style={{ borderLeft: '4px solid #dc3545' }}>
            <div className="d-flex">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)',
                  boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                }}
              >
                <i className="bi bi-exclamation-triangle text-white" style={{ fontSize: '1.5rem' }}></i>
              </div>
              <div>
                <Alert.Heading className="h6 mb-2 fw-bold">
                  This Action Cannot Be Undone
                </Alert.Heading>
                <p className="mb-2 small" style={{ lineHeight: '1.6' }}>
                  Resetting the system will <strong>permanently delete ALL existing data</strong> including:
                </p>
                <ul className="small mb-0" style={{ lineHeight: '1.8' }}>
                  <li>All projects, tasks, and milestones</li>
                  <li>All users (except system administrators)</li>
                  <li>All documents and embeds</li>
                  <li>All timesheets and time entries</li>
                  <li>All teams and team memberships</li>
                </ul>
              </div>
            </div>
          </Alert>

          <Form.Group>
            <Form.Label className="fw-bold mb-2">
              Type <code className="px-2 py-1 bg-light rounded">RESET SYSTEM</code> to confirm:
            </Form.Label>
            <Form.Control
              type="text"
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value)}
              placeholder="RESET SYSTEM"
              className={resetConfirmation === 'RESET SYSTEM' ? 'border-danger border-2' : ''}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem', padding: '0.75rem' }}
            />
            <Form.Text className="text-muted small">
              <i className="bi bi-shield-exclamation me-1"></i>
              This confirmation is required to proceed with the system reset.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0" style={{ backgroundColor: '#f8f9fa' }}>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowResetModal(false);
              setResetConfirmation('');
            }}
            style={{ fontWeight: '500', borderRadius: '6px' }}
          >
            <i className="bi bi-x-circle me-1"></i>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReset}
            disabled={resetConfirmation !== 'RESET SYSTEM' || resetting}
            style={{ fontWeight: '500', borderRadius: '6px', boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)' }}
          >
            {resetting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Resetting...
              </>
            ) : (
              <>
                <i className="bi bi-exclamation-octagon me-2"></i>
                Reset System
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}
