# HireIQ — AI-Powered Job Board

A full-stack MERN job board where every AI feature runs on **free-tier APIs**. Jobseekers get AI-matched recommendations, resume skill-gap analysis, and a career chatbot. Recruiters post jobs and manage applications — all in one platform.

---

## Live Features

| Feature | What it does |
|---|---|
| **AI Job Recommendations** | Cohere embeddings + MongoDB Atlas Vector Search matches your skill profile to the top 5 relevant jobs |
| **AI Career Chatbot** | Groq-powered streaming chatbot for career advice, optionally grounded in a specific job posting |
| **AI Job Summarizer** | Streams a 5-bullet summary of any job description |
| **AI Skill-Gap Analysis** | Uploads your resume PDF, extracts text, and streams a matched/missing skills report against a job's requirements |
| **Resume Upload** | PDF stored on Cloudinary; text extracted server-side for skill-gap analysis |
| **Role-Based Access** | Separate flows for jobseekers, recruiters, and admins |
| **Apply & Save Jobs** | Jobseekers apply with a cover note or save jobs for later |
| **Recruiter Dashboard** | Post jobs, manage applications, update application status |

---

## Tech Stack

### Frontend
- **React 19** + **Vite**
- **React Router v7** — client-side routing with protected routes
- **Zustand** — global auth state and UI filters
- **Axios** + **React Query** — server state, caching, mutations
- **Tailwind CSS v4** — utility-first styling
- **react-markdown** — renders AI streamed responses

### Backend
- **Node.js + Express 5**
- **Mongoose** — MongoDB ODM with built-in validation
- **JWT** stored in **httpOnly cookies** (no localStorage)
- **Multer** + **Cloudinary** — resume file upload and storage
- **express-rate-limit** — auth route protection
- **morgan** — request logging
- **pdf-parse** — server-side resume text extraction

### AI Layer (all free tier)
| Service | Role |
|---|---|
| **Cohere `embed-english-v3.0`** | 1024-dim embeddings for jobs and user profiles |
| **Groq `llama-3.1-8b-instant`** | Chatbot, summarizer, skill-gap analysis — all streamed via SSE |
| **MongoDB Atlas Vector Search** | Cosine similarity search against job embeddings |

### Infrastructure
- **MongoDB Atlas M0** (free) — database + vector index
- **Cloudinary** (free tier) — resume storage
- **Vercel** — frontend deployment
- **Render / Railway** — backend deployment

---

## Project Structure

```
HireIQ-app/
├── backend/
│   ├── config/
│   │   ├── db.js                  # Mongoose connect
│   │   └── env.js                 # dotenv setup
│   ├── middleware/
│   │   ├── auth.middleware.js     # protect + authorize
│   │   ├── error.middleware.js    # centralized error handler
│   │   └── upload.middleware.js   # multer config
│   ├── models/
│   │   ├── User.js
│   │   ├── Job.js                 # embeds Application subdocs
│   │   └── Company.js
│   ├── routes/
│   │   ├── auth.routes.js         # register, login, logout
│   │   ├── jobs.routes.js         # CRUD + search
│   │   ├── users.routes.js        # profile, saved jobs
│   │   ├── company.routes.js      # company management
│   │   └── ai.routes.js           # chat, summarize, recommend, skill-gap
│   ├── services/
│   │   ├── cohere.service.js      # embedText(text, inputType)
│   │   ├── groq.service.js        # streamChat(messages, res)
│   │   ├── vector.service.js      # vectorSearch(queryVector, limit)
│   │   └── cloudinary.service.js  # file upload helpers
│   └── server.js                  # express app + route mounting
│
└── frontend/src/
    ├── store/
    │   ├── useAuthStore.js        # user, role, login/logout actions
    │   └── useFilterStore.js      # search filters, UI toggles
    ├── api/
    │   ├── axios.js               # axios instance (baseURL + withCredentials)
    │   └── hooks/                 # React Query hooks
    ├── components/
    │   ├── JobCard.jsx
    │   ├── ChatBot.jsx            # SSE streaming chatbot
    │   ├── ResumeUpload.jsx
    │   ├── SkillGap.jsx           # SSE streaming skill-gap report
    │   ├── Navbar.jsx
    │   ├── ProtectedRoute.jsx
    │   └── Toast.jsx
    ├── pages/
    │   ├── Login.jsx / Register.jsx
    │   ├── Jobs.jsx / JobDetail.jsx
    │   ├── Dashboard.jsx
    │   └── Profile.jsx
    └── App.jsx                    # router + layout
```

