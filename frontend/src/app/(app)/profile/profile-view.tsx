'use client';

import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@pharos/design-system/components';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiClient } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { profile as profileMessages } from '@/lib/messages/profile';
import { roleDisplayName } from '@/lib/role-display-name';

import { ChangePasswordForm } from './change-password-form';

import type { OwnProfile } from '@/lib/auth-types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ProfileViewProps {
  forcedPasswordChange: boolean;
}

function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) {
    return profileMessages.identity.firstLogin;
  }
  return new Date(lastLoginAt).toLocaleString();
}

export function ProfileView({ forcedPasswordChange }: ProfileViewProps): React.JSX.Element {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [hasError, setHasError] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await apiClient.get<OwnProfile>('/auth/me');
        if (!cancelled) {
          setProfile(data);
        }
      } catch (error) {
        if (!cancelled) {
          setHasError(true);
          if (error instanceof ApiError) {
            setProblem({
              title: error.problem.title,
              detail: error.problem.detail,
              correlationId: error.problem.correlationId,
            });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={profileMessages.pageTitle} description={profileMessages.pageDescription} />

      {forcedPasswordChange ? (
        <Alert variant="destructive">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>{profileMessages.forcedPasswordChange.title}</AlertTitle>
          <AlertDescription>{profileMessages.forcedPasswordChange.description}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <LoadingState variant="block" label={profileMessages.loading} /> : null}

      {!loading && hasError ? <ErrorState problem={problem} /> : null}

      {!loading && !hasError && profile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{profileMessages.identity.cardTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.fullName}
                </dt>
                <dd className="text-sm text-foreground">{profile.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.email}
                </dt>
                <dd className="text-sm text-foreground">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.jobTitle}
                </dt>
                <dd className="text-sm text-foreground">
                  {profile.jobTitle ?? profileMessages.identity.notSetJobTitle}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.status}
                </dt>
                <dd>
                  <StatusBadge
                    variant={profile.status === 'ACTIVE' ? 'success' : 'neutral'}
                    label={
                      profile.status === 'ACTIVE'
                        ? common.userStatus.active
                        : common.userStatus.inactive
                    }
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.organizationalUnit}
                </dt>
                <dd className="text-sm text-foreground">
                  {profile.primaryOrgUnit?.name ?? profileMessages.identity.notAssignedOrgUnit}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.roles}
                </dt>
                <dd className="text-sm text-foreground">
                  {profile.roles.length > 0
                    ? profile.roles.map((role) => roleDisplayName(role.name)).join(', ')
                    : profileMessages.identity.noRolesAssigned}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {profileMessages.identity.lastLogin}
                </dt>
                <dd className="text-sm text-foreground">{formatLastLogin(profile.lastLoginAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{profileMessages.changePassword.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
