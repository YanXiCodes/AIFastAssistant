const axios = require('axios');

class DeepSeekClient {
  constructor(apiKey, baseUrl = 'https://api.deepseek.com', modelName = 'deepseek-chat') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelName = modelName;
    this.currentRequest = null; // 保存当前请求
  }

  // 取消当前请求
  cancel() {
    if (this.currentRequest) {
      this.currentRequest.destroy();
      this.currentRequest = null;
    }
  }

  async streamChat(message, onChunk, onComplete, onError, conversationHistory = [], onStatus = null) {
    try {
      // 构建消息数组：历史消息 + 当前消息
      const messages = [
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/v1/chat/completions`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: this.modelName,
          messages: messages,
          stream: true,
          temperature: 0.7
        },
        responseType: 'stream'
      });

      // 保存当前请求的 stream
      this.currentRequest = response.data;

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
              const delta = parsed.choices[0]?.delta;

              // 检查是否有推理内容（思考过程）
              if (delta?.reasoning_content) {
                if (onStatus) {
                  onStatus('reasoning', delta.reasoning_content);
                }
              }

              // 检查是否有实际内容
              const content = delta?.content;
              if (content) {
                if (onStatus) {
                  onStatus('generating', null);
                }
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
