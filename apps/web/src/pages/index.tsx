import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  let destination = '/login';
  if (req.headers.cookie) {
    const upstream = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
    const session = await fetch(new URL('/v1/auth/me', upstream), {
      headers: { cookie: req.headers.cookie },
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (session?.ok) destination = '/projects';
  }
  return { redirect: { destination, permanent: false } };
};

export default function Index() {
  return null;
}
