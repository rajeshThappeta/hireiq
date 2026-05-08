import Job from "../models/Job.js";

const MIN_SIMILARITY = 0.70;

// vectorSearch(queryVector, limit)
// Tries Atlas $vectorSearch first, falls back to in-process cosine similarity
export const vectorSearch = async (queryVector, limit = 5) => {
  if (!Array.isArray(queryVector) || queryVector.length !== 1024) {
    throw new Error("queryVector must be a 1024-dimensional array");
  }

  try {
    const results = await Job.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector,
          numCandidates: 100,
          limit,
        },
      },
      { $addFields: { similarityScore: { $meta: "vectorSearchScore" } } },
      { $match: { similarityScore: { $gte: MIN_SIMILARITY } } },
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
    ]);

    return results;
  } catch (error) {
    console.warn("Atlas $vectorSearch unavailable, using cosine similarity fallback:", error.message);
    return cosineSimilaritySearch(queryVector, limit);
  }
};

// Fallback: fetch all jobs with embeddings and rank by cosine similarity in memory
const cosineSimilaritySearch = async (queryVector, limit) => {
  const jobs = await Job.find({ embedding: { $exists: true, $ne: [] } })
    .populate("company")
    .lean();

  return jobs
    .map((job) => ({ ...job, similarityScore: cosineSimilarity(queryVector, job.embedding) }))
    .filter((job) => job.similarityScore >= MIN_SIMILARITY)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
};

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] ** 2;
    magB += vecB[i] ** 2;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

export default { vectorSearch };
