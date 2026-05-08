import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import { embedText } from "../services/cohere.service.js";
import { vectorSearch } from "../services/vector.service.js";

const router = express.Router();

const strip = (doc) => {
  const obj = doc.toObject();
  delete obj.embedding;
  return obj;
};

// GET /api/jobs
router.get("/", async (req, res) => {
  const jobs = await Job.find().populate("company").populate("applications.applicant", "name email");
  res.json({ success: true, count: jobs.length, data: jobs.map(strip) });
});

// GET /api/jobs/search?q=senior+react+developer&limit=10
router.get("/search", async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q) {
    return res.status(400).json({ success: false, message: "Please provide a search query" });
  }

  const queryVector = await embedText(q.trim(), "search_query");
  const jobs = await vectorSearch(queryVector, Number(limit));

  const data = jobs.map(({ embedding, ...job }) => job);

  res.json({ success: true, count: data.length, data });
});

// GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate("company")
    .populate("applications.applicant", "name email");

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  res.json({ success: true, data: strip(job) });
});

// POST /api/jobs — recruiter/admin only
router.post("/", protect, authorize("recruiter", "admin"), async (req, res) => {
  const { title, description, company, skillsRequired } = req.body;

  if (!title || !description || !company) {
    return res.status(400).json({ success: false, message: "Please provide title, description, and company" });
  }

  const job = await Job.create({ title, description, company, skillsRequired: skillsRequired || [] });

  job.embedding = await embedText(
    `${title} ${description} ${(skillsRequired || []).join(" ")}`,
    "search_document"
  );
  await job.save();

  await User.findByIdAndUpdate(req.user.id, { $push: { postedJobs: job._id } });

  res.status(201).json({ success: true, message: "Job created successfully", data: strip(job) });
});

// PUT /api/jobs/:id — recruiter owner/admin only
router.put("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  let job = await Job.findById(req.params.id).populate("company");

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  if (req.user.role !== "admin" && job.company.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized to update this job" });
  }

  job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

  job.embedding = await embedText(
    `${job.title} ${job.description} ${job.skillsRequired.join(" ")}`,
    "search_document"
  );
  await job.save();

  res.json({ success: true, message: "Job updated successfully", data: strip(job) });
});

// DELETE /api/jobs/:id — recruiter owner/admin only
router.delete("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  const job = await Job.findById(req.params.id).populate("company");

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  if (req.user.role !== "admin" && job.company.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this job" });
  }

  await Job.findByIdAndDelete(req.params.id);
  await User.findByIdAndUpdate(job.company.recruiter, { $pull: { postedJobs: req.params.id } });

  res.json({ success: true, message: "Job deleted successfully" });
});

// PATCH /api/jobs/:id/applications/:appId — update application status (recruiter/admin)
router.patch("/:id/applications/:appId", protect, authorize("recruiter", "admin"), async (req, res) => {
  const { status } = req.body;

  if (!["applied", "reviewed"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be 'applied' or 'reviewed'" });
  }

  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });

  const application = job.applications.id(req.params.appId);
  if (!application) return res.status(404).json({ success: false, message: "Application not found" });

  application.status = status;
  await job.save();

  res.json({ success: true, data: { _id: application._id, status: application.status } });
});

// POST /api/jobs/:id/apply — jobseeker only
router.post("/:id/apply", protect, authorize("jobseeker"), async (req, res) => {
  const { coverNote } = req.body;
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({ success: false, message: "Job not found" });
  }

  if (job.applications.some((app) => app.applicant.toString() === req.user.id)) {
    return res.status(400).json({ success: false, message: "You have already applied for this job" });
  }

  job.applications.push({ applicant: req.user.id, coverNote: coverNote || "" });
  await job.save();

  res.status(201).json({ success: true, message: "Application submitted successfully", data: strip(job) });
});

export default router;
