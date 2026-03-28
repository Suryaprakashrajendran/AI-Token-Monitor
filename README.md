
# AI Token Monitor

> A full-stack AI chatbot with real-time token usage monitoring, cost tracking, and a live admin dashboard.

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)

---

## What Is This?

AI Token Monitor lets you run a **multi-user AI chatbot** and watch every token, cost, and API call from a beautiful live dashboard. It supports **OpenAI GPT** and **Google Gemini** models at the same time.

```
User  →  chatbot.html   →  POST /api/chat  →  server.js  →  OpenAI / Gemini
Admin →  dashboard.html →  GET  /api/stats →  server.js  →  usage.json
```

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Supported Models](#supported-models)
- [API Reference](#api-reference)
- [Dashboard Guide](#dashboard-guide)
- [Troubleshooting](#troubleshooting)
- [Customization](#customization)

---

## Features

- **Multi-user chat** — each user gets their own isolated session
- **Live dashboard** — auto-refreshes every 3 seconds, no page reload needed
- **Charts** — hourly bar chart, provider split donut, token ratio donut, 7-day cost trend
- **Cost tracking** — per-request and daily totals based on model pricing
- **Rate limit bars** — visual RPM/TPM meters with yellow (70%) and red (90%) alerts
- **Dark / Light mode** — persistent theme on both chatbot and dashboard
- **History view** — date-wise logs with hourly breakdowns
- **JSON export** — download all usage data in one click
- **Pricing warnings** — detects unknown models and shows exactly what to fix

---

## Project Structure

```
ai-token-monitor/
├── server.js          ← Express backend (API proxy + usage logger)
├── chatbot.html       ← User chat interface
├── dashboard.html     ← Admin dashboard with charts
├── .env               ← Your API keys  ⚠️ never commit this
├── usage.json         ← Auto-generated usage data
└── package.json       ← Dependencies
```

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | v18 or newer | `node --version` |
| npm | v8 or newer | `npm --version` |
| OpenAI API Key | optional* | [platform.openai.com](https://platform.openai.com/api-keys) |
| Gemini API Key | optional* | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

> You only need **one** API key to get started.

---

## Installation

### Step 1 — Create project folder

```bash
mkdir ai-token-monitor
cd ai-token-monitor
mkdir files
cd files
```

### Step 2 — Use this files

Git clone :

```
https://github.com/Suryaprakashrajendran/AI-Token-Monitor.git
```

[or]

Put these files into your folder:

```
server.js
chatbot.html
dashboard.html
```

### Step 3 — Install dependencies

```bash
npm init -y
npm install express cors dotenv
```

### Step 4 — Create your `.env` file

Create a file named `.env` in the project root:

```env
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=AIza-your-gemini-key-here
PORT=3000
```

> If you only have one key, leave the other blank. Never push `.env` to GitHub.

### Step 5 — Add missing model pricing *(important)*

Open `server.js` and find the `PRICING` object. Add any models you plan to use:

```js
const PRICING = {
  'gpt-4o':                { in: 2.50,  out: 10.00 },
  'gpt-4o-mini':           { in: 0.15,  out: 0.60  },
  'gpt-3.5-turbo':         { in: 0.50,  out: 1.50  },
  'gemini-1.5-flash':      { in: 0.075, out: 0.30  },
  'gemini-1.5-pro':        { in: 3.50,  out: 10.50 },

  // Add newer models here to avoid $0.00 warnings:
  'gemini-2.5-flash-lite': { in: 0.075, out: 0.30  },
  'gemini-2.0-flash':      { in: 0.10,  out: 0.40  },
};
```

> Without this, cost shows **$0.00 ⚠️** for unknown models.

### Step 6 — Start the server

```bash
node server.js
```

Expected output:

```
✅ Token Monitor server  →  http://localhost:3000
🤖 Chatbot               →  http://localhost:3000/chatbot.html
📊 Dashboard             →  http://localhost:3000/dashboard.html
📁 Usage data file       →  eg: C:\ai-token-monitor\files\usage.json
```

### Step 7 — Open in browser

| Page | URL |
|------|-----|
| Chat Interface | http://localhost:3000/chatbot.html |
| Admin Dashboard | http://localhost:3000/dashboard.html |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Optional* | Your OpenAI secret key |
| `GEMINI_API_KEY` | Optional* | Your Google Gemini API key |
| `PORT` | Yes | Server port (default `3000`) |

### Rate Limits

Edit the `LIMITS` object in `server.js` to match your API plan:

```js
const LIMITS = {
  openai: { rpm: 60,  tpm: 90000  },
  gemini: { rpm: 15,  tpm: 250000 },
};
```

---

## Supported Models

### OpenAI

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `gpt-4o` | $2.50 / 1M | $10.00 / 1M | Most capable |
| `gpt-4o-mini` | $0.15 / 1M | $0.60 / 1M | Best value ⭐ |
| `gpt-3.5-turbo` | $0.50 / 1M | $1.50 / 1M | Economy |

### Google Gemini

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `gemini-1.5-flash` | $0.075 / 1M | $0.30 / 1M | Fast & cheap |
| `gemini-1.5-pro` | $3.50 / 1M | $10.50 / 1M | Most capable |
| `gemini-2.5-flash-lite` | $0.075 / 1M | $0.30 / 1M | Add to PRICING manually |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message to AI |
| `GET` | `/api/stats` | Live stats — tokens, costs, sessions, rate limits |
| `GET` | `/api/history` | All history grouped by date |
| `GET` | `/api/history/:date` | Detail for one date (`YYYY-MM-DD`) |
| `GET` | `/api/export` | Download `usage.json` |

### POST `/api/chat` — Request Body

```json
{
  "sessionId":    "alice-1711600000000",
  "userId":       "alice",
  "provider":     "gemini",
  "model":        "gemini-2.5-flash-lite",
  "message":      "Hello!",
  "systemPrompt": "You are a helpful assistant."
}
```

### POST `/api/chat` — Response

```json
{
  "reply": "Hi! How can I help you?",
  "usage": {
    "inTok":  5,
    "outTok": 9,
    "cost":   0.000001
  }
}
```

---

## Dashboard Guide

### Charts

| Chart | What it shows |
|-------|--------------|
| Hourly Token Usage | Stacked bar — input vs output tokens per hour |
| Provider Split | Doughnut — OpenAI vs Gemini call count |
| In vs Out Tokens | Doughnut — input vs output token ratio |
| 7-Day Cost Trend | Line chart — daily spend for the last 7 days |

### KPI Cards

| Card | Color | What it means |
|------|-------|---------------|
| Input Tokens | 🟢 Green | Tokens sent to AI today |
| Output Tokens | 🔵 Blue | Tokens generated today |
| Total Tokens | 🟣 Purple | Input + Output combined |
| Est. Cost | 🟡 Yellow | Today's spend in USD |
| API Calls | 🔴 Red | Total requests today |

### Rate Limit Alert Colors

| Color | Threshold | Meaning |
|-------|-----------|---------|
| 🟢 Green | 0 – 69% | All good |
| 🟡 Yellow | 70 – 89% | Warning banner shown |
| 🔴 Red | 90%+ | Critical — requests may fail with 429 |

### Active Sessions

Shows users currently chatting live. After a server restart (sessions reset), it automatically falls back to showing **today's users from history**.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Cost shows `$0.00 ⚠️` | Model not in `PRICING` | Add model to `PRICING` in `server.js` (Step 5) |
| Active sessions empty | Sessions reset on restart | Normal — history users shown as fallback |
| Cannot connect to server | Server not running | Run `node server.js`, check `PORT` in `.env` |
| `401 Unauthorized` | Wrong API key | Check `.env` values |
| `429 Too Many Requests` | Rate limit hit | Wait 60s or upgrade your plan |
| Pie chart empty | No requests yet | Send a message, click Refresh History |
| 7-day trend shows `$0` | Unknown model pricing | Fix PRICING table first |

---

## Customization

### Add a new model

1. Add pricing to `server.js`:

```js
'my-model': { in: 1.00, out: 2.00 },
```

2. Add to the dropdown in `chatbot.html` inside `updateModels()`:

```html
<option value="my-model">my-model</option>
```

### Change the port

```env
# .env
PORT=8080
```

Also update the default URL in `dashboard.html`:

```html
<input type="text" id="serverUrl" value="http://localhost:8080" ...>
```

### Add a system prompt

```js
body: JSON.stringify({
  sessionId, userId, provider, model, message: text,
  systemPrompt: "You are a helpful support agent."
})
```

### Auto-restart on file changes

```bash
npm install -g nodemon
nodemon server.js
```

---

## .gitignore

```gitignore
# Secrets
.env

# Auto-generated
usage.json

# Dependencies
node_modules/

# OS
.DS_Store
Thumbs.db
```

---

## Quick Reference

```bash
# Install
npm install express cors dotenv

# Start
node server.js

# URLs
http://localhost:3000/chatbot.html     # Chat
http://localhost:3000/dashboard.html   # Dashboard
http://localhost:3000/api/stats        # Raw stats JSON
http://localhost:3000/api/export       # Download usage data

# Stop
Ctrl + C
```

---

> Built with Node.js · Express · Chart.js · OpenAI API · Google Gemini API

---

