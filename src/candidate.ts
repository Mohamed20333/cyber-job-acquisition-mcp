import type { CandidateProfile } from "./types";

export const CANDIDATE_PROFILE: CandidateProfile = {
  name: "Mohamed Mosliem Elsharkawy",
  education: "BSc (Hons) Cyber Security and Networks student at EUE, with planned UEL progression",
  targetRoles: [
    "Cybersecurity",
    "Red Team",
    "Penetration Testing",
    "SOC Analyst",
    "Security Engineer",
    "Network Security",
    "Junior Cybersecurity",
    "Intern",
    "Trainee",
  ],
  targetMarkets: [
    "United Kingdom",
    "Egypt",
    "Europe",
    "Middle East",
    "International Remote",
  ],
  skills: [
    "Cybersecurity fundamentals",
    "Network security fundamentals",
    "Linux",
    "Python",
    "NIST CSF",
    "Kali Linux",
    "Burp Suite",
    "Nmap",
    "OSINT and reconnaissance",
    "Subfinder",
    "Hashcat",
    "Password hashing fundamentals",
    "Basic penetration testing",
    "Red Team workflow",
    "Active Directory fundamentals",
    "Windows Server fundamentals",
    "IIS fundamentals",
    "pfSense",
    "CTF practice",
  ],
  tools: [
    "Kali Linux",
    "Burp Suite",
    "Nmap",
    "Subfinder",
    "Hashcat",
    "Wireshark",
    "pfSense",
  ],
  experienceNotes: [
    "Student and project-based cybersecurity experience.",
    "Do not represent coursework or training as professional employment or a certification unless explicitly verified.",
  ],
};

export function candidateSearchText(): string {
  return [
    CANDIDATE_PROFILE.education,
    ...CANDIDATE_PROFILE.targetRoles,
    ...CANDIDATE_PROFILE.skills,
    ...CANDIDATE_PROFILE.tools,
  ].join(" ");
}
