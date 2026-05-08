# HireIQ Backend — Specific Rules

## Pattern: asyncHandler
Every controller function is wrapped. Never use raw try/catch inside controllers.
```js
// services/asyncHandler.js
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

## Pattern: Centralized Error Handling
```js
// middleware/error.js
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ success: false, message: err.message });
});
```

## Auth Middleware
```js
// middleware/auth.js — verifies JWT from req.cookies.token
// protect(req, res, next) — attaches req.user
// authorize(...roles) — checks req.user.role
```

## Embedding Rules
- Job embed: inputType: 'search_document' → store in job.embedding
- Search query: inputType: 'search_query' → used only for $vectorSearch, never stored
- User profile embed: inputType: 'search_document' → store in user.profileEmbedding
- Always 1024 dims, model: 'embed-english-v3.0'

## Groq Streaming Pattern
```js
// Use SSE — set headers before streaming
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
const stream = await groq.chat.completions.create({ stream: true, ... });
for await (const chunk of stream) {
  res.write(`data: ${chunk.choices[0]?.delta?.content || ''}\n\n`);
}
res.end();
```

## Vector Search Pipeline
```js
// Always uses: index: 'vector_index', path: 'embedding', numCandidates: 100, limit: 5
{ $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector: [...], numCandidates: 100, limit: 5 } }
```