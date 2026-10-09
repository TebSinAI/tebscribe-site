# HL7 FHIR CPG as a foundation for TebScribe Open Clinical Pathways — feasibility assessment

- Prepared: 2026-10-09 · branch `it/care-paths` · phase: research only (no implementation, no prod contact)
- Audience: founder (Dr. Mohammad Chelehmalzadeh), engineering
- Location note: this file lives in `_research/`, which Jekyll/GitHub Pages does not publish (underscore folders are excluded by default). It is internal.
- Verification note: facts marked **[verified 2026-10-09]** were read from the official page on that date. Everything else is from working knowledge of the standards and should be re-checked before it is relied on in a contract, filing or public statement.

---

## 0. Bottom line (one paragraph)

**Recommendation: GO — conditional, as an interchange and authoring standard, not as a runtime we depend on end to end.**
HL7 FHIR CPG (v2.0.0, STU2) is the only mature, openly licensed (CC0), internationally used standard for writing clinical guidelines as machine-readable, versioned, citable pathways — WHO's SMART Guidelines programme is built on it. It solves *representation* well (pathways, decision logic in CQL, citations, versions, local adaptations). It does **not** solve the things that matter most for TebScribe's vision: clinician identity verification and review governance, licensed-guideline access (most society guidelines are copyrighted), automated update monitoring, safe coupling to LLMs, or any form of clinical authority. Those are the product. Recommended next phase: a small, internal, flag-OFF proof of concept that encodes **one** founder-chosen, openly licensed pathway in CPG format, runs it through an open-source engine, and exposes it to tebIQ as a deterministic "rail" the LLM must cite — no public launch, no community, no claims.

---

## 1. Spec review — what HL7 FHIR CPG actually is

### 1.1 Identity and status
| Item | Value |
|---|---|
| Name | HL7 FHIR® Implementation Guide: Clinical Practice Guidelines (CPG-on-FHIR), package `hl7.fhir.uv.cpg` |
| Current release | **2.0.0 — STU2 (Standard for Trial Use), published 2024-11-26** [verified 2026-10-09] |
| FHIR base | **R4 (4.0.1)** [verified] |
| Dependencies | `hl7.terminology.r4` 6.1.0, `hl7.fhir.uv.extensions.r4` 5.1.0 [verified] |
| Owner | HL7 Clinical Decision Support Work Group |
| CI build | still labelled "continuous build for version 2.0.0" — no STU3 ballot visible [verified] |
| Canonical URL | http://hl7.org/fhir/uv/cpg |

### 1.2 Normative vs trial-use (what is stable, what can still change)
| Component | Status | What it means for us |
|---|---|---|
| CPG IG itself | **Trial use (STU2)** | Can change in breaking ways in STU3/normative. Pin the version. |
| PlanDefinition (R4) | **Trial use, maturity level 2** [verified] | The core "pathway" resource is not frozen. |
| ActivityDefinition, Library, RequestGroup/RequestOrchestration | Trial use | Same. |
| Evidence / EvidenceVariable / Citation | **Trial use, maturity level 1 in R5** [verified]; R4's Evidence was substantially reworked in R4B/R5 | The weakest link. Evidence modelling is the least mature part of the stack. |
| CQL (Clinical Quality Language) | **Mixed.** CQL 2.0.0 published 2026-07-29 as a trial-use release; "normative elements … remain normative" from 1.5 [verified] | The core expression language is the most stable piece. Newer features are trial use. |
| FHIR R4 base (Patient, Observation, Condition, etc.) | Core resources normative | Patient data layer is stable. |
| CDS Hooks 2.0.1 | **STU2** [verified] | Standard way to push recommendations into EHR workflow; has structured override/feedback. |

**Takeaway:** nothing in the decision-support layer is normative except core CQL. Building on it is normal practice (WHO, CDC, AHRQ all do) but every artifact must declare the exact IG/FHIR/CQL versions it targets.

### 1.3 Public availability and reuse
- The full IG, profiles, examples and downloadable package (NPM/`tgz`, JSON/XML definitions) are free to download with no login [verified: downloads page linked from the IG].
- Reference artifacts: `HL7/cqf-recommendations` (IG source, worked examples), `cqframework/cpg-example` (starter repo/template for authoring a CPG-conformant guideline IG). Both are public on GitHub.

