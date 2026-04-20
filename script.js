const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');

let chatbotApiUrl = '';

// Fetch configuration from the server
async function fetchConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    chatbotApiUrl = data.chatbotApiUrl;
  } catch (error) {
    console.error('Gagal mengambil konfigurasi:', error);
  }
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = '';

  const botMsgEl = appendMessage('bot', '');
  const typingIndicator = document.createElement('span');
  typingIndicator.innerText = '...';
  botMsgEl.appendChild(typingIndicator);

  try {
    if (!chatbotApiUrl) {
      await fetchConfig();
    }

    const response = await fetch(chatbotApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ message: userMessage })
    });

    if (!response.ok) {
        throw new Error('Gagal menghubungi API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let fullBotMessage = ''; // Store the full message for formatting
    
    // Remove typing indicator when we start receiving data
    botMsgEl.innerText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;

      const lines = accumulatedText.split('\n');
      accumulatedText = lines.pop();

      for (const line of lines) {
        let cleanLine = line.trim();
        if (cleanLine === '') continue;

        if (cleanLine.startsWith('data: ')) {
          cleanLine = cleanLine.substring(6).trim();
        }

        if (cleanLine === '' || cleanLine === '[DONE]') continue;

        try {
          const data = JSON.parse(cleanLine);
          if (data.delta) {
            fullBotMessage += data.delta;
            botMsgEl.innerHTML = formatText(fullBotMessage);
            scrollToBottom();
          }
        } catch (err) {
          console.warn('Failed to parse line:', line);
        }
      }
    }

    // Process any remaining text in accumulatedText
    if (accumulatedText.trim() !== '') {
        let finalClean = accumulatedText.trim();
        if (finalClean.startsWith('data: ')) {
            finalClean = finalClean.substring(6).trim();
        }
        
        if (finalClean !== '' && finalClean !== '[DONE]') {
            try {
                const data = JSON.parse(finalClean);
                if (data.delta) {
                    fullBotMessage += data.delta;
                    botMsgEl.innerHTML = formatText(fullBotMessage);
                }
            } catch (err) {
                console.warn('Failed to parse final chunk:', accumulatedText);
            }
        }
    }

  } catch (error) {
    console.error(error);
    botMsgEl.innerText = 'Aduh, sepertinya ada masalah koneksi atau server sedang sibuk. Silakan coba lagi nanti.';
  } finally {
    scrollToBottom();
  }
});

function formatText(text) {
  // 1. Escape HTML (Keamanan)
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. Format Headings (#, ##, ###)
  // Handle h3
  escaped = escaped.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  // Handle h2
  escaped = escaped.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  // Handle h1
  escaped = escaped.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // 3. Format Links as Buttons [text](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" class="chat-button">$1</a>');

  // 4. Format Bold (**teks**)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 5. Horizontal Rule (---)
  escaped = escaped.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">');

  // 6. Blockquote (> )
  escaped = escaped.replace(/^&gt;\s+(.*)$/gm, '<blockquote style="border-left: 4px solid #e2e8f0; padding-left: 10px; color: #64748b; margin: 10px 0;">$1</blockquote>');

  // 7. Format Baris Baru (\n)
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.innerHTML = formatText(text);
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

window.onload = async () => {
  await fetchConfig();
  appendMessage('bot', 'Halo! Ada yang bisa saya bantu hari ini? 🚀');
};
