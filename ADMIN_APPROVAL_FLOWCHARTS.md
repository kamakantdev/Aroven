# Admin Verification Visual Flowcharts

Complete visual representation of how each provider type flows through registration, approval, and patient visibility.

---

## 1. High-Level Approval Workflow (All Providers)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROVIDER REGISTRATION WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

                          STEP 1: REGISTRATION
                          ═══════════════════════════════════════════
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              Doctor          Facility Owner      Ambulance Operator
              Registration    (Hospital/Clinic/   Registration
                             Pharmacy/Diagnostic)
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │  Create users + role_profile    │
                    │  Table Record:                   │
                    │  - is_approved: false            │
                    │  - approval_status: 'pending'    │
                    │  - is_active: false (facilities) │
                    └────────────────┬────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                              │
         [PENDING STATE]                            [EMAIL VERIFICATION]
         (Not visible to                            Link sent to provider
          patients yet)                             Provider verifies email
              │                                              │
              └──────────────────────┬──────────────────────┘
                                     │
                     STEP 2: ADMIN REVIEW & APPROVAL
                     ═══════════════════════════════════════════════════════════
                                     │
                        Admin checks pending approvals
                     GET /api/admin/approvals/pending
                                     │
                    ┌────────────────▼────────────────┐
                    │  Admin reviews documents        │
                    │  GET /api/admin/providers/      │
                    │      {type}/{id}                │
                    └────────────────┬────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
            [APPROVE]         [REJECT]              [SUSPEND]
                 │                   │                   │
                 │                   │                   │
         ┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
         │ POST /approve  │  │POST /reject │  │ POST /suspend   │
         │                │  │             │  │                 │
         │ Update:        │  │ Update:     │  │ Update:         │
         │ - is_approved: │  │ - is_apprvd:│  │ - is_approved: f│
         │   true         │  │   false     │  │ - approval_stat:│
         │ - approval_st: │  │ - approval_ │  │   'suspended'   │
         │   'approved'   │  │   status:   │  │ - is_active: false
         │ - is_active:   │  │   'rejected'│  │ - notify provider
         │   true         │  │ - notify    │  │ - cancel all    │
         │ - approved_by: │  │   provider  │  │   appointments  │
         │   admin-uuid   │  │   (email)   │  │                 │
         │ - approved_at: │  │             │  │                 │
         │   timestamp    │  │             │  │                 │
         │ - users.is_ver:│  │             │  │                 │
         │   true         │  │             │  │                 │
         └───────┬────────┘  └──────┬──────┘  └────────┬────────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
     STEP 3: REAL-TIME BROADCASTS & CACHE INVALIDATION
     ═════════════════════════════════════════════════════════════════════════════
                                    │
         ┌──────────┬───────────────┼───────────────┬──────────┐
         │          │               │               │          │
    [Cache      [Email         [Socket        [Dashboard    [Audit
     Invalidate] Notification]  Events]        Update]      Log]
         │          │               │               │          │
         │          │               │               │          │
    Invalidate  Send email to  Broadcast to:   Refresh    Log action
    - admin:    provider with  - Provider       admin       with:
      dashboard   reason        dashboard       stats       - before
    - auth_user:- (approval or - Patient       - pending   - after
      {userId}   rejection)     catalog        approvals   - notes
                - Link to      - Ambulance                - timestamp
                  resubmit      operators                 - admin ID
                                (if suspended)


     STEP 4: PROVIDER BECOMES VISIBLE TO PATIENTS
     ═════════════════════════════════════════════════════════════════════════════
                                    │
                        [APPROVED PROVIDERS ONLY]
                                    │
                ┌───────────────────▼───────────────────┐
                │  Patient Searches for Doctor/          │
                │  Facility/Ambulance                    │
                │                                        │
                │  Query filters:                        │
                │  WHERE approval_status = 'approved'    │
                │  AND is_approved = true                │
                │  AND is_active = true (if facility)    │
                │                                        │
                │  Response includes provider details    │
                │  (but NOT approval_status field)       │
                └───────────────────┬───────────────────┘
                                    │
                ┌───────────────────▼───────────────────┐
                │  Patient Books Appointment/            │
                │  Service                               │
                │                                        │
                │  Backend validates:                    │
                │  - Provider exists                     │
                │  - approval_status = 'approved'        │
                │  - is_approved = true                  │
                │                                        │
                │  Only if ALL checks pass:              │
                │  - Create appointment/order            │
                │  - Notify provider                     │
                │  - Emit real-time update               │
                └───────────────────┬───────────────────┘
                                    │
                ┌───────────────────▼───────────────────┐
                │  Services Delivered                    │
                │  - Consultation                        │
                │  - Medicine Delivery                   │
                │  - Diagnostic Test                     │
                │  - Ambulance Transport                 │
                │  - Hospital Admission                  │
                └───────────────────────────────────────┘
