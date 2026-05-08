import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import Company from "../models/Company.js";

const router = express.Router();

// POST /api/company — recruiter/admin only
router.post("/", protect, authorize("recruiter", "admin"), async (req, res) => {
  const { name, about } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Please provide a company name" });
  }

  const company = await Company.create({ name, about: about || "", recruiter: req.user.id });

  res.status(201).json({ success: true, message: "Company created successfully", data: company });
});

// GET /api/company — public
router.get("/", async (req, res) => {
  const companies = await Company.find().populate("recruiter", "name email");
  res.json({ success: true, count: companies.length, data: companies });
});

// GET /api/company/:id — public
router.get("/:id", async (req, res) => {
  const company = await Company.findById(req.params.id).populate("recruiter", "name email");

  if (!company) {
    return res.status(404).json({ success: false, message: "Company not found" });
  }

  res.json({ success: true, data: company });
});

// PUT /api/company/:id — recruiter owner/admin only
router.put("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  let company = await Company.findById(req.params.id);

  if (!company) {
    return res.status(404).json({ success: false, message: "Company not found" });
  }

  if (req.user.role !== "admin" && company.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized to update this company" });
  }

  company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

  res.json({ success: true, message: "Company updated successfully", data: company });
});

// DELETE /api/company/:id — recruiter owner/admin only
router.delete("/:id", protect, authorize("recruiter", "admin"), async (req, res) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    return res.status(404).json({ success: false, message: "Company not found" });
  }

  if (req.user.role !== "admin" && company.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this company" });
  }

  await Company.findByIdAndDelete(req.params.id);

  res.json({ success: true, message: "Company deleted successfully" });
});

export default router;
