import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, notFound, type ErrorBody } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound());
};

function fieldsFromZodError(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    fields[path] ??= issue.message;
  }
  return fields;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json(error.toBody());
    return;
  }

  if (error instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid.',
        fields: fieldsFromZodError(error),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Anything unrecognised is a bug, not a client error: log it, return nothing revealing.
  console.error('Unhandled error:', error);
  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  };
  res.status(500).json(body);
};