---

## API Endpoints

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account (jobseeker / recruiter) |
| POST | `/login` | Authenticate, set httpOnly JWT cookie |
| POST | `/logout` | Clear cookie |

### Jobs — `/api/jobs`
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/` | Public | List all jobs (with filters) |
| GET | `/:id` | Public | Single job detail |
| POST | `/` | Recruiter | Create job + generate embedding |
| PUT | `/:id` | Recruiter | Update job |
| DELETE | `/:id` | Recruiter | Delete job |
| POST | `/:id/apply` | Jobseeker | Apply with cover note |
| POST | `/:id/save` | Jobseeker | Save / unsave job |

### Users — `/api/users`
| Method | Path | Description |
|---|---|---|
| GET | `/me` | Get own profile |
| PUT | `/me` | Update profile + regenerate embedding |
| POST | `/me/resume` | Upload resume PDF to Cloudinary |

### Company — `/api/company`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | Recruiter | Create company |
| GET | `/:id` | Public | Get company profile |

### AI — `/api/ai`
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/chat` | Auth | Career chatbot (SSE stream) |
| POST | `/summarize/:jobId` | Auth | 5-bullet JD summary (SSE stream) |
| GET | `/recommendations` | Jobseeker | Top 5 vector-matched jobs |
| GET | `/skill-gap/:jobId` | Jobseeker | Resume vs. job skills report (SSE stream) |

---

## Data Models

### User
```js
{
  name, email, password,      // String
  role,                       // 'jobseeker' | 'recruiter' | 'admin'
  skills[],                   // [String]
  profileEmbedding[],         // [Number] — 1024-dim Cohere vector
  resumeUrl,                  // String — Cloudinary URL
  savedJobs[],                // [ref: Job]
  postedJobs[]                // [ref: Job] — recruiters only
}
```

### Job
```js
{
  title, description,         // String
  company,                    // ref: Company
  skillsRequired[],           // [String]
  embedding[],                // [Number] — 1024-dim Cohere vector
  applications[]              // [embedded Application subdoc]
}
```

### Application *(embedded in Job — not a separate collection)*
```js
{
  applicant,                  // ref: User
  status,                     // 'applied' | 'reviewed'
  coverNote,                  // String
  appliedAt                   // Date
}
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free M0 cluster)
- Cohere API key — [cohere.com](https://cohere.com)
- Groq API key — [console.groq.com](https://console.groq.com)
- Cloudinary account (free tier)

### 1. Clone & install

```bash
git clone https://github.com/your-username/HireIQ-app.git
cd HireIQ-app

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment variables

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/hireiq
JWT_SECRET=your_jwt_secret_here
COHERE_API_KEY=your_cohere_key
GROQ_API_KEY=your_groq_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:5173
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5001
```

### 3. Set up MongoDB Atlas Vector Search

In your Atlas cluster, create a **Vector Search index** on the `jobs` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```
Name the index `vector_index`.

### 4. Run the app

```bash
# Terminal 1 — backend (http://localhost:5001)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

---

## How the AI Features Work

### Vector Recommendations
1. When a jobseeker updates their profile skills, a Cohere `search_document` embedding is generated and stored as `user.profileEmbedding`.
2. When a job is posted, a `search_document` embedding of the title + description + skills is stored as `job.embedding`.
3. `/api/ai/recommendations` runs `$vectorSearch` on Atlas using the user's profile embedding → returns top 5 cosine-similar jobs.

### Skill-Gap Analysis
1. Jobseeker uploads a PDF resume → stored on Cloudinary, URL saved on user.
2. On request, the server fetches the PDF, extracts text with `pdf-parse`, and sends a structured prompt to Groq.
3. Groq streams back a three-section report (matched skills, missing skills, recommendations) via SSE.

### Career Chatbot
- Accepts a `messages` array (conversation history) and an optional `jobId`.
- If a `jobId` is provided, the job's title, skills, and description are injected into the system prompt for context-aware advice.
- Response streams chunk-by-chunk to the frontend via SSE.

---

## Deployment

### Backend (Render / Railway)
- Set all environment variables from `backend/.env`
- Start command: `node server.js`
- Add your deployed frontend URL to `CLIENT_URL`

### Frontend (Vercel)
- Set `VITE_API_URL` to your deployed backend URL
- Framework preset: **Vite**

---

## License

MIT
