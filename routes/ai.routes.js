import express from "express";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { protect, authorize } from "../middleware/auth.middleware.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import { streamChat } from "../services/groq.service.js";
import { vectorSearch } from "../services/vector.service.js";

const router = express.Router();

// POST /api/ai/summarize/:jobId — stream 5-bullet JD summary
router.post("/summarize/:jobId", protect, async (req, res) => {
  const job = await Job.findById(req.params.jobId).select("title description skillsRequired");

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  const prompt = `You are a concise job description summarizer. Summarize the following job posting into exactly 5 bullet points. Each bullet should highlight a key responsibility, requirement, or benefit. Be specific and brief.

Job Title: ${job.title}
Skills Required: ${job.skillsRequired.join(", ") || "Not specified"}

Job Description:
${job.description}

Respond with exactly 5 bullet points, each starting with "•".`;

  await streamChat([{ role: "user", content: prompt }], res);
});

// POST /api/ai/chat — career chatbot with optional job RAG context, streams SSE
// Body: { messages: [{role, content}], jobId? }
router.post("/chat", protect, async (req, res) => {
  const { messages, jobId } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: "messages must be a non-empty array" });
  }

  let systemContent =
    "You are a helpful career advisor. Answer questions about job searching, interviews, resumes, career growth, and skills development. Be concise, specific, and encouraging.";

  if (jobId) {
    const job = await Job.findById(jobId).select("title description skillsRequired");
    if (job) {
      systemContent =
        `You are a helpful career advisor with context about a specific job posting. Use this context to give targeted advice.\n\n` +
        `Job Title: ${job.title}\n` +
        `Skills Required: ${job.skillsRequired.join(", ") || "Not specified"}\n` +
        `Job Description: ${job.description}\n\n` +
        `Answer questions about this role, how to prepare, what skills to highlight, interview tips, and fit assessment.`;
    }
  }

  const fullMessages = [{ role: "system", content: systemContent }, ...messages];

  await streamChat(fullMessages, res);
});

// GET /api/ai/recommendations — top 5 jobs matching user's profileEmbedding
router.get("/recommendations", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("profileEmbedding");

  if (!user.profileEmbedding || user.profileEmbedding.length !== 1024) {
    return res.json({
      success: true,
      count: 0,
      data: [],
      message: "Add skills to your profile to get personalised job recommendations.",
    });
  }

  const jobs = await vectorSearch(user.profileEmbedding, 5);
  const data = jobs.map(({ embedding, similarityScore, ...job }) => job);

  res.json({ success: true, count: data.length, data });
});

// GET /api/ai/skill-gap/:jobId — uses resume stored in user profile → Groq gap report (SSE)
router.get("/skill-gap/:jobId", protect, authorize("jobseeker"), async (req, res) => {
  const [user, job] = await Promise.all([
    User.findById(req.user.id).select("resumeUrl"),
    Job.findById(req.params.jobId).select("title skillsRequired"),
  ]);

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  if (!user.resumeUrl) {
    return res.status(400).json({ success: false, message: "Please upload your resume in your profile first." });
  }

  const pdfRes = await fetch(user.resumeUrl);
  const buffer = Buffer.from(await pdfRes.arrayBuffer());
  const { text } = await pdfParse(buffer);

  if (!text || text.trim().length < 50) {
    return res.status(422).json({ success: false, message: "Could not extract readable text from your resume." });
  }

  const prompt =
    `You are a career coach performing a skill-gap analysis.\n\n` +
    `Job Title: ${job.title}\n` +
    `Required Skills: ${job.skillsRequired.join(", ") || "Not specified"}\n\n` +
    `Resume Text:\n${text.slice(0, 6000)}\n\n` +
    `Produce a concise skill-gap report with three sections:\n` +
    `1. ✅ Matched Skills — skills from the resume that match the job requirements\n` +
    `2. ❌ Missing Skills — required skills not evident in the resume\n` +
    `3. 📋 Recommendations — 3-5 specific action items to close the gap`;

  await streamChat([{ role: "user", content: prompt }], res);
});

export default router;
