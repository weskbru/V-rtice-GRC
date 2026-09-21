/**
 * PharosGRC — new framework version route (US1). A thin server wrapper so
 * the dynamic `frameworkId` segment is read without forcing
 * `NewFrameworkVersionView` to use `useParams` — same shape as
 * `(app)/controls/[id]/page.tsx`.
 */
import { NewFrameworkVersionView } from './new-framework-version-view';

export default async function NewFrameworkVersionPage({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId } = await params;
  return <NewFrameworkVersionView frameworkId={frameworkId} />;
}
