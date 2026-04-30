export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
  };
}
