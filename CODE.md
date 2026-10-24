# Full source code

The runnable source is organized as follows:

- `server.js` — Node.js server and Groq API route
- `public/index.html` — chat page structure
- `public/style.css` — visual styling
- `public/app.js` — browser chat behavior
- `package.json` — start command

The API key is intentionally excluded from this document. It belongs in `.env` as `GROQ_API_KEY=...`; never paste it into frontend code or publish it.

## Start the app

Open a terminal in this folder and run the Python server (Python 3 is enough; no packages to install):

```sh
python3 server.py
```

Keep the terminal open and visit http://localhost:3000. The Node alternative is `npm start` if Node.js 18 or newer is installed. If port 3000 is already in use, run `PORT=3001 python3 server.py` and visit http://localhost:3001.
