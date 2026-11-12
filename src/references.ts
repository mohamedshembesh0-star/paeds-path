import type { BlockName, Topic } from "./types";

export type TopicReference = {
  title: string;
  organization: string;
  url: string;
  note: string;
};

export type SynthesisPrompt = {
  title: string;
  question: string;
  source: BlockName;
  answers: string[];
};

const AAP_GUIDELINES =
  "https://publications.aap.org/collection/523/Clinical-Practice-Guidelines";

const TOPIC_SOURCES: Array<{
  matches: RegExp;
  reference: TopicReference;
}> = [
  {
    matches: /well-appearing febrile infant|febrile infant/i,
    reference: {
      title: "Evaluation of well-appearing febrile infants",
      organization: "American Academy of Pediatrics",
      url: "https://www.aap.org/en/patient-care/infant-fever",
      note: "This guideline applies to specific well-appearing infants aged 8–60 days; check its inclusion criteria.",
    },
  },
  {
    matches: /immuni[sz]ation|vaccine/i,
    reference: {
      title: "Child and adolescent immunization schedules",
      organization: "CDC",
      url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/",
      note: "Schedules and addenda can change. Check the current schedule and applicable state requirements.",
    },
  },
  {
    matches: /development|psychomotor|growth percentile|short stature|anthropometry/i,
    reference: {
      title: "Growth charts and developmental milestone checklists",
      organization: "CDC",
      url: "https://www.cdc.gov/growthcharts/",
      note: "Use the appropriate chart and age-specific developmental resource.",
    },
  },
  {
    matches: /newborn screening/i,
    reference: {
      title: "Newborn screening programs and recommended screening panel",
      organization: "HRSA",
      url: "https://mchb.hrsa.gov/programs/newborn-screening",
      note: "Screening panels and follow-up pathways vary by state and are updated over time.",
    },
  },
  {
    matches: /neonatal and infant resuscitation|newborn resuscitation/i,
    reference: {
      title: "2025 neonatal resuscitation guidelines",
      organization: "AAP and American Heart Association",
      url: "https://www.aap.org/en/pedialink/neonatal-resuscitation-program/neonatal-resuscitation-guidelines",
      note: "The 2025 joint guideline is the current source linked here; use local neonatal protocols in practice.",
    },
  },
  {
    matches: /pediatric resuscitation|pediatric advanced life support|arrhythmia/i,
    reference: {
      title: "Pediatric Advanced Life Support guidelines",
      organization: "American Heart Association and AAP",
      url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/pediatric-advanced-life-support",
      note: "2025 guidance. The algorithms and doses require current training materials and local protocols.",
    },
  },
  {
    matches: /sepsis|septic shock/i,
    reference: {
      title: "Surviving Sepsis Campaign pediatric guidelines",
      organization: "Society of Critical Care Medicine",
      url: "https://www.sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-pediatric-guidelines",
      note: "Check the publication date and local sepsis pathway before applying recommendations.",
    },
  },
  {
    matches: /asthma/i,
    reference: {
      title: "Asthma management guideline resources",
      organization: "NHLBI / NIH",
      url: "https://www.nhlbi.nih.gov/health-topics/asthma-management-guidelines-2020-updates",
      note: "The linked U.S. focused updates are from 2020; check for newer guidance and local formularies.",
    },
  },
  {
    matches: /leukaemia|leukemia|lymphoma|neuroblastoma|wilms tumour|wilms tumor|malignan|cancer|chemotherapy|bone and soft tissue tumour|bone and soft tissue tumor|cns tumour|cns tumor/i,
    reference: {
      title: "Pediatric cancer treatment summaries",
      organization: "National Cancer Institute",
      url: "https://www.cancer.gov/publications/pdq/information-summaries/pediatric-treatment",
      note: "NCI PDQ summaries are reviewed and updated; check the version date and disease subtype.",
    },
  },
  {
    matches: /kidney|renal|nephro|urinary tract infection|proteinuria|haematuria|hematuria/i,
    reference: {
      title: "Kidney disease in children",
      organization: "NIDDK / NIH",
      url: "https://www.niddk.nih.gov/health-information/kidney-disease/children",
      note: "A general pediatric kidney resource; it does not replace a condition-specific guideline.",
    },
  },
  {
    matches: /diabetes mellitus|type 2 diabetes|diabetic ketoacidosis|diabetes insipidus/i,
    reference: {
      title: "Diabetes information and resources",
      organization: "NIDDK / NIH",
      url: "https://www.niddk.nih.gov/health-information/diabetes",
      note: "Confirm pediatric-specific recommendations, current protocols, and local dosing references.",
    },
  },
  {
    matches: /\bhiv\b/i,
    reference: {
      title: "Pediatric HIV antiretroviral guidelines",
      organization: "NIH ClinicalInfo",
      url: "https://clinicalinfo.hiv.gov/en/guidelines/pediatric-arv",
      note: "Living guidance; check the latest version and the specific age/weight recommendations.",
    },
  },
  {
    matches: /lyme|borreliosis/i,
    reference: {
      title: "Lyme disease clinical resources",
      organization: "CDC",
      url: "https://www.cdc.gov/lyme/hcp/communication-resources/index.html",
      note: "Includes clinician resources; verify the manifestation, geography, and current recommendations.",
    },
  },
  {
    matches: /influenza/i,
    reference: {
      title: "Influenza antiviral guidance for clinicians",
      organization: "CDC",
      url: "https://www.cdc.gov/flu/hcp/antivirals/summary-clinicians.html",
      note: "Recommendations can change each season; check the current season's guidance.",
    },
  },
  {
    matches: /attention deficit|adhd/i,
    reference: {
      title: "ADHD clinical guidance",
      organization: "American Academy of Pediatrics",
      url: "https://www.aap.org/en/patient-care/attention-deficit-hyperactivity-disorder-adhd",
      note: "Use the current guideline and assess comorbidities and the child's age and context.",
    },
  },
  {
    matches: /celiac/i,
    reference: {
      title: "Celiac disease",
      organization: "NIDDK / NIH",
      url: "https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease",
      note: "A federal health information resource; confirm diagnostic and management details in current guidance.",
    },
  },
];

