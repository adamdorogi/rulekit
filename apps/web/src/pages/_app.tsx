import type { AppProps } from 'next/app';
import Head from 'next/head';
import { SWRConfig } from 'swr';
import { api } from '../lib/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'reactflow/dist/style.css';
import '../styles/console.css';

const swr = { fetcher: api, shouldRetryOnError: false };

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SWRConfig value={swr}>
      <Head><title>rulekit</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <Component {...pageProps} />
    </SWRConfig>
  );
}
