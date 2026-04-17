import dynamic from 'next/dynamic';

// City3D is client-only — Three.js touches `window` at module-load time.
const City3D = dynamic(() => import('@/components/City3D'), { ssr: false });

export default function Page() {
  return <City3D />;
}
