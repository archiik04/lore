import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { tavily } from "@tavily/core";
import OpenAI from "openai";
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from "./prompt.ts";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

// --- Setup ---
const app = express();

// Explicit CORS for local dev
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Initialize Prisma 7 with LibSQL adapter for SQLite
const libsql = createClient({
  url: "file:dev.db",
});
const adapter = new PrismaLibSql(libsql);
const prisma = new PrismaClient({ adapter });

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

const groq = new OpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// --- Helpers ---
const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-")
    .substring(0, 50) + "-" + uuidv4().substring(0, 8);
};

// --- Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// --- Auth Routes ---

app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || "Explorer" },
    });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ error: "Email already exists or invalid data" });
  }
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("Signin error details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Conversation Routes ---

app.get("/conversations", authenticate, async (req: any, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.post("/conversation", authenticate, async (req: any, res) => {
  const { query, conversationId, stream = false } = req.body;

  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    // 1. Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { take: 10, orderBy: { createdAt: "asc" } } },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          title: query.substring(0, 50),
          slug: generateSlug(query),
          userId: req.user.id,
        },
        include: { messages: true },
      });
    }

    // 2. Search
    const searchResponse = await tavilyClient.search(query, {
      searchDepth: "advanced",
      maxResults: 5,
    });
    const results = searchResponse.results || [];
    const formattedResults = results
      .map((r, i) => `Source [${i + 1}]: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
      .join("\n\n");

    // 3. Prepare AI call
    const history = (conversation.messages || []).map(m => ({
      role: m.role as any,
      content: m.content
    }));

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: PROMPT_TEMPLATE(query, formattedResults) }
    ];

    // 4. Handle Response
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      res.write(`data: ${JSON.stringify({ type: "sources", sources: results.map(r => ({ title: r.title, url: r.url })), conversationId: conversation.id, slug: conversation.slug })}\n\n`);

      const completion = await groq.chat.completions.create({
        model: groqModel,
        messages: aiMessages as any,
        stream: true,
      });

      let fullAnswer = "";
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullAnswer += content;
          res.write(`data: ${JSON.stringify({ type: "answer", delta: content })}\n\n`);
        }
      }

      await prisma.message.create({
        data: { role: "user", content: query, conversationId: conversation.id }
      });
      const assistantMessage = await prisma.message.create({
        data: { role: "assistant", content: fullAnswer, conversationId: conversation.id }
      });
      
      // Store sources individually
      for (const r of results) {
        await prisma.source.create({
          data: { title: r.title, url: r.url, messageId: assistantMessage.id }
        });
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      return res.end();
    } else {
      const completion = await groq.chat.completions.create({
        model: groqModel,
        messages: aiMessages as any,
      });

      const answer = completion.choices[0].message.content || "";

      await prisma.message.create({
        data: { role: "user", content: query, conversationId: conversation.id }
      });
      const assistantMessage = await prisma.message.create({
        data: { role: "assistant", content: answer, conversationId: conversation.id }
      });

      for (const r of results) {
        await prisma.source.create({
          data: { title: r.title, url: r.url, messageId: assistantMessage.id }
        });
      }

      return res.json({
        answer,
        sources: results.map(r => ({ title: r.title, url: r.url })),
        conversationId: conversation.id,
        slug: conversation.slug
      });
    }
  } catch (err: any) {
    console.error("Error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), "localhost", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60);
