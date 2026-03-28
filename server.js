const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
require('dotenv').config(); 


const app = express();
app.use(cors());
app.use(express.json());

// Serve HTML files directly — no Live Server needed
app.use(express.static(path.join(__dirname)));


// ─── CONFIG ───────────────────────────────────────────────
// Node will now look into your .env file for these values
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT           = process.env.PORT;
const DATA_FILE      = path.join(__dirname, 'usage.json');

console.log(`Server starting on port ${PORT}`);

const LIMITS = {
  openai: { rpm: 60,  tpm: 90000  },
  gemini: { rpm: 15,  tpm: 250000 },
};
//cost for inutput and outputtoken
const PRICING = {
  'gpt-4o':           { in: 2.50,  out: 10.00 },
  'gpt-4o-mini':      { in: 0.15,  out: 0.60  },
  'gpt-3.5-turbo':    { in: 0.50,  out: 1.50  },
  'gemini-1.5-flash': { in: 0.075, out: 0.30  },
  'gemini-1.5-pro':   { in: 3.50,  out: 10.50 },
};



function loadData() {
  try {
    if (fs.existsSync(DATA_FILE))
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Failed to load usage.json:', e.message); }
  return {};
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('Failed to save usage.json:', e.message); }
}

function getDateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getHourKey(ts = Date.now()) {
  return String(new Date(ts).getHours()).padStart(2, '0');
}

function ensureDay(data, dateKey) {
  if (!data[dateKey]) {
    data[dateKey] = {
      summary: {
        totalIn: 0, totalOut: 0, totalCost: 0, totalCalls: 0,
        openai: { totalIn: 0, totalOut: 0, totalCost: 0, calls: 0 },
        gemini: { totalIn: 0, totalOut: 0, totalCost: 0, calls: 0 },
      },
      requests: [],
      hourly: Object.fromEntries(
        Array.from({ length: 24 }, (_, i) => [String(i).padStart(2,'0'), { calls: 0, inTok: 0, outTok: 0, cost: 0 }])
      ),
    };
  }
  return data[dateKey];
}

function recordRequest(dateKey, hourKey, entry) {
  const data = loadData();
  const day  = ensureDay(data, dateKey);

  // Append to request log (cap at 1000/day)
  day.requests.push(entry);
  if (day.requests.length > 1000) day.requests = day.requests.slice(-1000);

  // Daily summary
  day.summary.totalIn    += entry.inTok;
  day.summary.totalOut   += entry.outTok;
  day.summary.totalCost  += entry.cost;
  day.summary.totalCalls += 1;

  const prov = day.summary[entry.provider];
  if (prov) {
    prov.totalIn  += entry.inTok;
    prov.totalOut += entry.outTok;
    prov.totalCost+= entry.cost;
    prov.calls    += 1;
  }

  // Hourly bucket
  const h = day.hourly[hourKey];
  if (h) { h.calls++; h.inTok += entry.inTok; h.outTok += entry.outTok; h.cost += entry.cost; }

  saveData(data);
}

// ─── IN-MEMORY (live rolling metrics) ────────────────────
let sessions    = {};
let allRequests = [];
let activeUsers = new Set();

