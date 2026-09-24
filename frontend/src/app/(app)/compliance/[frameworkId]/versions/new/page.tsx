import { NewFrameworkVersionView } from './new-framework-version-view';

export default async function NewFrameworkVersionPage({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}): Promise<React.JSX.Element> {
  const { frameworkId } = await params;
  return <NewFrameworkVersionView frameworkId={frameworkId} />;
}
