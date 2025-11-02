## Doctor API Guide

Base URL: http://localhost:3000

Auth: Add header `Authorization: Bearer <token>` for all endpoints under `/api/doctors/*`.

Content-Type: `application/json`

### Quick workflow

1) Register/Login to get a token
2) Update your profile, services, and current location
3) Discover pending appointment requests near you and accept (queue allows up to 2 accepted doctors)
4) Manage appointment status (CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED)
5) Close appointment with report and auto-pricing
6) Handle SOS invitations

---

## Auth

POST /api/doctors/auth/register

Request
```
{ "name": "Dr. John Smith", "email": "dr.john@example.com", "phone": "9000000001", "licenseNumber": "MED-12345", "yearsOfExperience": 10, "specialties": ["GENERAL_PHYSICIAN", "CARDIOLOGY"], "address": { "line1": "Clinic Street 10", "city": "Mumbai", "state": "MH", "postalCode": "400001", "country": "IN", "latitude": 19.076, "longitude": 72.8777 } }
```

Response 201
```
{ "token": "JWT_TOKEN", "user": { "id": "user_doc_1", "role": "DOCTOR", "doctor": { "id": "doc_1", "specialties": ["GENERAL_PHYSICIAN", "CARDIOLOGY"] } } }
```

POST /api/doctors/auth/login

Request
```
{ "email": "dr.john@example.com" }
```

Response 200
```
{ "token": "JWT_TOKEN", "user": { "id": "user_doc_1", "role": "DOCTOR", "doctor": { "id": "doc_1" } } }
```

---

## Profile

GET /api/doctors/profile/me

Response 200
```
{ "id": "user_doc_1", "name": "Dr. John Smith", "doctor": { "id": "doc_1", "bio": "Internal medicine specialist.", "yearsOfExperience": 12 }, "addresses": [ { "id": "link_1", "isPrimary": true, "address": { "id": "addr_1", "line1": "Clinic Street 10", "latitude": 19.076, "longitude": 72.8777 } } ] }
```

PATCH /api/doctors/profile/me

Request
```
{ "name": "Dr. John Smith", "licenseNumber": "MED-12345", "yearsOfExperience": 12, "specialties": ["GENERAL_PHYSICIAN"], "isActive": true, "bio": "Internal medicine specialist." }
```

Response 200
```
{ "id": "user_doc_1", "doctor": { "id": "doc_1", "yearsOfExperience": 12, "bio": "Internal medicine specialist." } }
```

PATCH /api/doctors/profile/location

Request
```
{ "lat": 19.076, "lng": 72.8777, "serviceRadiusKm": 7 }
```

Response 200
```
{ "id": "doc_1", "currentLocationLat": 19.076, "currentLocationLng": 72.8777, "serviceRadiusKm": 7 }
```

PATCH /api/doctors/profile/me/address

Request
```
{ "line1": "Clinic Street 10", "city": "Mumbai", "state": "MH", "postalCode": "400001", "country": "IN", "latitude": 19.076, "longitude": 72.8777 }
```

Response 200
```
{ "address": { "id": "addr_1", "line1": "Clinic Street 10" }, "message": "Primary address updated" }
```

---

## Services & Pricing

PATCH /api/doctors/services

Request
```
{ "services": [ { "specialty": "GENERAL_PHYSICIAN", "basePrice": 300, "perKmRate": 15, "isOnlineAvailable": true, "isHomeVisitAvailable": true, "description": "General checkups" } ] }
```

Response 200
```
{ "services": [ { "id": "svc_1", "doctorId": "doc_1", "specialty": "GENERAL_PHYSICIAN", "basePrice": 300, "perKmRate": 15 } ] }
```

---

## Appointments (Doctor side)

GET /api/doctors/appointments

Response 200
```
[ { "id": "assign_1", "appointmentId": "appt_1", "doctorId": "doc_1", "status": "ACCEPTED", "queuePosition": 1, "appointment": { "id": "appt_1", "status": "PENDING", "specialty": "GENERAL_PHYSICIAN" } } ]
```

GET /api/doctors/appointments/requests?lat=&lng=&radiusKm=5

Response 200
```
[ { "id": "appt_2", "status": "PENDING", "specialty": "GENERAL_PHYSICIAN", "address": { "latitude": 19.08, "longitude": 72.88 }, "distanceKm": 2.15 } ]
```

POST /api/doctors/appointments/:appointmentId/accept

Response 201
```
{ "id": "assign_2", "appointmentId": "appt_2", "doctorId": "doc_1", "status": "ACCEPTED", "queuePosition": 1, "acceptedAt": "2025-11-02T08:40:00.000Z" }
```

POST /api/doctors/appointments/:appointmentId/cancel

Response 200
```
{ "id": "assign_2", "status": "CANCELLED" }
```

PATCH /api/doctors/appointments/:appointmentId/status

Request
```
{ "status": "CONFIRMED" }
```

Response 200
```
{ "id": "appt_2", "status": "CONFIRMED" }
```

---

## Close Appointment (Report + Pricing)

POST /api/doctors/orders/close

Request
```
{ "appointmentId": "appt_1", "report": { "diagnosis": "Viral fever", "summary": "3-day fever", "recommendations": "Hydration, rest, paracetamol", "equipmentRequired": "Thermometer" }, "basePrice": 300, "distanceKm": 4.2, "autoGenerate": false }
```

Response 200
```
{ "appointment": { "id": "appt_1", "status": "COMPLETED", "total": 500.94, "closedAt": "2025-11-02T08:55:00.000Z" }, "pricing": { "base": 300, "perKm": 15, "km": 4.2, "transport": 63, "gst": 65.34, "platformFee": 72.6, "total": 500.94 } }
```

Notes
- If `autoGenerate: true` (or `report` omitted), an AI-generated report is created and merged with any provided fields.
- perKmRate falls back to 15 if no DoctorService is set for the appointment specialty.

---

## SOS (Doctor side)

GET /api/doctors/sos/invitations

Response 200
```
[ { "id": "invite_1", "sosId": "sos_1", "doctorId": "doc_1", "status": "INVITED", "sentAt": "2025-11-02T08:10:00.000Z", "sos": { "id": "sos_1", "description": "Severe chest pain...", "status": "PENDING" } } ]
```

POST /api/doctors/sos/:sosId/accept

Response 200
```
{ "id": "sos_1", "status": "ACCEPTED", "acceptedById": "doc_1" }
```