```

---

## 2. Doctor Registration & Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DOCTOR REGISTRATION & APPROVAL FLOW                      │
└─────────────────────────────────────────────────────────────────────────────┘

Doctor Opens App
      │
      ▼
┌──────────────────────────────────────┐
│ Fill Registration Form:              │
│ ✓ Email                              │
│ ✓ Name                               │
│ ✓ Specialization (Cardiology, etc.)  │
│ ✓ License Number                     │
│ ✓ Experience Years                   │
│ ✓ Consultation Fee                   │
│ ✓ Password                           │
└──────────────────────────────────────┘
      │
      ▼ POST /api/auth/register
┌──────────────────────────────────────────────────┐
│ Backend Processing:                              │
│                                                  │
│ 1. Hash password with bcrypt                     │
│ 2. Insert into users table:                      │
│    {                                              │
│      id: UUID                                    │
│      email: "dr.smith@example.com"               │
│      password_hash: "bcrypt_hash"                │
│      name: "Dr. Smith"                           │
│      role: "doctor"                              │
│      is_active: true                             │
│      is_verified: false  ← Not verified yet      │
│    }                                              │
│                                                  │
│ 3. Insert into doctors table:                    │
│    {                                              │
│      id: UUID                                    │
│      user_id: UUID (link to users)               │
│      name: "Dr. Smith"                           │
│      specialization: "Cardiology"                │
│      license_number: "MCI/12345"                 │
│      experience_years: 5                         │
│      consultation_fee: 500                       │
│      is_approved: false  ← Not approved yet      │
│      approval_status: "pending"  ← Awaiting      │
│      is_available: true                          │
│    }                                              │
│                                                  │
│ 4. Generate email verification JWT               │
│ 5. Send verification email                       │
└──────────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Doctor Receives Email:                   │
│ "Verify your email address"              │
│ [Verify Email Button] → Click            │
└──────────────────────────────────────────┘
      │
      ▼ GET /api/auth/verify-email?token=JWT
┌──────────────────────────────────────────┐
│ Backend:                                 │
│ - Verify JWT signature                   │
│ - Update users.is_verified = true        │
│                                          │
│ NOTE: Doctor is STILL NOT APPROVED       │
│ (is_approved = false, approval_status =  │
│ 'pending')                               │
└──────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Doctor Logs In                           │
│ App shows: "Awaiting Admin Approval"     │
│ Cannot access dashboard yet              │
│ Cannot set availability                  │
│ Cannot accept appointments               │
└──────────────────────────────────────────┘
      │
      ▼ [MEANWHILE] Admin Review
┌──────────────────────────────────────────────────────┐
│ Admin Dashboard                                      │
│ Sees: 5 Pending Doctor Approvals                     │
│                                                      │
│ GET /api/admin/approvals/pending?type=doctors       │
│ Returns list of all pending doctors                  │
│                                                      │
│ Admin clicks on Dr. Smith to review                  │
│ GET /api/admin/providers/doctor/uuid-smith          │
│                                                      │
│ Response shows:                                      │
│ {                                                    │
│   id: "uuid-smith"                                  │
│   name: "Dr. Smith"                                 │
│   specialization: "Cardiology"                       │
│   license_number: "MCI/12345"                        │
│   experience_years: 5                                │
│   email: "dr.smith@example.com"                      │
│   approval_status: "pending"                         │
│   created_at: "2024-03-19T10:30:00Z"                │
│ }                                                    │
└──────────────────────────────────────────────────────┘
      │
      ▼ Admin Clicks "Approve" Button
┌──────────────────────────────────────────────────────┐
│ Admin submits optional review notes:                 │
│ "License verified. All documents in order."          │
│                                                      │
│ POST /api/admin/providers/doctor/uuid-smith/approve │
│ {                                                    │
│   notes: "License verified..."                       │
│ }                                                    │
└──────────────────────────────────────────────────────┘
      │
      ▼ Backend Update
┌────────────────────────────────────────────────┐
│ Update doctors table:                           │
│ {                                               │
│   is_approved: true  ✅                        │
│   approval_status: "approved"  ✅              │
│   approval_notes: "License verified..."        │
│   approved_by: "admin-uuid"                    │
│   approved_at: "2024-03-19T14:30:00Z"         │
│ }                                               │
│                                                │
│ Update users table:                             │
│ {                                               │
│   is_verified: true  ✅                        │
│ }                                               │
│                                                │
│ Invalidate caches:                              │
│ - admin:dashboard                              │
│ - auth_user:doctor-uuid                        │
│                                                │
│ Log audit:                                      │
│ - action: "provider.approved"                  │
│ - old: {is_approved: false, ...}               │
│ - new: {is_approved: true, ...}                │
└────────────────────────────────────────────────┘
      │
      ▼ Notifications
      │
   ┌──┴──┐
   │     │
   │     ▼ Email to Dr. Smith
   │  ┌────────────────────────────────┐
   │  │ Subject: Registration Approved!│
   │  │                                │
   │  │ Dear Dr. Smith,                │
   │  │                                │
   │  │ Your doctor registration has   │
   │  │ been approved! You can now:    │
   │  │                                │
   │  │ ✓ Set your availability        │
   │  │ ✓ Manage consultation slots    │
   │  │ ✓ Start accepting patients     │
   │  │                                │
   │  │ Admin Notes:                   │
   │  │ "License verified..."          │
   │  └────────────────────────────────┘
   │
   ▼ In-App Notification to Dr. Smith
   ┌────────────────────────────────┐
   │ 🎉 Registration Approved!       │
   │                                │
   │ Your registration for          │
   │ "Dr. Smith - Cardiology"       │
   │ has been approved by admin.    │
   │                                │
   │ You can now access your        │
   │ dashboard and start accepting  │
   │ patient appointments.          │
   └────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Socket.IO: Broadcast to All Patients     │
│                                          │
│ {                                        │
│   eventType: 'catalog.providerAvailable',│
│   providerId: "uuid-smith"               │
│   providerType: "doctor"                 │
│   providerName: "Dr. Smith"              │
│   specialization: "Cardiology"           │
│   action: "added"                        │
│ }                                        │
│                                          │
│ → Dr. Smith now appears in patient       │
│   search results for "Cardiology"        │
└──────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Doctor Opens App                         │
│                                          │
│ Before: "Awaiting Approval"              │
│ Now: ✅ "Approved"                       │
│                                          │
│ Can now:                                 │
│ ✓ Access dashboard                       │
│ ✓ View stats                             │
│ ✓ Set availability                       │
│ ✓ Manage consultation slots              │
│ ✓ Accept appointment requests            │
│ ✓ Upload prescriptions                   │
└──────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Patient Searches "Cardiology Doctor"     │
│                                          │
│ GET /api/doctors?specialization=Card...  │
│                                          │
│ Backend Query:                           │
│ WHERE approval_status = 'approved'       │
│ AND is_approved = true                   │
│ AND specialization = 'Cardiology'        │
│                                          │
│ Response includes Dr. Smith:             │
│ {                                        │
│   id: "uuid-smith"                       │
│   name: "Dr. Smith"                      │
│   specialization: "Cardiology"           │
│   experience_years: 5                    │
│   consultation_fee: 500                  │
│   is_available: true                     │
│   rating: 4.8                            │
│   profile_image: "url"                   │
│   /* No approval_status sent to patient *│
│ }                                        │
└──────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────┐
│ Patient Books Appointment                │
│                                          │
│ POST /api/appointments                   │
│ {                                        │
│   doctorId: "uuid-smith"                 │
│   slotId: "uuid-slot-123"                │
│ }                                        │
│                                          │
│ Backend validates:                       │
│ ✓ Doctor exists                          │
│ ✓ approval_status = 'approved'           │
│ ✓ is_approved = true                     │
│ ✓ Slot available                         │
│                                          │
│ If valid:                                │
│ → Create appointment record              │
│ → Notify Dr. Smith (Socket event)        │
│ → Send SMS/Email to patient              │
│                                          │
│ If invalid (e.g., doctor suspended):     │
│ → Error: "Doctor not available"          │
└──────────────────────────────────────────┘
```

