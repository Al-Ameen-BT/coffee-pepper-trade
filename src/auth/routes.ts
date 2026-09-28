import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../db.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { ApiError } from "../lib/errorHandler.js";
import type { AuthResponse, UserDTO } from "../../shared/types.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function toUserDTO(user: { id: string; email: string; name: string; role: string }): UserDTO {
  return { id: user.id, email: user.email, name: user.name, role: user.role as UserDTO["role"] };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "Email already registered");
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const response: AuthResponse = { token, user: toUserDTO(user) };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const response: AuthResponse = { token, user: toUserDTO(user) };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    res.json(toUserDTO(user));
  } catch (err) {
    next(err);
  }
});