### 1.4 Licences, attribution and restrictions
| Item | Terms | Action for TebScribe |
|---|---|---|
| FHIR specification and CPG IG | **CC0 "No Rights Reserved"** [verified] | Free to use, copy, derive, commercialise. |
| HL7 conditions | May not claim HL7 endorsement; altered versions must be clearly marked as derivatives; may not redefine FHIR conformance [verified] | Never say "HL7-certified/approved". |
| Trademarks "HL7", "FHIR", flame logo | Write "HL7® FHIR® standard"; include "HL7, FHIR and the FHIR [FLAME DESIGN] are registered trademarks of Health Level Seven International"; **written HL7 permission required to use the marks in product, event or domain names** [verified] | **"TebScribe Open Clinical Pathways" is fine; "FHIR Pathways by TebScribe" or a `fhir…` domain would need HL7 permission.** |
| CDS Hooks | © HL7 International & Boston Children's Hospital, **CC BY 4.0** [verified] | Attribution required if we republish text. |
| CQL spec | HL7-published, CDS WG; licence on the spec's licence page (HL7 specs are generally CC0) | Re-check the CQL licence page before redistribution. |
| LOINC, UCUM | Regenstrief licence — free, attribution/notice required [verified notice in IG] | Carry the notice in any distribution. |
| **SNOMED CT** | **Not free worldwide.** Requires SNOMED International affiliate licence; free only in member countries [verified notice in IG] | Real constraint for a *global* open repository — see gap G6. |
| RxNorm (US drugs) | UMLS licence (free, registration) | Same caution. |
| Engines | Apache 2.0 (clinical-reasoning, cqf-ruler, cql-execution, cql-engine) [verified] | Commercial use fine; keep NOTICE files. |
| **Guideline content itself** | Owned by each society/publisher (e.g. AHA, ACEP, NICE, IDSA) — **CC0 on the format gives zero rights to the content** | The biggest legal constraint. See G5. |

---

## 2. Technical deep-dive — how the resources fit together

### 2.1 The four knowledge levels and CPG profile categories
CPG follows the L1–L4 knowledge-representation ladder (also used by WHO SMART Guidelines):
- **L1 Narrative** — the published guideline (PDF/web).
- **L2 Semi-structured** — human-readable decision tables, flowcharts, data dictionaries (WHO calls this the "Digital Adaptation Kit").
- **L3 Structured / computable** — FHIR resources + CQL that faithfully encode L2.
- **L4 Executable** — L3 localised and running inside a specific system.

CPG profiles are grouped as **Shareable → Publishable → Computable → Executable** [verified], each adding obligations (metadata → narrative/citations/approval → logic → bound data requirements).

### 2.2 Resource map
```
               ┌──────────────────────────── cpg-computableguideline (PlanDefinition, type=clinical-protocol)
               │      metadata: url, version, status, approvalDate, lastReviewDate,
               │      author/reviewer/editor/endorser, relatedArtifact (citations), useContext (region/setting)
               │
               ├── action[] ──► cpg-recommendationdefinition (PlanDefinition, type=eca-rule)
               │                  condition (applicability)  ──► expression in Library (CQL)
               │                  action.definitionCanonical ──► ActivityDefinition (what to propose)
               │                  documentation ──► Evidence / Citation / ArtifactAssessment (strength, certainty)
               │
               ├── cpg-pathwaydefinition / cpg-strategydefinition (PlanDefinition grouping recommendations)
               │
               ├── Library (cpg-computablelibrary / cpg-executablelibrary)
               │      content: CQL text (+ compiled ELM JSON) · dataRequirement[] · relatedArtifact → ValueSets, other Libraries
               │
               ├── ValueSet / CodeSystem (cpg-computablevalueset) — LOINC, SNOMED, ICD-10, RxNorm
               │
               └── Case features: cpg-casefeaturedefinition (StructureDefinition/Observation profiles)
                      = the patient facts the logic needs (e.g. "suspected sepsis", "lactate > 4")

Run time:   PlanDefinition/$apply(subject=Patient)  ──►  engine evaluates CQL against patient data
            ──► RequestGroup/RequestOrchestration + CommunicationRequest/ServiceRequest/... proposals
            ──► (optional) CDS Hooks card in the EHR · clinician accepts / overrides with reason
            ──► GuidanceResponse / Provenance / AuditEvent record what fired and why
```

