import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByUsername, createUser } from "../db.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "rankforge-secret-super-key-12345";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    const existingUser = await findUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(cleanUsername, passwordHash);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const cleanUsername = username.trim();

    const user = await findUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
