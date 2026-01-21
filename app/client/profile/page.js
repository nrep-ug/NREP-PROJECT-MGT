'use client';

import { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import UserProfileView from '@/components/user/UserProfileView';
import Toast, { useToast } from '@/components/Toast';
import AppLayout from '@/components/AppLayout';

export default function ClientProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const { toast, showToast, hideToast } = useToast();

    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            // Fetch full profile from pms_users based on accountId
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.USERS,
                [
                    Query.equal('accountId', user.authUser?.$id || user.id),
                    Query.limit(1)
                ]
            );

            if (response.documents.length > 0) {
                setProfileData(response.documents[0]);
            } else {
                // Fallback
                setProfileData({
                    firstName: user.firstName || user.name.split(' ')[0],
                    lastName: user.lastName || user.name.split(' ')[1] || '',
                    email: user.email,
                    username: user.username,
                    status: 'active',
                    userType: 'client',
                    // ...
                });
            }

        } catch (error) {
            console.error('Failed to load profile:', error);
            showToast('Failed to load profile details', 'danger');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AppLayout user={user}>
                <div className="text-center py-5">
                    <Spinner animation="border" />
                    <p className="mt-2 text-muted">Loading your profile...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />
            <div className="mb-4">
                <h1 className="h3 mb-3">My Profile</h1>
            </div>

            <UserProfileView user={profileData} />
        </AppLayout>
    );
}
