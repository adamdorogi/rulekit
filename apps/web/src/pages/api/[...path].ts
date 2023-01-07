import type { NextApiRequest, NextApiResponse } from 'next';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const config = { api: { bodyParser: false } };

export default function proxy(req: NextApiRequest, res: NextApiResponse) {
  const path = req.query.path;
  if (!Array.isArray(path) || path[0] !== 'v1' || path.some((part) => !/^[\w-]+$/.test(part))) {
    res.status(404).json({ message: 'Route not found.' });
    return;
  }

  const origin = req.headers.origin;
  if (origin && req.method !== 'GET' && req.method !== 'HEAD') {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let allowed = false;
    try {
      allowed = new URL(origin).host === host;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      res.status(403).json({ message: 'Request origin does not match this console.' });
      return;
    }
  }

  const upstream = new URL(process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000');
  upstream.pathname = '/' + path.map(encodeURIComponent).join('/');
  upstream.search = (req.url || '').split('?')[1] || '';
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = {
    ...(req.headers.cookie && { cookie: req.headers.cookie }),
    ...(req.headers.authorization && { authorization: req.headers.authorization }),
    ...(req.headers['content-type'] && { 'content-type': req.headers['content-type'] }),
    ...(req.headers['content-length'] && { 'content-length': req.headers['content-length'] }),
  };

  const request = send(upstream, { method: req.method, headers, timeout: 30000 }, (response) => {
    res.statusCode = response.statusCode || 502;
    for (const name of ['content-type', 'content-disposition', 'set-cookie', 'cache-control']) {
      const value = response.headers[name];
      if (value !== undefined) res.setHeader(name, value);
    }
    response.pipe(res);
  });

  request.on('timeout', () => request.destroy(new Error('API request timed out')));
  request.on('error', () => {
    if (!res.headersSent) res.status(502).json({ message: 'API unavailable.' });
    else res.end();
  });
  req.on('aborted', () => request.destroy());
  req.pipe(request);
}
