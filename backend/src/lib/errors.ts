export type ErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
  }) {
    super(args.message);
    this.name = 'AppError';
    this.status = args.status;
    this.code = args.code;
    this.fields = args.fields;
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError({ status: 404, code: 'NOT_FOUND', message });
}
