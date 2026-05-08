import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["applied", "reviewed"],
      default: "applied",
    },
    coverNote: String,
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide a job title"],
    },
    description: {
      type: String,
      required: [true, "Please provide a job description"],
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    skillsRequired: [String],
    embedding: [Number], // 1024-dim Cohere vector
    applications: [applicationSchema],
  },
  { timestamps: true },
);

export default mongoose.model("Job", jobSchema);
