import ComingSoon from '@/components/ComingSoon';

export default function UserPage({
  params,
}: {
  params: { username: string };
}) {
  return (
    <ComingSoon
      title={`@${params.username}`}
      hint="Profile pages with stat breakdowns and a hero building render are next."
    />
  );
}
