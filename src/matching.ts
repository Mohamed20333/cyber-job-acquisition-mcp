import { CANDIDATE_PROFILE } from "./candidate";
import type { JobOpportunity } from "./types";

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ");

export function matchJob(job: JobOpportunity) {
  const jobText = normalize(`${job.role} ${job.location ?? ""} ${job.notes ?? ""}`);
  const evidence = [...new Set([
    ...CANDIDATE_PROFILE.skills,
    ...CANDIDATE_PROFILE.tools,
  ])];

  const detectedRequirements = evidence.filter((skill) =>
    jobText.includes(normalize(skill)),
  );

  const matchedSkills = detectedRequirements.filter((skill) =>
    normalize(
      [CANDIDATE_PROFILE.education, ...CANDIDATE_PROFILE.skills, ...CANDIDATE_PROFILE.tools].join(" "),
    ).includes(normalize(skill)),
  );

  const roleMatch = CANDIDATE_PROFILE.targetRoles.some((role) =>
    jobText.includes(normalize(role)),
  );

  const seniorityWarnings = [
    "senior",
    "lead",
    "principal",
    "manager",
    "director",
  ].filter((signal) => jobText.includes(signal));

  const skillScore = detectedRequirements.length
    ? Math.round((matchedSkills.length / detectedRequirements.length) * 100)
    : 0;

  const fitScore = Math.min(
    100,
    Math.max(0, skillScore + (roleMatch ? 15 : 0) - (seniorityWarnings.length ? 25 : 0)),
  );

  return {
    fitScore,
    matchedSkills,
    detectedRequirements,
    roleMatch,
    seniorityWarnings,
  };
}
