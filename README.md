# lore.

> *Ask anything. Get answers with sources.*

Lore is an AI-powered search engine built from scratch, inspired by Perplexity. It searches the web in real time and returns clean, cited answers to any question you ask.

<img width="2559" height="1170" alt="image" src="https://github.com/user-attachments/assets/82d94966-91bd-47cc-8319-ac4265b99e10" />



## About

Lore takes a natural language question, runs a live web search, and streams back an LLM answer with the sources it used. Every response is grounded in real web results, not hallucinated facts.

Built as a full-stack project with a Bun backend and a React + Vite frontend.


## Stack

**Frontend**: React, Vite, TypeScript, Tailwind CSS 

**Backend**: Bun, TypeScript, Hono  

**Database**: Prisma  

**AI**: LLM

**Search**: Tavily API  


## Setup

```bash
# 1. Clone
git clone https://github.com/archiik04/lore.git
cd lore

# 2. Backend
cd backend
cp .env.example .env
bun install
bun run dev

# 3. Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

**`backend/.env`**
```env
AI_API_KEY=
TAVILY_API_KEY=
DATABASE_URL=
PORT=3001
```

**`frontend/.env.local`**
```env
VITE_BACKEND_URL=http://localhost:3001
```

Open `http://localhost:5173` and you're good to go.

