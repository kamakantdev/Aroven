# SWASTIK Healthcare Ecosystem README

Last updated: 26 March 2026

This repository is a multi-application healthcare ecosystem built around one shared backend, one shared approval model, one shared real-time event fabric, and one shared patient record graph.

It is not just a patient app, not just a doctor portal, and not just an emergency stack. It is an end-to-end healthcare network where:

- patients discover, book, consult, upload records, receive prescriptions, order medicines, book diagnostics, trigger SOS, and share records through a QR health card,
- doctors consult, prescribe, review reports, scan patient QR records, and complete care plans,
- hospitals and clinics manage appointments, doctors, operations, managers, and facility-level care workflows,
- pharmacies fulfill prescriptions and medicine orders,
- diagnostic centers execute tests and publish results,
- ambulance operators and drivers respond to emergencies in real time,
- admins approve providers, suspend bad actors, watch emergencies, and govern the whole platform,
- the backend coordinates every workflow as the source of truth,
- the AI service adds reasoning and vitals interpretation for advanced consultation workflows.

This README is the canonical end-to-end workflow document for the whole ecosystem.

## 1. Repository Overview

| Module | Role in ecosystem | Primary users | Main path |
| --- | --- | --- | --- |
| Patient Android App | Consumer super-app for care access | Patients | [`app`](app) |
| Ambulance Android App | Field operations and dispatch client | Ambulance operators, drivers | [`ambulance-app`](ambulance-app) |
| Web Multi-Portal App | Operational portals for all provider/admin roles | Admin, doctor, hospital, clinic, pharmacy, diagnostic center | [`swastik-web`](swastik-web) |
| Backend API | System-of-record orchestration layer | All clients | [`swastik-backend`](swastik-backend) |
| AI Service | Consultation intelligence and vitals reasoning | Backend, consultations | [`swastik-ai-service`](swastik-ai-service) |

## 2. Actor Model

The backend role model currently includes:

- `patient`
- `doctor`
- `admin`
- `super_admin`
- `hospital_owner`
- `hospital_manager`
- `clinic_owner`
- `pharmacy_owner`
- `diagnostic_center_owner`
- `ambulance_operator`
- `ambulance_driver`

Each role enters the ecosystem through a different UI surface, but all role permissions, approvals, and business rules are enforced centrally by the backend.

## 3. High-Level Architecture

```mermaid
flowchart TD
  subgraph Clients
    P[Patient Android App]
    A[Ambulance Android App]
    W[Web Multi-Portal App]
  end

  subgraph Core
    B[Backend API and Orchestrator]
    S[Socket.IO Event Fabric]
    AI[AI Consultation Service]
  end

  subgraph Data
    PG[(Supabase Postgres)]
    R[(Redis)]
    M[(MongoDB optional)]
    O[(MinIO Object Storage)]
  end

  P -->|REST + JWT| B
  P -->|Realtime + signaling| S

  A -->|REST + JWT| B
  A -->|Realtime + GPS events| S

  W -->|REST + JWT or cookie auth| B
  W -->|Realtime| S

  B --> PG
  B --> R
  B --> O
  B --> M
  B --> AI

  S --> B
  S --> P
  S --> A
  S --> W
```

## 4. Operating Principles

- Backend-first truth: all business decisions, approval checks, state transitions, and cross-role coordination happen in the backend.
- Approval-gated visibility: providers are not patient-visible until admin approval is complete.
- Role-based isolation: each role sees only the workflows and data required for its responsibility.
- Realtime-first coordination: appointments, consultations, emergency dispatch, notifications, and some catalog updates propagate over Socket.IO.
- Shared records graph: prescriptions, reports, consultations, vitals, profile data, and health-card QR access all converge on the same patient data model.
- Multichannel continuity: patient app, provider portals, ambulance ops, and admin tooling all observe the same underlying entities.

## 5. Backend Domain Map

The backend route groups define the ecosystem orchestration domains:

