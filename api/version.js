// GET /api/version
// Bank compliance audit trail: reviewers need to pin "the version we
// reviewed on day X" to a specific git SHA. /api/health gives status,
// /api/badge gives current score, this gives the version they
// reviewed against. Vercel sets VERCEL_GIT_COMMIT_SHA at build time.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");

  return res.status(200).json({
    service: "shadow-mentor",
    package_version: "1.0.0",
    rubric_version: "0.3.3",
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    git_branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    git_message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    deployment_url: process.env.VERCEL_URL ?? null,
    deployment_region: process.env.VERCEL_REGION ?? null,
    node_version: process.version,
    timestamp: new Date().toISOString()
  });
}
