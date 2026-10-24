const form = document.querySelector('#chat-form');
const input = document.querySelector('#prompt');
const sendButton = document.querySelector('#send-button');
const messagesEl = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const history = [];
let busy = false;

function addMessage(role, content, { error = false } = {}) {
  const row = document.createElement('div');
  row.className = `message ${role}${error ? ' error' : ''}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'assistant' ? '✳' : 'you';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  row.append(avatar, bubble);
  messagesEl.append(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return row;
}

function addTyping() {
  const row = addMessage('assistant', '');
  row.querySelector('.bubble').innerHTML = '<span class="typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
  return row;
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;
  busy = true;
  sendButton.disabled = true;
  input.value = '';
  input.style.height = 'auto';
  welcome.hidden = true;
  addMessage('user', content);
  history.push({ role: 'user', content });
  const typing = addTyping();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    const reply = data.reply || 'I didn’t get a response. Please try again.';
    history.push({ role: 'assistant', content: reply });
    typing.remove();
    addMessage('assistant', reply);
  } catch (error) {
    typing.remove();
    addMessage('assistant', error.message || 'Could not reach the server. Please try again.', { error: true });
    history.pop();
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.textContent.replace('↗', '').trim();
    form.requestSubmit();
  });
});