| Domain | Route group | Responsibility |
| --- | --- | --- |
| Auth | `routes/auth` | register, login, verify email, refresh, password, profile identity |
| Patient | `routes/patient` | dashboard, profile, prescriptions, reports, discovery-facing patient actions |
| Doctor | `routes/doctor` | schedules, prescriptions, consultation-side doctor workflows |
| Appointment | `routes/appointment` | appointment lifecycle and slot-level booking behavior |
| Consultation | `routes/consultation` | consultation session start, signaling, completion, linked prescriptions |
| Hospital | `routes/hospital` | hospital operations, departments, doctors, emergency coordination |
| Hospital Manager | `routes/hospitalManager` | manager creation and hospital-level delegated operations |
| Clinic | `routes/clinic` | clinic staff, appointments, schedule, consultations |
| Pharmacy | `routes/pharmacy` | prescriptions queue, orders, inventory, pharmacy reports |
| Diagnostic Center | `routes/diagnosticCenter` | bookings, result publication, reporting |
| Ambulance | `routes/ambulance` | SOS dispatch, assignment, status, tracking |
| Medicine | `routes/medicine` | medicine catalog, pharmacy inventory-facing consumption |
| Reports | `routes/report` | report CRUD and file-backed report records |
| Uploads | `routes/uploads` | generic file upload primitives |
| Health Card | `routes/healthCard` | QR token generation, public health-record view |
| Vitals | `routes/vitals` | vitals ingestion and retrieval |
| Notifications | `routes/notifications` | unread counts, device registration, notification actions |
| Admin | `routes/enhancedAdmin` | approvals, provider governance, analytics, audit, compliance |
| Chatbot | `routes/chatbot` | conversational support and AI interaction |

## 6. Client Surface Map

### 6.1 Patient App

The patient Android app covers:

- authentication and verification,
- home dashboard,
- doctor and facility discovery,
- appointment booking,
- consultation join flow,
- records, prescriptions, reports, profile,
- medicine ordering,
- diagnostic booking,
- emergency SOS,
- vitals and reminders,
- QR health card generation.

### 6.2 Ambulance App

The ambulance Android app covers:

- operator and driver login,
- emergency queue,
- assignment acceptance,
- request detail,
- GPS tracking,
- status progression,
- field-response profile and vehicle data.

### 6.3 Web Portals

The web app currently provides dedicated operational portals for:

- admin,
- doctor,
- hospital,
- clinic,
- pharmacy,
- diagnostic center,
- consultation room,
- public health-card page,
- role-specific login and registration pages.

## 7. Canonical Ecosystem Flow

This is the complete system story at one glance.

```mermaid
flowchart TD
  A[Provider registers] --> B[Admin reviews and approves]
  B --> C[Provider becomes visible and operational]

  P[Patient registers and logs in] --> D[Patient searches approved providers]
  D --> E[Patient books appointment or service]

  E --> F[Doctor consultation]
  F --> G[Prescription created]
  F --> H[Diagnostic tests recommended]
  F --> I[Follow-up or care plan created]

  G --> J[Pharmacy fulfillment]
  H --> K[Diagnostic center booking and result upload]

  J --> L[Patient order and prescription status updates]
  K --> M[Patient reports updated]

  G --> N[Patient records timeline]
  K --> N
  I --> N
  P --> O[Patient profile and QR health card]
  O --> N

  P --> Q[Emergency SOS]
  Q --> R[Ambulance dispatch and tracking]
  R --> S[Hospital emergency intake]

  B --> T[Admin analytics, audit, and compliance loop]
  E --> T
  F --> T
  Q --> T
```

## 8. Identity, Authentication, and Approval

### 8.1 Patient Authentication Flow

```mermaid
sequenceDiagram
  participant U as Patient
  participant App as Patient App
  participant API as Backend Auth API
  participant DB as Users and Patient Tables

  U->>App: Register
  App->>API: POST /api/auth/register
  API->>DB: Create user + patient profile
  API-->>App: Registration success
  API-->>U: Verification email

  U->>API: Verify email
  API->>DB: Mark user verified

  U->>App: Login
  App->>API: POST /api/auth/login
  API-->>App: Access token + refresh token + user role
  App->>API: GET /api/auth/me
  App->>API: GET /api/patients/dashboard
  API-->>App: Hydrated patient state
```

Patient users do not require admin approval. They need valid registration, email verification when applicable, and authenticated session state.

### 8.2 Provider Registration and Approval Flow

This is the most important governance workflow in the system because it determines whether a provider can influence patient-facing care.

