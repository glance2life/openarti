import type { ErrorHandler } from "hono";
import { AppError } from "@openarti/shared";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.statusCode as 400
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    500
  );
};