### 2.3 Executable decision logic
- Logic is written in **CQL**, a declarative, side-effect-free, typed language designed for clinicians/informaticists to read. CQL is compiled to **ELM** (JSON/XML expression trees) which engines execute.
- Determinism: given the same patient data, terminology and library versions, CQL output is deterministic. That is the property TebScribe wants for "rails" an LLM must not override.
- Data access goes through FHIR "retrieve" statements against a model (QI-Core / FHIR R4); terminology checks go through ValueSets — so a pathway's behaviour also depends on the **terminology server version**. Pin it.
- Limits: CQL does not do free text, probabilistic reasoning, or anything outside the data model. Questions such as "does this note suggest sepsis?" must be turned into structured case features first — which is exactly where tebIQ's LLM would sit (and where risk sits; see G8).

### 2.4 Version control and change history
- Every knowledge artifact carries `url` (stable identity) + `version` (semver recommended) + `status` (draft/active/retired) + `date`, `approvalDate`, `lastReviewDate`, `effectivePeriod`.
- References between artifacts use **versioned canonicals** (`http://…/PlanDefinition/sepsis|1.2.0`), so a pathway can pin exact library/value-set versions.
- IGs are published as **NPM packages** built from Git (FSH/FHIR Shorthand + IG Publisher) — so Git history + tagged package releases give a complete, diffable audit trail. CPG adds `knowledgeCapability`/`knowledgeRepresentationLevel` extensions and change notes.
- What it does not give: a workflow engine for "who approved which line, when, with what credentials" — Git PRs give that only if we add identity verification (G1).

### 2.5 Evidence and provenance representation
- `relatedArtifact` (type citation/justification/derived-from/documentation) links every recommendation to sources.
- **Evidence**, **EvidenceVariable**, **Citation**, **ArtifactAssessment** (R5 names, back-ported to R4 via cross-version extensions) model effect estimates, GRADE certainty and recommendation strength — this is the EBM-on-FHIR work.
- `Provenance` + `AuditEvent` record who authored/changed artifacts and what fired at run time. `GuidanceResponse` captures a decision-support result.
- Maturity: Evidence is FMM 1 [verified]. Practically, most real CPG implementations cite sources with `relatedArtifact` and do not encode full Evidence resources. Expect to do the same initially.

### 2.6 Regional and institutional adaptation
- `useContext` / `jurisdiction` scope artifacts by country, setting (ED, ICU), population.
- Adaptation pattern (WHO SMART): a **base IG** (global) is depended on by a **national/local IG** that overrides value sets, thresholds or actions while keeping the base's identity and citing deviations. This maps directly to "regional and institutional adaptations".

---

## 3. Execution-engine survey