```mermaid
flowchart TD
  R1[Doctor, hospital, clinic, pharmacy, diagnostic center, or ambulance operator registers]
  R1 --> R2[Backend creates user plus role profile]
  R2 --> R3[Initial state: pending approval]
  R3 --> R4[Provider may verify email]
  R4 --> R5[Provider can log in only to pending-state UX when allowed]

  R5 --> A1[Admin approvals dashboard]
  A1 --> A2[Admin reviews provider details and documents]

  A2 -->|Approve| A3[approval_status = approved]
  A2 -->|Reject| A4[approval_status = rejected]
  A2 -->|Suspend| A5[approval_status = suspended]

  A3 --> V1[Provider becomes operational]
  V1 --> V2[Patient discovery queries can now return provider]
  V1 --> V3[Appointments, orders, bookings, dispatch, or consultations can be created]

  A4 --> X1[Provider stays hidden from patients]
  A5 --> X2[Provider removed from active ecosystem participation]
```

Approval affects:

- patient search visibility,
- appointment booking eligibility,
- facility discoverability,
- pharmacy order routing,
- diagnostic booking availability,
- ambulance participation,
- downstream real-time events and dashboards.

### 8.3 Hospital Manager Delegation Flow

Hospital managers are a delegated operational role tied to a hospital, not an independent public facility.

```mermaid
flowchart LR
  HO[Hospital owner or hospital admin action] --> HM1[Create hospital manager record]
  HM1 --> HM2[Manager linked to hospital]
  HM2 --> HM3[Manager logs in as hospital_manager]
  HM3 --> HM4[Manager inherits hospital approval gate]
  HM4 --> HM5[Manager can operate hospital workflows only if hospital remains approved]
```

This allows hospitals to distribute operations without creating a second public-facing hospital identity.

## 9. Discovery and Patient Entry Into Care

The patient app is the primary consumer gateway into the ecosystem.

### 9.1 Approved Provider Discovery Flow

```mermaid
flowchart TD
  P1[Patient opens app]
  P1 --> P2[Searches doctor, hospital, clinic, pharmacy, or diagnostic center]
  P2 --> P3[Backend query applies approval and availability filters]
  P3 --> P4[Only approved and active providers returned]
  P4 --> P5[Patient compares distance, fee, rating, availability, services]
  P5 --> P6[Patient selects next action]

  P6 -->|Doctor| D1[Book appointment]
  P6 -->|Hospital or clinic| D2[Browse facility-linked care path]
  P6 -->|Pharmacy| D3[Search medicines and order]
  P6 -->|Diagnostic center| D4[Book test]
```

The patient never needs to understand the internal provider approval workflow. They only see operational providers that passed admin governance.

### 9.2 Appointment Booking Flow

```mermaid
sequenceDiagram
  participant P as Patient App
  participant API as Backend
  participant DB as Appointments and Slots
  participant D as Doctor Portal
  participant F as Hospital or Clinic Portal

  P->>API: Search doctors and slots
  API->>DB: Validate doctor approval, availability, slot ownership
  API-->>P: Available slots

  P->>API: POST appointment booking
  API->>DB: Create appointment
  API-->>P: Booking confirmation
  API-->>D: Realtime appointment event
  API-->>F: Realtime facility schedule update when applicable
```

Appointment flow can originate from:

- a standalone doctor,
- a hospital-linked doctor,
- a clinic-linked doctor.

Operationally, the backend normalizes these paths into one appointment model.

## 10. Hospital and Clinic Operational Workflows

Hospitals and clinics are not just search results. They are care-orchestration containers.

### 10.1 Hospital Workflow

```mermaid
flowchart TD
  H1[Hospital approved]
  H1 --> H2[Hospital owner logs in]
  H2 --> H3[Manage departments]
  H2 --> H4[Manage doctors]
  H2 --> H5[Manage appointments]
  H2 --> H6[Review consultations]
  H2 --> H7[Manage hospital managers]
  H2 --> H8[Run emergency desk]
  H2 --> H9[Review reports and operations]

  H4 --> H10[Doctors become schedulable to patients]
  H5 --> H11[Patient bookings enter hospital schedule]
  H6 --> H12[Consultation outcomes feed prescriptions and records]
  H8 --> H13[Emergency intake syncs with ambulance flow]
```

### 10.2 Clinic Workflow