---

## 3. Facility (Hospital/Clinic/Pharmacy/Diagnostic) Registration & Approval

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            FACILITY REGISTRATION & APPROVAL FLOW (Hospitals, etc.)           │
└─────────────────────────────────────────────────────────────────────────────┘

Hospital Owner Opens App
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│ Fill Registration Form:                                 │
│ ✓ Hospital Name                                         │
│ ✓ Email                                                 │
│ ✓ Phone                                                 │
│ ✓ Address                                               │
│ ✓ City                                                  │
│ ✓ Latitude/Longitude (or auto-geocode)                  │
│ ✓ License Number                                        │
│ ✓ Facility Type (General/Specialized/Multi-specialty)   │
│ ✓ Emergency Available? (Yes/No)                         │
│ ✓ 24 Hour Service? (Yes/No)                             │
│ ✓ Password                                              │
└─────────────────────────────────────────────────────────┘
           │
           ▼ POST /api/auth/register
┌──────────────────────────────────────────────────────────────┐
│ Backend Processing:                                          │
│                                                              │
│ 1. Insert into users table:                                  │
│    {                                                          │
│      id: UUID                                                │
│      email: "owner@hospital.com"                              │
│      password_hash: bcrypt(password)                          │
│      name: "City Hospital"                                    │
│      role: "hospital_owner"                                   │
│      is_active: true                                          │
│      is_verified: false  ← Email not verified yet             │
│    }                                                          │
│                                                              │
│ 2. Insert into hospitals table:                               │
│    {                                                          │
│      id: UUID                                                │
│      owner_id: UUID                                           │
│      name: "City Hospital"                                    │
│      address: "123 Medical Road, Mumbai"                      │
│      city: "Mumbai"                                           │
│      phone: "+91-9876543210"                                  │
│      email: "owner@hospital.com"                              │
│      license_number: "REG/2024/001"                           │
│      type: "General"                                          │
│      is_emergency_available: true                             │
│      is_24_hours: true                                        │
│      latitude: 19.0760                                        │
│      longitude: 72.8777                                       │
│      is_approved: false  ← Not approved yet                   │
│      approval_status: "pending"  ← Awaiting admin             │
│      is_active: false  ← NOT visible to patients yet          │
│    }                                                          │
│                                                              │
│ 3. Send email verification link                              │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Hospital Owner Verifies Email                        │
│                                                      │
│ GET /api/auth/verify-email?token=JWT                │
│ → users.is_verified = true                           │
│                                                      │
│ Still NOT approved:                                  │
│ - approval_status = "pending"                        │
│ - is_approved = false                                │
│ - is_active = false (NOT visible to patients)        │
└──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Hospital Owner Logs In                               │
│                                                      │
│ Dashboard shows:                                     │
│ "⏳ Your registration is pending admin approval"     │
│                                                      │
│ Cannot yet:                                          │
│ ✗ Add departments                                    │
│ ✗ Add doctors                                        │
│ ✗ Accept appointments                                │
│ ✗ Receive emergency dispatch calls                   │
│                                                      │
│ Can:                                                 │
│ ✓ View pending status                                │
│ ✓ Update profile info                                │
└──────────────────────────────────────────────────────┘
           │
           ▼ [MEANWHILE] Admin Review