| # | Engine | Language / licence | Maturity | Deployment pattern | Fit for AI / external systems |
|---|---|---|---|---|---|
| 1 | **CQF Clinical-Reasoning** (`cqframework/clinical-reasoning`) — the reference implementation of `PlanDefinition/$apply`, `Library/$evaluate`, `Measure/$evaluate` | Java 17+, Apache 2.0 [verified]; maintained by Smile Digital Health, commercial support via Alphora [verified] | **Highest.** Reference engine used for CMS eCQMs and CPG test cases; R4 + R5 | Embedded inside HAPI FHIR JPA server (`hapi-fhir-jpaserver-starter`) as FHIR operations; Docker | Very good: plain REST/FHIR operations any service (incl. Python backend or an LLM tool call) can invoke. Needs a Java service + database = new infra. |
| 2 | **cqf-ruler** | Java, Apache 2.0 [verified] | **Being phased out** — functionality migrating to HAPI starter + clinical-reasoning [verified] | Docker FHIR server | Do **not** start new work on it. Mentioned because older tutorials point to it. |
| 3 | **cql-execution** (+ `cql-exec-fhir`) | TypeScript/JavaScript, Apache 2.0 [verified] | Mature for CQL 1.4/1.5 core, **"not yet a complete implementation"**; needs pre-compiled ELM; caller supplies data and terminology providers [verified]. Used by AHRQ CDS Connect, MITRE, CDS Hooks services | Library: Node service or **browser/on-device** | Good for lightweight, offline or client-side evaluation. No `$apply` — we would orchestrate PlanDefinitions ourselves. |
| 4 | **Android FHIR SDK — Workflow library** (Google, `google/android-fhir`) | Kotlin, Apache 2.0 | Beta-grade; wraps clinical-reasoning to run `$apply` **on-device**; used in WHO/OpenSRP field deployments | Inside a native Android app | Interesting for offline mobile; tebIQ is Flutter, so it would need a platform channel and gives no iOS parity. Watch-only. |
| 5 | **Commercial FHIR servers with CR modules** (Smile CDR; also HAPI-based hosting) | Proprietary on top of #1 | Production, supported, BAA-capable vendors exist | Managed/hosted | Fastest to production-grade, but costs money and adds a PHI processor (BAA, vendor review). |

**Not found:** a mature **Python** CQL engine. tebIQ's backend (scripta) is Python, so every realistic option is either a Java sidecar (#1) or a Node/JS evaluator (#3). This is an architectural cost, not a blocker.

**Authoring tooling** (not engines, but required): CQL language server/VS Code extension, `cql-to-elm` translator, FHIR Shorthand (SUSHI) + HL7 IG Publisher, CQF Tooling (`refresh`, bundling, test cases). All open source.

---

## 4. Mapping the founder's 12 requirements against FHIR CPG

Legend: ✅ provided by the standard · 🟡 partly — standard has hooks, we must build the rest · ❌ not addressed

| # | Founder requirement | Coverage | What CPG gives | What is missing (gap id) |
|---|---|---|---|---|
| 1 | Open international collaboration | 🟡 | CC0 format, Git-based IG publishing, WHO uses it globally, HL7 community | Collaboration platform, contributor agreement (CLA/DCO), licensing of contributed content, moderation (G4, G5) |
| 2 | Verified clinical expert review | ❌/🟡 | `author`, `reviewer`, `editor`, `endorser`, `approvalDate` fields | **Identity/credential verification, conflict-of-interest disclosure, review workflow, quorum rules** — nothing in FHIR (G1) |
| 3 | Evidence-based guideline integration | 🟡 | `relatedArtifact` citations; Evidence/Citation/ArtifactAssessment for GRADE | Evidence resources are FMM 1; **rights to the guideline content itself** (G5, G7) |
| 4 | Machine-readable clinical pathways | ✅ | PlanDefinition pathway/strategy/recommendation profiles, ActivityDefinition, case features | — |
| 5 | Deterministic decision rules where appropriate | ✅ | CQL — typed, side-effect-free, deterministic given pinned data/terminology | Pinning discipline; test suites per artifact (CQF Tooling supports test cases) |
| 6 | Transparent citations and provenance | ✅/🟡 | `relatedArtifact`, Provenance, AuditEvent, GuidanceResponse | Run-time provenance shown *to the clinician in tebIQ* is our UI work |
| 7 | Version control and change history | ✅ | Canonical URL + version, versioned references, status lifecycle, NPM package releases from Git | Human-readable changelogs / "what changed clinically" diffs (G3, minor) |
| 8 | Regional and institutional adaptations | ✅ | `useContext`/`jurisdiction`, base→local IG dependency pattern (WHO SMART) | Governance of who may publish an adaptation (G1) |
| 9 | Automated monitoring for guideline updates | ❌ | `lastReviewDate`, `effectivePeriod` fields only | **Watching society sites/PubMed/retractions, triage, re-review triggers** — entirely ours (G2) |
| 10 | Safe integration with medical AI systems | ❌/🟡 | Standard APIs (`$apply`, `$evaluate`, CDS Hooks) an AI can call as tools | **LLM-specific safety:** extracting case features from free text, refusing to override deterministic output, hallucinated citations, eval harness (G8) |
| 11 | Human clinical oversight | 🟡 | CDS Hooks override reasons + feedback [verified]; recommendations are *proposals* (RequestGroup intent=proposal) | Oversight UX, escalation, sign-off in tebIQ; founder-MD gate already required internally |
| 12 | Auditable recommendations and decision processes | ✅/🟡 | GuidanceResponse, Provenance, AuditEvent, deterministic re-execution with pinned versions | Storage/retention design; must log *metadata* only in prod (no PHI in logs) (G9) |

