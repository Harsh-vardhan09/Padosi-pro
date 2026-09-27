export type ErrorDetails = Record<string, string | number>;

export type ErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    details?: ErrorDetails;
  };
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;
  readonly details: ErrorDetails | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
    details?: ErrorDetails;
  }) {
    super(args.message);
    this.name = 'AppError';
    this.status = args.status;
    this.code = args.code;
    this.fields = args.fields;
    this.details = args.details;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function unauthorized(code: string, message: string): AppError {
  return new AppError({ status: 401, code, message });
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError({ status: 404, code: 'NOT_FOUND', message });
}