function pubmedSearch(topic: Topic): string {
  const term = `(${topic.title}) AND (child OR pediatric OR paediatric OR infant) AND (guideline OR consensus OR clinical practice)`;
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`;
}

export function getTopicReferences(topic: Topic): TopicReference[] {
  const matched = TOPIC_SOURCES
    .filter(({ matches }) => matches.test(topic.title))
    .map(({ reference }) => reference);

  return [
    ...matched,
    {
      title: "AAP clinical practice guideline directory",
      organization: "American Academy of Pediatrics",
      url: AAP_GUIDELINES,
      note: "A discovery index; not every topic has a dedicated AAP guideline.",
    },
    {
      title: `Search pediatric guidelines for “${topic.title}”`,
      organization: "PubMed / U.S. National Library of Medicine",
      url: pubmedSearch(topic),
      note: "A topic-specific literature search, not a curated or endorsed guideline.",
    },
  ];
}

export function getSynthesisPrompts(topic: Topic): SynthesisPrompt[] {
  const prompts: Array<{
    title: string;
    question: string;
    source: BlockName;
    limit: number;
  }> = [
    {
      title: "Frame the problem",
      question: "Give a concise problem representation before opening the notes.",
      source: "Def",
      limit: 2,
    },
    {
      title: "Prioritize the differential",
      question: "Name the important causes you would keep in the differential.",
      source: "Cause",
      limit: 3,
    },
    {
      title: "Find the discriminating clues",
      question: "Which history or examination findings would change your thinking?",
      source: "Signs",
      limit: 3,
    },
    {
      title: "Choose the diagnostic anchor",
      question: "What diagnostic step or interpretation matters most?",
      source: "Dx",
      limit: 3,
    },
    {
      title: "State an initial plan",
      question: "What management principle is recorded in the source notes?",
      source: "Rx",
      limit: 3,
    },
  ];

  return prompts.flatMap(({ title, question, source, limit }) => {
    const answers = topic.blocks[source].filter((line) => line.trim()).slice(0, limit);
    return answers.length ? [{ title, question, source, answers }] : [];
  });
}
