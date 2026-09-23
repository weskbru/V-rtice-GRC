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
