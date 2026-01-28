'use client';

import { useState, useEffect } from 'react';
import { Spinner, Button } from 'react-bootstrap';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import UserProfileView from '@/components/user/UserProfileView';
import Toast, { useToast } from '@/components/Toast';

export default function AdminUserDetailsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { userId } = params; // This is the ACCOUNT ID
    const { toast, showToast, hideToast } = useToast();

    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.isAdmin && userId) {
            loadUserProfile();
        }
    }, [user, userId]);

    const loadUserProfile = async () => {
        try {
            setLoading(true);

            // We are Admin, query by Account ID
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.USERS,
                [
                    Query.equal('accountId', userId),
                    Query.limit(1)
                ]
            );

            if (response.documents.length > 0) {
                const profile = response.documents[0];

                // Fetch supervisor name if supervisorId exists
                if (profile.supervisorId) {
                    try {
                        const supervisorRes = await databases.listDocuments(
                            DB_ID,
                            COLLECTIONS.USERS,
                            [
                                Query.equal('accountId', profile.supervisorId),
                                Query.limit(1)
                            ]
                        );

                        if (supervisorRes.documents.length > 0) {
                            const supervisor = supervisorRes.documents[0];
                            profile.supervisorName = `${supervisor.firstName} ${supervisor.lastName}`;
                        }
                    } catch (supErr) {
                        console.error('Failed to fetch supervisor details:', supErr);
                    }
                }

                setProfileData(profile);
            } else {
                showToast('User not found', 'danger');
                setTimeout(() => router.push('/admin/users'), 2000);
            }

        } catch (error) {
            console.error('Failed to load user profile:', error);
            showToast('Failed to load user details', 'danger');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AppLayout user={user}>
                <div className="text-center py-5">
                    <Spinner animation="border" />
                    <p className="mt-2 text-muted">Loading user profile...</p>
                </div>
            </AppLayout>
        );
    }

    if (!user?.isAdmin) {
        return (
            <AppLayout user={user}>
                <div className="alert alert-danger m-4">Access Denied</div>
            </AppLayout>
        );
    }

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <Button variant="link" className="text-decoration-none p-0 mb-1" onClick={() => router.push('/admin/users')}>
                        <i className="bi bi-arrow-left me-1"></i> Back to Users
                    </Button>
                    <h1 className="h3 mb-0">User Details</h1>
                </div>
                <div>
                    <Button variant="primary" onClick={() => router.push(`/admin/users/${userId}/edit`)}>
                        <i className="bi bi-pencil me-2"></i>Edit User
                    </Button>
                </div>
            </div>

            <UserProfileView user={profileData} showAdminControls={true} />
        </AppLayout>
    );
}