┌───────────────────────────────────────────────────────────────┐
│ Admin Dashboard                                               │
│                                                               │
│ GET /api/admin/approvals/pending?type=hospitals              │
│ Shows: 3 Pending Hospital Approvals                           │
│                                                               │
│ Admin clicks on "City Hospital" to review                     │
│ GET /api/admin/providers/hospital/uuid-hospital              │
│                                                               │
│ Response:                                                     │
│ {                                                             │
│   id: "uuid-hospital"                                         │
│   owner_id: "uuid-owner"                                      │
│   name: "City Hospital"                                       │
│   address: "123 Medical Road, Mumbai"                         │
│   city: "Mumbai"                                              │
│   phone: "+91-9876543210"                                     │
│   email: "owner@hospital.com"                                 │
│   license_number: "REG/2024/001"                              │
│   type: "General"                                             │
│   is_emergency_available: true                                │
│   is_24_hours: true                                           │
│   latitude: 19.0760                                           │
│   longitude: 72.8777                                          │
│   approval_status: "pending"                                  │
│   created_at: "2024-03-19T10:30:00Z"                         │
│ }                                                             │
│                                                               │
│ Admin verifies:                                               │
│ ✓ License number valid                                        │
│ ✓ Location legitimate                                         │
│ ✓ No complaints in system                                     │
│ ✓ Facility type matches description                           │
└───────────────────────────────────────────────────────────────┘
           │
           ▼ Admin Clicks "Approve"
┌───────────────────────────────────────────────────────────────┐
│ Admin optional notes:                                          │
│ "All documents verified. Ready to go live."                   │
│                                                               │
│ POST /api/admin/providers/hospital/uuid-hospital/approve      │
│ {                                                              │
│   notes: "All documents verified. Ready to go live."          │
│ }                                                              │
└───────────────────────────────────────────────────────────────┘
           │
           ▼ Backend Update
┌────────────────────────────────────────────────────────┐
│ Update hospitals table:                                │
│ {                                                      │
│   is_approved: true  ✅                               │
│   approval_status: "approved"  ✅                      │
│   approval_notes: "All documents verified..."         │
│   approved_by: "admin-uuid"                           │
│   approved_at: "2024-03-19T14:30:00Z"                │
│   is_active: true  ✅ ← NOW VISIBLE TO PATIENTS      │
│ }                                                      │
│                                                        │
│ Update users table:                                    │
│ { is_verified: true }                                  │
│                                                        │
│ Geocode address (if not already done)                  │
│ → Fill latitude/longitude if null                      │
│                                                        │
│ Invalidate caches + broadcast socket events            │
└────────────────────────────────────────────────────────┘
           │
           ▼ Notifications
           │
    ┌──────┴──────┐
    │             │
    │             ▼ Email to Hospital Owner
    │          ┌──────────────────────────────┐
    │          │ Subject: Hospital Approved!  │
    │          │                              │
    │          │ Dear Hospital Owner,         │
    │          │                              │
    │          │ Your hospital has been      │
    │          │ approved and is now live    │
    │          │ on Swastik!                 │
    │          │                              │
    │          │ ✓ Patients can now find you │
    │          │ ✓ Add your doctors          │
    │          │ ✓ Manage departments        │
    │          │                              │
    │          └──────────────────────────────┘
    │
    ▼ In-App Notification
    ┌──────────────────────────────┐
    │ 🎉 Hospital Approved!        │
    │                              │
    │ Your hospital "City Hospital"│
    │ is now live on Swastik!      │
    │                              │
    │ Next steps:                  │
    │ • Add departments            │
    │ • Add doctors                │
    │ • Set bed availability       │
    └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Socket.IO: Broadcast to All Patients                 │
