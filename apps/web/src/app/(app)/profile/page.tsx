/**
 * PharosGRC — profile route (T075, FR-009).
 *
 * A thin server wrapper so `?mustChangePassword=true` (set by the login
 * screen and the session-expiry prompt when re-authentication reveals the
 * flag) is read without requiring `ProfileView` to use `useSearchParams`.
 */
import { ProfileView } from './profile-view';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const forcedPasswordChange = params.mustChangePassword === 'true';

  return <ProfileView forcedPasswordChange={forcedPasswordChange} />;
}