**Score:** 4–5 of 12 essentially solved by the standard (representation), 5 partially, 2–3 not at all. The unsolved ones are governance, content rights, monitoring and AI safety — i.e. the parts that would make TebScribe's contribution distinctive.

---

## 5. Critical gaps (unsolved by any standard)

- **G1 — Clinician verification and review governance.** No standard verifies that a "reviewer" is a licensed physician in good standing, or defines quorum, COI disclosure, appeals. Options: NPI lookup (US only), national registers (GMC, AHPRA…), ORCID; institutional endorsement. Hard internationally.
- **G2 — Update monitoring.** Needs source watchers (society sites, NICE/USPSTF feeds, PubMed, Retraction Watch), diffing, and a re-review queue. LLM-assisted triage is plausible but every flag still goes to a human. Would be logged to `usage_events` like any recurring-cost feature.
- **G3 — Clinical diff readability.** Git diffs of CQL/JSON are not reviewable by most clinicians; need L2 decision-table views rendered from L3.
- **G4 — Community operations.** Contributor licence (CC BY 4.0 vs CC0 for content), moderation, liability disclaimers, conduct policy.
- **G5 — Rights to guideline content.** Society guidelines are copyrighted; encoding their logic and recommendation text in a public repo may need permission. Openly licensed sources exist (WHO guidelines and SMART DAKs, some government guidance such as CDC; NICE has its own re-use terms). **Legal review required before any public repository.**
- **G6 — Terminology licensing.** SNOMED CT is not free in non-member countries; a global open repository cannot assume it. Prefer LOINC/ICD/ATC where possible, isolate SNOMED value sets.
- **G7 — Evidence model immaturity.** Evidence/ArtifactAssessment at FMM 1 — use citations first, full Evidence later.
- **G8 — AI coupling safety.** The standard is silent on LLMs. Risks: wrong case-feature extraction from notes → correct logic on wrong facts; LLM paraphrasing deterministic output into something different; fabricated citations. Needs a design where the LLM *calls* the rule engine and must quote its output verbatim with the artifact URL+version, plus synthetic-data evals.
- **G9 — Regulatory position.** Non-device CDS in the US depends on the clinician being able to independently review the basis of a recommendation (FDA's 2022 CDS guidance criteria); time-critical ED alerting may fall outside the exemption. EU MDR/AI Act may classify such software as a medical device. Following FHIR CPG confers **no** clinical authority, certification or regulatory status. Needs regulatory counsel before external use.
- **G10 — Runtime stack mismatch.** No mature Python engine; adds a Java (or Node) service with its own ops, security and PHI-handling review.

---

## 6. Architecture options for the next phase

| Option | Description | Pros | Cons | Effort (rough) |
|---|---|---|---|---|
| **A. Internal CPG "rails" for tebIQ (recommended first)** | Encode 1 openly licensed pathway as a CPG IG in a private repo; run with clinical-reasoning (HAPI) or cql-execution in a sidecar; tebIQ calls it as a tool; LLM must cite artifact URL+version; ships `reviewed:false` behind a default-OFF flag | Proves the stack on our data shapes; no public/legal exposure; reusable later | New service; one pathway only | Small–medium |
| **B. Contribute to existing open efforts** | Join HL7 CDS WG / WHO SMART guidelines community, contribute ED pathway content or tooling | Credibility, no need to build a community, influence on STU3 | Slow; less brand ownership | Low cash, ongoing time |
| **C. TebScribe Open Clinical Pathways (public repo + governance platform)** | Public CPG-based repository plus our verification/review/monitoring layer (G1–G4) | Distinctive — solves what the standard doesn't | Legal (G5, G9), liability, community cost; must not claim authority | Large; only after A and legal review |
| **D. Don't use CPG — proprietary rule format** | Our own JSON/YAML rules | Fast to start | Not interoperable, re-invents versioning/citations; no international reuse | Low now, high later |

Recommended path: **A → (B in parallel, low cost) → decide on C** after A is reviewed by the founder.

### Option A sketch (no code written in this phase)
```
tebIQ app ──► scripta (Python)  ──tool call──►  CR sidecar (HAPI FHIR + clinical-reasoning, or Node + cql-execution)
                │  synthetic/structured case features      │  PlanDefinition/$apply (pinned IG version)
                │◄────── RequestGroup + cited artifact URL|version ◄──┘
                ├─ LLM drafts explanation, must quote deterministic output verbatim
                ├─ clinician sees: recommendation · source citation · pathway version · "reviewed: false" badge
                └─ usage_events: operational cost + metadata-only audit (no PHI)
Flag: default OFF. Founder-MD gate before any content leaves reviewed:false.
```

---

## 7. Compliance check (per the compliance-check playbook; not legal advice)

**Summary:** Proceed with research and an internal, flag-OFF proof of concept. Any public repository, external API, or marketing **requires further review** (legal + regulatory).

| Regulation / policy | Relevance | What we must do |
|---|---|---|
| HL7 IP policy & trademarks | Using FHIR/CPG and the names | CC0 use is free; correct ® wording; no endorsement claims; written permission before using "FHIR" in a product/domain name |
| Guideline publisher copyright | Encoding society guidelines | Start with openly licensed sources; obtain permission for others; legal review before publishing |
| SNOMED CT / UMLS licences | Value sets | Respect affiliate/UMLS terms; avoid redistributing licensed content in a global repo |
| FDA CDS guidance (US) / EU MDR & AI Act | Decision support in clinical workflow | Regulatory counsel before external use; design so clinicians can see the basis of every recommendation |
| HIPAA | Patient data at run time | Engine sidecar is a PHI-processing component → same encryption/access/logging rules as scripta; synthetic data only in dev/tests/evals |
| TebScribe internal rules | Clinical content, flags, claims | `reviewed:false` behind OFF flag; founder-MD gate; no authored dosing tables; no "certified/approved/HIPAA certified" claims |

Required approvals before Option A starts: founder (scope and pathway choice). Before Option C: founder + legal counsel + regulatory counsel.

---

## 8. Open questions for the founder
1. Which single pathway for the proof of concept? (Suggest one with an openly licensed source and no drug dosing, e.g. a WHO-published or government guideline relevant to ED triage.)
2. Is the long-term goal a public commons (Option C) or a durable internal advantage for tebIQ (Option A only)? It changes licensing choices now.
3. Appetite for a Java sidecar in the scripta stack vs a Node/JS evaluator?
4. Should we approach HL7 CDS WG / WHO SMART team now (Option B)?

---

## 9. Sources
- HL7 FHIR CPG IG v2.0.0 (STU2): https://hl7.org/fhir/uv/cpg/ · downloads: https://www.hl7.org/fhir/uv/cpg/STU2/downloads.html · CI build: https://build.fhir.org/ig/HL7/cqf-recommendations/
- IG source: https://github.com/HL7/cqf-recommendations · starter template: https://github.com/cqframework/cpg-example
- FHIR licence and trademark terms: https://www.hl7.org/fhir/license.html
- PlanDefinition (R4): https://hl7.org/fhir/R4/plandefinition.html · Evidence (R5): https://hl7.org/fhir/R5/evidence.html
- CQL: https://cql.hl7.org/
- CDS Hooks 2.0.1: https://cds-hooks.hl7.org/
- Engines: https://github.com/cqframework/clinical-reasoning · https://github.com/cqframework/cqf-ruler · https://github.com/cqframework/cql-execution · https://github.com/google/android-fhir
- WHO SMART Guidelines L3 IG: https://www.who.int/tools/CCC/l3-implementation-guide · https://build.fhir.org/ig/WorldHealthOrganization/smart-base/index.html · https://smart.who.int/dak-tb/adapting.html