function calcCost(model, inTok, outTok) {
  const p = PRICING[model] || { in: 0, out: 0 };
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

function getRolling(provider) {
  const now  = Date.now();
  const wins = allRequests.filter(r => r.provider === provider && now - r.time < 60000);
  return { rpm: wins.length, tpm: wins.reduce((s, r) => s + r.inTok + r.outTok, 0) };
}

// ─── CHAT ENDPOINT ────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { sessionId, userId, provider, model, message, systemPrompt } = req.body;
  if (!sessionId || !userId || !provider || !model || !message)
    return res.status(400).json({ error: 'Missing required fields' });

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      userId, provider, model,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }] : [],
      totalIn: 0, totalOut: 0, totalCost: 0,
      startedAt: Date.now(), lastActive: Date.now(),
    };
  }

  const session = sessions[sessionId];
  session.lastActive = Date.now();
  session.messages.push({ role: 'user', content: message });
  activeUsers.add(userId);

  try {
    let replyText = '', inTok = 0, outTok = 0;

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: session.messages }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'OpenAI error');
      replyText = d.choices[0].message.content;
      inTok = d.usage.prompt_tokens;
      outTok = d.usage.completion_tokens;

    } else if (provider === 'gemini') {
      const geminiMsgs = session.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: geminiMsgs }) }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'Gemini error');
      replyText = d.candidates[0].content.parts[0].text;
      inTok  = d.usageMetadata?.promptTokenCount || 0;
      outTok = d.usageMetadata?.candidatesTokenCount || 0;
    }

    const cost    = calcCost(model, inTok, outTok);
    const now     = Date.now();
    const dateKey = getDateKey(now);
    const hourKey = getHourKey(now);
    const timeStr = new Date(now).toLocaleTimeString('en-GB');

    session.messages.push({ role: 'assistant', content: replyText });
    session.totalIn   += inTok;
    session.totalOut  += outTok;
    session.totalCost += cost;

    const entry = { time: now, timeStr, dateKey, sessionId, userId, provider, model, inTok, outTok, cost, preview: message.slice(0, 60) };
    allRequests.push(entry);
    if (allRequests.length > 500) allRequests = allRequests.slice(-500);

    // ✅ Write to usage.json
    recordRequest(dateKey, hourKey, { time: now, timeStr, userId, provider, model, inTok, outTok, cost, preview: message.slice(0, 60) });

    res.json({ reply: replyText, usage: { inTok, outTok, cost } });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── LIVE STATS (today only) ──────────────────────────────
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  Object.keys(sessions).forEach(id => {
    if (now - sessions[id].lastActive > 5 * 60 * 1000) {
      activeUsers.delete(sessions[id].userId);
      delete sessions[id];
    }
  });

  const todayKey   = getDateKey();
  const data       = loadData();
  const todaySumm  = data[todayKey]?.summary || { totalIn:0, totalOut:0, totalCost:0, totalCalls:0 };
  const recentReqs = (data[todayKey]?.requests || []).slice(-50).reverse();

  const userSessions = Object.values(sessions).map(s => ({
    userId: s.userId, provider: s.provider, model: s.model,
    totalIn: s.totalIn, totalOut: s.totalOut, totalCost: s.totalCost,
    lastActive: s.lastActive,
    messageCount: s.messages.filter(m => m.role === 'user').length,
  }));

  res.json({
    activeUsers:    activeUsers.size,
    totalIn:        todaySumm.totalIn,
    totalOut:       todaySumm.totalOut,
    totalCost:      todaySumm.totalCost,
    totalCalls:     todaySumm.totalCalls,
    rateLimits: {
      openai: { ...getRolling('openai'), rpmLimit: LIMITS.openai.rpm, tpmLimit: LIMITS.openai.tpm },
      gemini: { ...getRolling('gemini'), rpmLimit: LIMITS.gemini.rpm, tpmLimit: LIMITS.gemini.tpm },
    },
    sessions:       userSessions.sort((a, b) => b.lastActive - a.lastActive),
    recentRequests: recentReqs,
  });
});

// ─── HISTORY — all dates summary ──────────────────────────
app.get('/api/history', (req, res) => {
  const data = loadData();
  const days = Object.entries(data)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, day]) => ({
      date,
      summary:      day.summary,
      hourly:       day.hourly,
      requestCount: day.requests.length,
    }));
  res.json({ days });
});

// ─── HISTORY — single date detail ────────────────────────
app.get('/api/history/:date', (req, res) => {
  const data = loadData();
  const day  = data[req.params.date];
  if (!day) return res.status(404).json({ error: 'No data for that date' });
  res.json(day);
});

// ─── EXPORT raw usage.json ────────────────────────────────
app.get('/api/export', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'No data yet' });
  res.download(DATA_FILE, 'usage.json');
});

app.listen(PORT, () => {
  console.log(`✅ Token Monitor server  →  http://localhost:${PORT}`);
  console.log(`🤖 Chatbot               →  http://localhost:${PORT}/chatbot.html`);
  console.log(`📊 Dashboard             →  http://localhost:${PORT}/dashboard.html`);
  console.log(`📁 Usage data file       →  ${DATA_FILE}`);
  if (!fs.existsSync(DATA_FILE)) saveData({});
});


