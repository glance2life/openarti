import { Hono } from "hono";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";

export const user = new Hono<{ Variables: { user: AuthUser } }>();

user.use("*", authMiddleware);

// Get current user profile
user.get("/profile", async (c) => {
  const currentUser = c.get("user");

  return c.json({
    id: currentUser.id,
    name: currentUser.name,
    username: currentUser.username,
    email: currentUser.email,
    image: currentUser.image,
    role: currentUser.role,
  });
});
