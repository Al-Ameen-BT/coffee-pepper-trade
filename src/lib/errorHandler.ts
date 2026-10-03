import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "../config.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ 
      error: err.message, 
      details: config.NODE_ENV === "production" ? undefined : err.details 
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: config.NODE_ENV === "production" ? undefined : err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "A record with this value already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    details: config.NODE_ENV === "production" ? undefined : (err instanceof Error ? err.message : String(err))
  });
}