```mermaid
flowchart TD
  C1[Clinic approved]
  C1 --> C2[Clinic owner logs in]
  C2 --> C3[Manage staff]
  C2 --> C4[Manage appointments]
  C2 --> C5[Manage consultations]
  C2 --> C6[Manage schedule]

  C4 --> C7[Patient bookings enter clinic queue]
  C5 --> C8[Consultation outputs update patient records]
  C6 --> C9[Slot availability controls future bookings]
```

Hospitals and clinics are the facility layer that surrounds doctor delivery. They do not replace the doctor role; they operationalize it.

## 11. Consultation Workflow

Consultation is the clinical core of the ecosystem.

### 11.1 Consultation Lifecycle

```mermaid
flowchart LR
  A[Scheduled appointment] --> B[Doctor opens appointment]
  B --> C[Consultation started]
  C --> D[Patient joins or attends]
  D --> E[Clinical notes, diagnosis, advice, follow-up]
  E --> F[Prescription creation]
  E --> G[Diagnostic recommendation]
  E --> H[Vitals capture or review]
  F --> I[Patient records updated]
  G --> I
  H --> I
  I --> J[Notifications and follow-up]
```

### 11.2 Teleconsultation and Realtime Session Flow

```mermaid
sequenceDiagram
  participant P as Patient App
  participant W as Doctor Web Portal
  participant API as Backend Consultation Service
  participant RT as Socket.IO and signaling
  participant AI as AI Service

  W->>API: Start or reopen consultation
  API-->>W: Consultation session and identifiers
  P->>API: Join consultation
  API-->>P: Consultation session data
  P->>RT: Connect to realtime channel
  W->>RT: Connect to realtime channel
  RT-->>P: Signaling and session updates
  RT-->>W: Signaling and session updates
  P->>AI: Optional vitals or advanced stream path via backend integration
  W->>API: Complete consultation and save outcomes
  API-->>P: Record state reflects new consultation
```

Consultation outputs can directly produce:

- active prescriptions,
- follow-up dates,
- diagnostic requirements,
- doctor notes,
- patient-visible record entries.

## 12. Prescription and Pharmacy Workflow

The prescription flow connects doctor output to pharmacy operations and patient medicine access.

```mermaid
sequenceDiagram
  participant D as Doctor Portal
  participant API as Backend
  participant P as Patient App
  participant PH as Pharmacy Portal

  D->>API: Create prescription linked to consultation or appointment
  API-->>P: Prescription becomes visible in patient records and prescriptions screen
  API-->>PH: Pharmacy prescriptions queue updates

  P->>API: Browse or forward prescription to pharmacy
  API-->>PH: Create pharmacy-facing fulfillment context
  PH->>API: Update fulfillment, inventory, or dispense state
  API-->>P: Order and prescription status refresh
```

Pharmacy workflow responsibilities include:

- reviewing incoming prescriptions,
- managing inventory,
- managing orders,
- reporting on pharmacy operations,
- reflecting dispense state back to the patient-facing record model.

## 13. Diagnostic Workflow

Diagnostic centers convert consultation intent into structured clinical evidence.

```mermaid
flowchart TD
  D1[Doctor recommends test]
  D1 --> D2[Patient searches approved diagnostic centers]
  D2 --> D3[Patient books test slot]
  D3 --> D4[Diagnostic center receives booking]
  D4 --> D5[Test executed]
  D5 --> D6[Result uploaded]
  D6 --> D7[Patient reports updated]
  D6 --> D8[Doctor can review result]
  D6 --> D9[Notifications sent]
```

Diagnostic center portal responsibilities include:

- booking intake,
- operational test execution,
- result publication,
- reporting and audit visibility.

Diagnostic results become part of the patient’s longitudinal record set and can later be exposed through the health-card QR path.

## 14. Records, Reports, Profile, and Health Card QR

The records layer is the patient’s longitudinal memory inside the ecosystem.

### 14.1 Record Composition

Patient records are assembled from multiple independent workflows:

- consultation history,
- prescriptions,
- uploaded or generated reports,
- vitals history,
- profile and emergency contacts,
- family members,
- health-card QR access state.

### 14.2 Reports and File-Backed Record Flow

