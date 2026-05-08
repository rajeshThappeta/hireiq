import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// streamChat(messages, res)
// streams SSE to response
// messages format: [{ role: 'user' | 'assistant', content: string }]
export const streamChat = async (messages, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Groq streaming error:", error.message);
    res.write(`data: Error: ${error.message}\n\n`);
    res.end();
  }
};

export default { streamChat };
