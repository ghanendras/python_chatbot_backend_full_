import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Load .env without a dependency. Existing process environment values win.
try {
  const envText = await readFile(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
} catch {
  // .env is optional when environment variables are supplied by the host.
}

const port = Number(process.env.PORT || 3000);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    if (!process.env.GROQ_API_KEY) {
      return sendJson(res, 500, { error: 'GROQ_API_KEY is missing. Add it to .env and restart the server.' });
    }

    try {
      const body = await readBody(req);
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return sendJson(res, 400, { error: 'Send at least one message.' });
      }
      const messages = body.messages.slice(-20).map(({ role, content }) => {
        if (!['user', 'assistant'].includes(role) || typeof content !== 'string') {
          throw new Error('Messages must have a user or assistant role and text content.');
        }
        return { role, content: content.slice(0, 8000) };
      });

      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error('Groq API error:', upstream.status, result.error?.message || 'Unknown error');
        return sendJson(res, upstream.status === 429 ? 429 : 502, {
          error: result.error?.message || 'The AI service could not complete the request.',
        });
      }
      return sendJson(res, 200, { reply: result.choices?.[0]?.message?.content || '' });
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 500;
      return sendJson(res, status, { error: error.message || 'Something went wrong.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 404, { error: 'Not found.' });
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const publicRoot = join(root, 'public');
  const filePath = normalize(join(publicRoot, requested));
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => console.log(`Minimal Chat is running at http://localhost:${port}`));