│                                                      │
│ {                                                    │
│   eventType: 'catalog.providerAvailable'             │
│   providerId: "uuid-hospital"                        │
│   providerType: "hospital"                           │
│   providerName: "City Hospital"                      │
│   location: { latitude: 19.0760, longitude: 72.8777} │
│   action: "added"                                    │
│ }                                                    │
│                                                      │
│ → Hospital appears in patient searches for           │
│   "hospitals near me"                                │
│ → Shows up in emergency hospital proximity search    │
└──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Hospital Owner Opens App                             │
│                                                      │
│ Before: "⏳ Pending Approval"                        │
│ Now: ✅ "Approved & Live"                           │
│                                                      │
│ Can now:                                             │
│ ✓ Add departments                                    │
│ ✓ Invite doctors                                     │
│ ✓ Set bed availability                               │
│ ✓ Enable emergency services                          │
│ ✓ Manage appointments                                │
│ ✓ View analytics                                     │
└──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Patient Searches "General Hospital + Emergency"      │
│                                                      │
│ GET /api/hospital/emergency?lat=19.076&lon=72.877   │
│                                                      │
│ Backend Query:                                       │
│ WHERE approval_status = 'approved'                   │
│ AND is_approved = true                               │
│ AND is_active = true                                 │
│ AND is_emergency_available = true                    │
│ AND distance <= 10km                                 │
│                                                      │
│ Response includes City Hospital:                     │
│ {                                                    │
│   id: "uuid-hospital"                                │
│   name: "City Hospital"                              │
│   address: "123 Medical Road, Mumbai"                │
│   distance: 2.3,  // km from patient                 │
│   rating: 4.7                                        │
│   type: "General"                                    │
│   is_emergency_available: true                       │
│   is_24_hours: true                                  │
│   phone: "+91-9876543210"                            │
│   /* No approval_status sent */                      │
│ }                                                    │
└──────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ Patient Calls Hospital Directly                      │
│ or Books Emergency Appointment                       │
│                                                      │
│ System validates:                                    │
│ ✓ Hospital is approved                               │
│ ✓ Hospital is active                                 │
│ ✓ Hospital has emergency service                     │
│                                                      │
│ If valid: Emergency request routed to hospital       │
│ If invalid: Error "Service not available"            │
└──────────────────────────────────────────────────────┘
```

---

## 4. Ambulance Operator Registration & Approval

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               AMBULANCE OPERATOR REGISTRATION & APPROVAL FLOW                │
└─────────────────────────────────────────────────────────────────────────────┘

Ambulance Operator Opens App
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Fill Registration Form:                                 │
│ ✓ Company Name / Operator Name                          │
│ ✓ Email                                                 │
│ ✓ Phone Number                                          │
│ ✓ Password                                              │
│ ✓ License/Registration Documents                        │
└─────────────────────────────────────────────────────────┘
              │
              ▼ POST /api/auth/register
┌────────────────────────────────────────────────────────────┐
│ Backend Processing:                                        │
│                                                            │
│ 1. Insert into users table:                                │
│    {                                                        │
│      id: UUID                                              │
│      email: "ambulance@operator.com"                        │
│      password_hash: bcrypt(password)                        │
│      name: "Emergency Ambulance Service"                    │
│      role: "ambulance_operator"                             │
│      is_active: true                                        │
│      is_verified: false                                     │
│    }                                                        │
│                                                            │
│ 2. Insert into ambulance_operators table:                   │
│    {                                                        │
│      id: UUID                                              │
│      user_id: UUID                                          │
│      name: "Emergency Ambulance Service"                    │
│      company_name: "Emergency Ambulance Service"            │
│      phone: "+91-9876543210"                                │
│      is_approved: false  ← Not approved yet                 │
│      approval_status: "pending"  ← Awaiting admin           │
│      is_active: false  ← CANNOT dispatch yet                │
│    }                                                        │
│                                                            │
│ 3. Send email verification                                 │
└────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Operator Verifies Email                              │
│                                                      │
│ GET /api/auth/verify-email?token=JWT                │
│ → users.is_verified = true                           │
│                                                      │
│ BUT:                                                 │
│ - approval_status = "pending"                        │
│ - is_approved = false                                │
│ - is_active = false                                  │
│ → CANNOT receive emergency dispatch requests         │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Operator Logs In                                     │
│                                                      │
│ Dashboard shows:                                     │
│ "⏳ Awaiting Admin Approval"                        │
│                                                      │
│ Cannot:                                              │
│ ✗ Receive emergency dispatch calls                   │
│ ✗ Track ambulance fleet                              │
│ ✗ Manage drivers                                     │
│ ✗ View dispatch history                              │
│                                                      │
│ Operator waits for admin approval...                 │
└──────────────────────────────────────────────────────┘
              │
              ▼ [MEANWHILE] Admin Review
┌────────────────────────────────────────────────────────────┐
│ Admin Dashboard                                            │
│                                                            │
│ GET /api/admin/approvals/pending?type=ambulances          │
│ Shows: 2 Pending Ambulance Operators                       │
│                                                            │
│ Admin clicks on "Emergency Ambulance Service" to review    │
│ GET /api/admin/providers/ambulance/uuid-operator          │
│                                                            │
│ Response:                                                  │
│ {                                                          │
│   id: "uuid-operator"                                      │
│   user_id: "uuid-user"                                     │
│   name: "Emergency Ambulance Service"                      │
│   company_name: "Emergency Ambulance Service"              │
│   phone: "+91-9876543210"                                  │
│   email: "ambulance@operator.com"                          │
│   approval_status: "pending"                               │
│   created_at: "2024-03-19T10:30:00Z"                      │
│ }                                                          │
│                                                            │
│ Admin verifies:                                            │
│ ✓ Business license                                         │
│ ✓ Vehicle registration                                     │
│ ✓ Driver credentials                                       │
│ ✓ Insurance documents                                      │
│ ✓ Equipment certifications                                 │
└────────────────────────────────────────────────────────────┘
              │
              ▼ Admin Clicks "Approve"
┌────────────────────────────────────────────────────────┐
│ Admin submits approval:                                 │
│                                                         │
│ POST /api/admin/providers/ambulance/uuid-op/approve    │
│ {                                                       │
│   notes: "Documents verified. Fleet ready."             │
│ }                                                       │
└────────────────────────────────────────────────────────┘
              │
              ▼ Backend Update
┌─────────────────────────────────────────────────────────────┐
│ Update ambulance_operators table:                           │
│ {                                                           │
│   is_approved: true  ✅                                    │
│   approval_status: "approved"  ✅                           │
│   approval_notes: "Documents verified. Fleet ready."        │
│   approved_by: "admin-uuid"                                 │
│   approved_at: "2024-03-19T14:30:00Z"                      │
│   is_active: true  ✅ ← NOW RECEIVES EMERGENCY CALLS       │
│ }                                                           │
│                                                             │
│ Update users table:                                         │
│ { is_verified: true }                                       │
└─────────────────────────────────────────────────────────────┘
              │
              ▼ Notifications
              │
        ┌─────┴─────┐
        │            │
        │            ▼ Email to Operator
        │         ┌──────────────────────────────┐
        │         │ Subject: Approved!           │
        │         │                              │
        │         │ Your ambulance service is   │
        │         │ now approved and ready to   │
        │         │ receive emergency dispatch  │
        │         │ requests on Swastik!        │
        │         └──────────────────────────────┘
        │
        ▼ In-App Notification
        ┌──────────────────────────────┐
        │ ✅ Approved!                 │
        │                              │
        │ Your ambulance service is   │
        │ now live and can receive    │
        │ emergency dispatch requests │
        │ from patients.              │
        └──────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Socket.IO: Broadcast                                 │
│                                                      │
│ {                                                    │
│   eventType: 'ambulance.operatorApproved'            │
│   operatorId: "uuid-operator"                        │
│   operatorName: "Emergency Ambulance Service"        │
│   phone: "+91-9876543210"                            │
│   action: "available_for_dispatch"                   │
│ }                                                    │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Operator Opens App                                   │
│                                                      │
│ Before: "⏳ Pending Approval"                       │
│ Now: ✅ "Approved & Accepting Calls"               │
│                                                      │
│ Can now:                                             │
│ ✓ Manage ambulance fleet                             │
│ ✓ Add drivers                                        │
│ ✓ Track vehicles in real-time                        │
│ ✓ Accept emergency dispatch requests                 │
│ ✓ View dispatch history & analytics                  │
│ ✓ Update vehicle status (active/maintenance/etc.)    │
│                                                      │
│ Dashboard shows:                                     │
│ • "Ready for Emergency Dispatch ✅"                 │
│ • Active vehicles: 2                                 │
│ • Available drivers: 5                               │
│ • Pending dispatch requests: 0                       │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Patient Has Emergency (e.g., chest pain)             │
│                                                      │
│ Clicks "Emergency Ambulance" button                  │
│                                                      │
│ POST /api/emergency/dispatch                         │
│ {                                                    │
│   latitude: 19.0760,                                 │
│   longitude: 72.8777,                                │
│   symptoms: "Severe chest pain"                      │
│ }                                                    │
└──────────────────────────────────────────────────────┘
              │
              ▼ Backend Processing
┌──────────────────────────────────────────────────────────┐
│ dispatchService.dispatchEmergency():                     │
│                                                          │
│ 1. Find APPROVED ambulance operators:                    │
│    SELECT * FROM ambulance_operators                     │
│    WHERE approval_status = 'approved'                    │
│    AND is_approved = true                                │
│    AND is_active = true                                  │
│                                                          │
│ 2. Create emergency request:                             │
│    {                                                     │
│      patient_id: UUID                                    │
│      latitude: 19.0760                                   │
│      longitude: 72.8777                                  │
│      symptoms: "Severe chest pain"                       │
│      status: "broadcasting"                              │
│    }                                                     │
│                                                          │
│ 3. Broadcast to all approved operators:                  │
│    Socket.emit('emergency.dispatch', {                   │
│      emergencyId: UUID                                   │
│      patientLocation: { lat, lon }                       │
│      symptoms: "Severe chest pain"                       │
│      distance_km: 2.5                                    │
│    })                                                    │
│                                                          │
│ → Operator receives alert on dashboard                   │
│ → Operator can "Accept" to dispatch ambulance            │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Operator Accepts Emergency                           │
│                                                      │
│ Clicks "Accept" on emergency alert                   │
│ • Assigns nearest ambulance                          │
│ • Assigns driver                                     │
│ • Sends ambulance coordinates to patient via GPS    │
│ • Real-time tracking begins                          │
│                                                      │
│ Patient sees:                                        │
│ "Ambulance on the way! 2.5 km away"                 │
│ With live GPS tracking                               │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ Ambulance Arrives & Patient Transported              │
│                                                      │
│ Emergency request status updates:                    │
│ "en_route" → "arrived" → "picked_up" → "completed"  │
│                                                      │
│ Hospital receives notification via socket event:     │
│ {                                                    │
│   eventType: 'ambulance.arrival',                    │
│   emergencyId: UUID,                                 │
│   patientInfo: {...},                                │
│   ambulanceOperator: "Emergency Ambulance Service"   │
│ }                                                    │
└──────────────────────────────────────────────────────┘
```

