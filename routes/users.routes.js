import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import { embedText } from "../services/cohere.service.js";
import { uploadResume } from "../services/cloudinary.service.js";

const router = express.Router();

// GET /api/users/profile
router.get("/profile", protect, async (req, res) => {
  const isRecruiter = req.user.role === "recruiter";

  const user = await User.findById(req.user.id)
    .select(isRecruiter ? "-password -profileEmbedding -savedJobs" : "-password -profileEmbedding -postedJobs")
    .populate(isRecruiter ? "postedJobs" : "savedJobs");

  res.json({ success: true, data: user });
});

// PUT /api/users/profile — jobseeker only (name, skills, optional resume PDF)
router.put("/profile", protect, authorize("jobseeker"), upload.single("resume"), async (req, res) => {
  const { name, email } = req.body;
  const skills = req.body.skills ? JSON.parse(req.body.skills) : [];

  const updateData = {};
  if (name)  updateData.name  = name;
  if (email) updateData.email = email;
  updateData.skills = skills;

  await Promise.all([
    skills.length > 0
      ? embedText(skills.join(" "), "search_document")
          .then((emb) => { updateData.profileEmbedding = emb; })
          .catch((err) => console.error("Embedding failed:", err.message))
      : Promise.resolve(),

    req.file
      ? uploadResume(req.file.buffer, req.user.id)
          .then((url) => { updateData.resumeUrl = url; })
          .catch((err) => console.error("Cloudinary upload failed:", err.message))
      : Promise.resolve(),
  ]);

  const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true })
    .select("-password -profileEmbedding -postedJobs");

  res.json({ success: true, message: "Profile updated successfully", data: user });
});

// POST /api/users/resume — Sub-flow A: Multer → Cloudinary → store URL on user
router.post("/resume", protect, authorize("jobseeker"), upload.single("resume"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a PDF resume" });
  }

  const resumeUrl = await uploadResume(req.file.buffer, req.user.id);
  const user = await User.findByIdAndUpdate(req.user.id, { resumeUrl }, { new: true });

  res.json({ success: true, message: "Resume uploaded successfully", data: { resumeUrl: user.resumeUrl } });
});

// GET /api/users/saved/jobs — must be before /:id
router.get("/saved/jobs", protect, authorize("jobseeker"), async (req, res) => {
  const user = await User.findById(req.user.id).populate("savedJobs");
  res.json({ success: true, count: user.savedJobs.length, data: user.savedJobs });
});

// POST /api/users/saved/:jobId
router.post("/saved/:jobId", protect, authorize("jobseeker"), async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.savedJobs.includes(req.params.jobId)) {
    return res.status(400).json({ success: false, message: "Job already saved" });
  }

  user.savedJobs.push(req.params.jobId);
  await user.save();

  res.json({ success: true, message: "Job saved successfully", data: user.savedJobs });
});

// DELETE /api/users/saved/:jobId
router.delete("/saved/:jobId", protect, authorize("jobseeker"), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { savedJobs: req.params.jobId } },
    { new: true }
  );
  res.json({ success: true, message: "Job unsaved successfully", data: user.savedJobs });
});

// GET /api/users/applications — jobs the jobseeker has applied to
router.get("/applications", protect, authorize("jobseeker"), async (req, res) => {
  const jobs = await Job.find({ "applications.applicant": req.user.id })
    .populate("company")
    .select("title company applications");

  const data = jobs.map((job) => {
    const application = job.applications.find(
      (a) => a.applicant.toString() === req.user.id
    );
    return {
      _id: application._id,
      job: { _id: job._id, title: job.title, company: job.company },
      status: application.status,
      appliedAt: application.appliedAt,
    };
  });

  res.json({ success: true, count: data.length, data });
});

// GET /api/users/posted-jobs — jobs posted by this recruiter
router.get("/posted-jobs", protect, authorize("recruiter"), async (req, res) => {
  const user = await User.findById(req.user.id).populate({
    path: "postedJobs",
    populate: { path: "company", select: "name" },
  });

  res.json({ success: true, count: user.postedJobs.length, data: user.postedJobs });
});

// GET /api/users/:id — public
router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ success: true, data: user });
});

export default router;
