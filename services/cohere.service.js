import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// embedText(text, inputType)
// inputType: 'search_document' or 'search_query'
// returns 1024-dim vector
export const embedText = async (text, inputType = "search_query") => {
  try {
    const response = await cohere.embed({
      model: "embed-english-v3.0",
      texts: [text],
      inputType: inputType,
    });

    return response.embeddings[0]; // 1024-dim array
  } catch (error) {
    console.error("Cohere embed error:", error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

export default { embedText };
