import ComingSoon from '@/components/ComingSoon';

export default function ComparePage({
  params,
}: {
  params: { slugs?: string[] };
}) {
  const handles = (params.slugs ?? []).join(' vs ');
  return (
    <ComingSoon
      title={handles ? `compare · ${handles}` : 'compare'}
      hint="Side-by-side building comparisons ship in Phase 2."
    />
  );
}
