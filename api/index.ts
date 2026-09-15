import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  const { app } = await import('../apps/api/src/app.js');
  const rewrittenPath = req.query.__path;
  if (typeof rewrittenPath === 'string') {
    const query = new URLSearchParams(req.url.split('?')[1] ?? '');
    query.delete('__path');
    const suffix = query.size ? `?${query.toString()}` : '';
    req.url = `/api/${rewrittenPath}${suffix}`;
  }
  return app(req, res);
}