---

## 5. Admin Rejection & Suspension Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADMIN REJECTION & SUSPENSION FLOWS                        │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SCENARIO 1: ADMIN REJECTS PENDING APPLICATION
═══════════════════════════════════════════════════════════════════════════════

Provider Status: approval_status = "pending"
Admin Decision: Reject (documents don't match, incomplete license, etc.)
              │
              ▼
┌────────────────────────────────────────────────────────┐
│ Admin clicks "Reject" button                           │
│                                                        │
│ Enters reason:                                         │
│ "License number could not be verified. Please        │
│  resubmit with updated documents."                     │
│                                                        │
│ POST /api/admin/providers/{type}/{id}/reject          │
│ {                                                      │
│   reason: "License could not be verified..."          │
│ }                                                      │
└────────────────────────────────────────────────────────┘
              │
              ▼ Backend Update
┌────────────────────────────────────────────────────────┐
│ Update provider record:                                │
│ {                                                      │
│   is_approved: false                                   │
│   approval_status: 'rejected'  ← Status changed        │
│   approval_notes: "License could not be verified..."   │
│   is_active: false  (for facilities)                   │
│   rejection_reason: "..." (for doctors)                │
│ }                                                      │
│                                                        │
│ Log audit trail                                        │
└────────────────────────────────────────────────────────┘
              │
              ▼ Notifications
              │
        ┌─────┴──────┐
        │             │
        │             ▼ Email to Provider
        │          ┌──────────────────────────────┐
        │          │ Subject: Registration Review │
        │          │                              │
        │          │ Dear Provider,               │
        │          │                              │
        │          │ Thank you for registering   │
        │          │ with Swastik.               │
        │          │                              │
        │          │ We could not approve your   │
        │          │ registration at this time.  │
        │          │                              │
        │          │ Reason:                      │
        │          │ "License could not be       │
        │          │  verified. Please resubmit  │
        │          │  with updated documents."   │
        │          │                              │
        │          │ [Resubmit Documents] link   │
        │          └──────────────────────────────┘
        │
        ▼ In-App Notification
        ┌──────────────────────────────┐
        │ ⚠️ Registration Not Approved  │
        │                              │
        │ Your application requires    │
        │ additional information.      │
        │                              │
        │ Reason:                      │
        │ "License could not be        │
        │  verified..."                │
        │                              │
        │ [View Full Details]          │
        │ [Resubmit Application]       │
        └──────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────┐
│ Provider Status in App:                                │
│                                                        │
│ Before: "Awaiting Approval"                            │
│ Now: "Application Denied"                              │
│                                                        │
│ Can:                                                   │
│ ✓ View rejection reason                                │
│ ✓ Resubmit application                                 │
│ ✓ Update profile information                           │
│                                                        │
│ Cannot:                                                │
│ ✗ Access provider dashboard                            │
│ ✗ Manage services                                      │
│ ✗ Accept patients/orders                               │
│ ✗ Appear in patient search                             │
└────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SCENARIO 2: ADMIN SUSPENDS ACTIVE/APPROVED PROVIDER
═══════════════════════════════════════════════════════════════════════════════

Provider Status: approval_status = "approved", is_active = true
Admin Decision: Suspend (complaints, violations, investigation, etc.)
              │
              ▼
┌────────────────────────────────────────────────────────┐
│ Admin clicks "Suspend" button                          │
│                                                        │
│ Enters reason:                                         │
│ "Multiple patient complaints. Under investigation."    │
│                                                        │
│ POST /api/admin/providers/{type}/{id}/suspend         │
│ {                                                      │
│   reason: "Multiple patient complaints..."            │
│ }                                                      │
└────────────────────────────────────────────────────────┘
              │
              ▼ Backend Update
┌────────────────────────────────────────────────────────────┐
│ Update provider record:                                    │
│ {                                                          │
│   is_approved: false  ← Revoked                            │
│   approval_status: 'suspended'  ← Suspended status         │
│   approval_notes: "Suspended: Multiple complaints..."      │
│   is_active: false  ← Immediately hidden from patients     │
│   suspension_reason: "..." (for doctors only)              │
│   suspended_at: "2024-03-19T15:00:00Z"                    │
│ }                                                          │
│                                                            │
│ 1. Cancel all future appointments:                         │
│    UPDATE appointments SET status = 'cancelled'            │
│    WHERE provider_id = {id}                                │
│    AND status = 'scheduled'                                │
│                                                            │
│ 2. Notify affected patients:                               │
│    "Your appointment with Dr. X has been cancelled due    │
│     to provider unavailability. We'll help you reschedule"│
│                                                            │
│ 3. Broadcast suspension to real-time channels:             │
│    Socket.emit('provider.suspended', {                     │
│      providerId, action: 'removed_from_search'             │
│    })                                                      │
│                                                            │
│ 4. Invalidate caches immediately                           │
└────────────────────────────────────────────────────────────┘
              │
              ▼ Notifications
              │
        ┌─────┴──────┐
        │             │
        │             ▼ To Provider
        │          ┌──────────────────────────────┐
        │          │ Subject: Account Suspended   │
        │          │                              │
        │          │ Your account has been        │
        │          │ suspended by admin.          │
        │          │                              │
        │          │ Reason:                      │
        │          │ "Multiple patient           │
        │          │  complaints. Under           │
        │          │  investigation."             │
        │          │                              │
        │          │ [Appeal] [View Details]      │
        │          └──────────────────────────────┘
        │
        ├──────────► To Affected Patients
        │          ┌──────────────────────────────┐
        │          │ Your appointment with Dr. X │
        │          │ has been cancelled.          │
        │          │                              │
        │          │ We're helping you reschedule │
        │          │ with another doctor.         │
        │          │                              │
        │          │ [Reschedule Now]             │
        │          └──────────────────────────────┘
        │
        └──────────► Dashboard Update
                   Provider no longer appears in
                   any patient searches
                   Real-time update sent via socket

═══════════════════════════════════════════════════════════════════════════════
SCENARIO 3: ADMIN REACTIVATES SUSPENDED PROVIDER
═══════════════════════════════════════════════════════════════════════════════

Provider Status: approval_status = "suspended", is_active = false
Admin Decision: Reactivate (investigation complete, cleared, etc.)
              │
              ▼
┌────────────────────────────────────────────────────────┐
│ Admin clicks "Reactivate" button                       │
│                                                        │
│ Optional notes:                                        │
│ "Investigation complete. Provider cleared to resume." │
│                                                        │
│ POST /api/admin/providers/{type}/{id}/reactivate      │
│ {                                                      │
│   notes: "Investigation complete..."                  │
│ }                                                      │
└────────────────────────────────────────────────────────┘
              │
              ▼ Backend Update
┌────────────────────────────────────────────────────────────┐
│ Update provider record:                                    │
│ {                                                          │
│   is_approved: true  ← Restored                            │
│   approval_status: 'approved'  ← Back to approved          │
│   approval_notes: "Investigation complete..."              │
│   approved_by: "admin-uuid"                                │
│   approved_at: "2024-03-19T15:30:00Z"                     │
│   is_active: true  ← Back to visible                       │
│ }                                                          │
│                                                            │
│ Broadcast reactivation via socket                          │
└────────────────────────────────────────────────────────────┘
              │
              ▼ Notifications
              │
        ┌─────┴──────────────────┐
        │                         │
        │                         ▼ To Provider
        │                      ┌──────────────────┐
        │                      │ Account Restored │
        │                      │                  │
        │                      │ Your account has │
        │                      │ been reactivated │
        │                      │ and is now live. │
        │                      └──────────────────┘
        │
        └─────────────────────► Provider reappears in
                               patient searches
                               Can accept new
                               appointments
```

---

## Summary Table

| Scenario | Before | After | Patient Visibility | Can Accept Work |
|----------|--------|-------|-------------------|-----------------|
| Registration | N/A | pending | ❌ No | ❌ No |
| Admin Approves | pending | approved | ✅ Yes | ✅ Yes |
| Admin Rejects | pending | rejected | ❌ No | ❌ No |
| Admin Suspends | approved | suspended | ❌ No | ❌ No |
| Admin Reactivates | suspended | approved | ✅ Yes | ✅ Yes |

Each status change triggers:
- ✅ Real-time socket broadcasts
- ✅ Email/in-app notifications
- ✅ Cache invalidation
- ✅ Audit logging
- ✅ Patient visibility updates
