# python_chatbot_backend_full_
End to end python to external lib
=======
# little chat

A minimal browser chat UI with a small Node.js backend that keeps the Groq API key on the server.

## Run locally

1. Make sure `.env` contains your Groq API key as `GROQ_API_KEY=...`.
2. Run `python3 server.py` from this folder (Python 3 is enough; no packages to install).
3. Keep the terminal open and visit [http://localhost:3000](http://localhost:3000).

Alternatively, with Node.js 18 or newer installed, run `npm start`.

The backend calls Groq's OpenAI-compatible chat completions API using `llama-3.3-70b-versatile`. The key is never sent to the browser.
