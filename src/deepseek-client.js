const axios = require('axios');

class DeepSeekClient {
  constructor(apiKey, baseUrl = 'https://api.deepseek.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async streamChat(message, onChunk, onComplete, onError) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v1/chat/completions`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: message }],
          stream: true,
          temperature: 0.7
        },
        responseType: 'stream'
      });

      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onComplete();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('end', () => {
        onComplete();
      });

      response.data.on('error', (error) => {
        onError(error);
      });

    } catch (error) {
      onError(error);
    }
  }
}

module.exports = DeepSeekClient;