```mermaid
flowchart TD
  R1[Patient uploads report from app]
  R1 --> R2[Backend creates report record]
  R2 --> R3[File stored in object storage]
  R3 --> R4[Report appears in patient records]

  R5[Diagnostic center uploads result]
  R5 --> R6[Backend stores structured report data]
  R6 --> R4

  R7[Doctor reviews report context]
  R7 --> R8[Care plan or follow-up updated]
```

### 14.3 Patient Profile Flow

```mermaid
flowchart LR
  P1[Patient edits profile] --> P2[Backend updates patient profile]
  P2 --> P3[Dashboard and profile views refresh]
  P1 --> P4[Upload profile image]
  P4 --> P5[Image stored and profile row updated]
  P3 --> P6[Profile becomes part of records and health-card identity]
```

### 14.4 Health Card QR Flow

```mermaid
sequenceDiagram
  participant P as Patient App
  participant API as Backend Health Card Service
  participant QR as Public Health Card Page
  participant D as Doctor Portal or external scanner

  P->>API: Check active health-card status
  API-->>P: Existing token status or none
  P->>API: Generate health-card token when needed
  API-->>P: Time-limited QR URL

  D->>QR: Open QR URL or scan token
  QR->>API: GET public health-card record
  API-->>QR: Read-only patient record snapshot
```

The QR workflow is intentionally read-only and time-limited. It is designed for clinical access, not general account access.

## 15. Emergency and Ambulance Workflow

Emergency handling is the fastest, most real-time workflow in the ecosystem.

```mermaid
flowchart TD
  E1[Patient triggers SOS] --> E2[Backend creates emergency request]
  E2 --> E3[Dispatch engine broadcasts to ambulance operators or drivers]
  E3 --> E4[First responder accepts]
  E4 --> E5[Ambulance en route]
  E5 --> E6[Live GPS updates]
  E6 --> E7[Patient sees tracking]
  E6 --> E8[Hospital emergency desk sees inbound case]
  E6 --> E9[Admin emergency dashboard updates]
  E8 --> E10[Hospital prepares intake]
  E5 --> E11[Pickup]
  E11 --> E12[Transport to hospital]
  E12 --> E13[Arrival and completion]
```

### 15.1 Ambulance App Operational Loop

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> broadcasting
  broadcasting --> accepted
  accepted --> en_route
  en_route --> arrived
  arrived --> picked_up
  picked_up --> en_route_hospital
  en_route_hospital --> arrived_hospital
  arrived_hospital --> completed
  pending --> cancelled
  broadcasting --> cancelled
  en_route --> cancelled
```

Emergency visibility spans:

- patient app,
- ambulance app,
- hospital emergency desk,
- admin emergencies dashboard.

## 16. Notifications and Realtime Propagation

Realtime coordination is not a side feature. It is how the ecosystem stays synchronized across apps.

```mermaid
flowchart LR
  BE[Backend domain event]
  SO[Socket.IO channels]
  NO[Notification service]

  BE --> SO
  BE --> NO

  SO --> P[Patient app]
  SO --> W[Web portals]
  SO --> A[Ambulance app]

  NO --> P
  NO --> W
  NO --> A
```

Common realtime categories include:

- appointment created, confirmed, cancelled, rescheduled,
- consultation started or completed,
- prescription created,
- report ready,
- diagnostic booking updates,
- emergency assignment and tracking,
- provider-catalog updates,
- force-logout or session-expiry signals.

## 17. Admin Governance Workflow

Admin is the safety, control, and compliance layer of the ecosystem.

```mermaid
flowchart TD
  A1[Admin opens dashboard]
  A1 --> A2[Review pending approvals]
  A1 --> A3[Review providers]
  A1 --> A4[Monitor emergencies]
  A1 --> A5[Inspect analytics]
  A1 --> A6[Inspect audit and compliance]

  A2 --> A7[Approve or reject providers]
  A3 --> A8[Suspend or restore providers]
  A4 --> A9[Watch active emergency fleet state]
  A5 --> A10[Understand operational load and care performance]
  A6 --> A11[Trace sensitive actions and governance events]
