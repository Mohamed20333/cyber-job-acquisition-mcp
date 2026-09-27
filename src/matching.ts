import { CANDIDATE_PROFILE } from "./candidate";
import type { JobOpportunity } from "./types";

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ");

export function matchJob(job: JobOpportunity) {
  const jobText = normalize(`${job.role} ${job.location ?? ""} ${job.notes ?? ""}`);
  const candidateText = normalize(
    [CANDIDATE_PROFILE.education, ...CANDIDATE_PROFILE.skills, ...CANDIDATE_PROFILE.tools].join(" "),
  );

  const evidence = [...new Set([
    ...CANDIDATE_PROFILE.skills,
    ...CANDIDATE_PROFILE.tools,
  ])];

  const matchedSkills = evidence.filter((skill) =>
    jobText.includes(normalize(skill)),
  );

  const missingSignals = [
    "senior",
    "lead",
    "principal",
    "manager",
    "director",
  ].filter((signal) => jobText.includes(signal));

  const requirements = Math.max(
    1,
    evidence.filter((skill) => jobText.includes(normalize(skill))).length,
  );

  const score = Math.min(
    100,
    Math.round((matchedSkills.length / requirements) * 100),
  );

  const candidateRelevant = CANDIDATE_PROFILE.targetRoles.some((role) =>
    jobText.includes(normalize(role)),
  ) || jobText.includes("cybersecurity") || jobText.includes("security");

  return {
    fitScore: candidateRelevant ? score : Math.min(score, 40),
    matchedSkills,
    seniorityWarnings: missingSignals,
    candidateTextLength: candidateText.length,
  };
}
