import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so a rejected promise becomes next(err) instead of an unhandled
 * rejection — Express 4 does not await handlers itself, so without this a thrown/rejected error in
 * an async route (e.g. a zone's MPD being briefly unreachable) crashes the whole process, not just
 * that request.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