```

Admin decisions have ecosystem-wide impact:

- provider approval changes patient visibility,
- suspension blocks care workflows,
- emergency monitoring provides live operations oversight,
- audit and compliance establish traceability for sensitive actions.

## 18. AI Service Workflow

The AI service is the advanced reasoning engine used for consultation-adjacent intelligence and vitals interpretation.

```mermaid
flowchart TD
  V1[Vitals stream or structured payload] --> V2[Rule engine evaluates thresholds]
  V2 --> V3[Alerts emitted]
  V3 --> V4[Async AI reasoning worker enriches context]
  V4 --> V5[Clinical reasoning or follow-up suggestions]
  V5 --> V6[Consultation workflow can consume output]
```

The AI service is responsible for:

- vitals rule evaluation,
- structured alert generation,
- possible condition reasoning,
- follow-up prompt generation,
- advanced consultation support.

It is not the primary system of record. The backend remains authoritative for persisted care state.

## 19. Data Ownership and Persistence Model

| Data type | Primary store | Why it exists |
| --- | --- | --- |
| Users, patients, doctors, facilities, appointments, prescriptions, reports, emergencies | Supabase Postgres | Transactional source of truth |
| Token and short-lived coordination state, rate limits, event streams, health-card token cache | Redis | Fast state and realtime coordination |
| Uploaded files, images, reports | MinIO | Object storage for binary assets |
| AI conversation or optional AI-side persistence | MongoDB optional | Flexible AI-oriented storage |

The backend is the canonical write path into these stores.

## 20. Workflow Matrix by Role

| Role | Main entry surface | Primary workflows | Main outputs into ecosystem |
| --- | --- | --- | --- |
| Patient | Android patient app | register, login, search, book, consult, records, pharmacy, diagnostics, SOS, profile, QR | appointments, uploads, medicine orders, emergency requests |
| Doctor | Web doctor portal | schedule, appointments, consultations, prescriptions, patient review, QR scan | diagnoses, advice, prescriptions, consultation records |
| Hospital owner | Web hospital portal | departments, doctors, appointments, consultations, reports, managers, emergency | facility operations and doctor availability |
| Hospital manager | Web hospital portal | delegated hospital operations | hospital coordination under same approval umbrella |
| Clinic owner | Web clinic portal | staff, appointments, consultations, schedules | clinic care operations |
| Pharmacy owner | Web pharmacy portal | prescriptions queue, inventory, orders, reports | fulfillment and dispense updates |
| Diagnostic center owner | Web diagnostic portal | bookings, results, reports | test results and report generation |
| Ambulance operator or driver | Ambulance Android app | accept dispatch, navigate, track, status progression | emergency transport state and live location |
| Admin or super admin | Web admin portal | approvals, suspension, analytics, audit, compliance, emergencies | governance, trust, oversight |

## 21. End-to-End Patient Journey Narrative

One complete patient journey can involve nearly every part of the ecosystem:

1. A patient registers and logs in.
2. The patient searches only approved doctors and facilities.
3. The patient books a doctor appointment.
4. The doctor consults and creates prescription plus diagnostic recommendation.
5. The pharmacy receives the prescription workflow.
6. The diagnostic center receives the testing workflow.
7. Reports and prescriptions flow back into the patient’s records.
8. The patient profile and QR health card now expose a consolidated clinical snapshot.
9. If the patient deteriorates, SOS can trigger ambulance dispatch and hospital intake.
10. Admin can observe approvals, emergencies, and compliance across the entire path.

This is why SWASTIK is best understood as a coordinated care network, not as isolated apps.

## 22. Companion READMEs and Deep-Dive Docs

Product-specific deep dives:

- [Patient App README](app/README.md)
- [Ambulance App README](ambulance-app/README.md)
- [Web App README](swastik-web/README.md)

Existing ecosystem references:

- [COMPLETE_ECOSYSTEM_JOURNEY.md](COMPLETE_ECOSYSTEM_JOURNEY.md)
- [ADMIN_APPROVAL_FLOWCHARTS.md](ADMIN_APPROVAL_FLOWCHARTS.md)

## 23. Summary

SWASTIK is a shared-care ecosystem with five layers working together:

1. Patient access layer.
2. Provider operations layer.
3. Emergency response layer.
4. Admin governance layer.
5. Backend and AI orchestration layer.

Every major workflow in the repository fits into one or more of these loops:

- identity and approval,
- discovery and booking,
- consultation and treatment,
- fulfillment and diagnostics,
- records and longitudinal history,
- emergency dispatch and live coordination,
- governance, analytics, and compliance.

That is the complete ecosystem model this repository implements.
