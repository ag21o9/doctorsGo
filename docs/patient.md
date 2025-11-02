## Patient API Guide

Base URL: http://localhost:3000

Auth: Add header `Authorization: Bearer <token>` for all endpoints under `/api/patients/*`.

Content-Type: `application/json`

### Quick workflow

1) Register/Login to get a token
2) Set profile and primary address (optional but recommended)
3) If unsure of specialty, run AI triage
4) Create an appointment (scheduled or on-spot; online or offline)
5) Optionally search/select doctors by specialty and proximity
6) Track/cancel appointments
7) View health status and reports
8) Use SOS for emergencies and order medicines when needed

---

## Auth

POST /api/patients/auth/register

Request
```
{ "name": "Jane Doe", "email": "jane@example.com", "phone": "9000000000", "gender": "FEMALE", "bloodType": "O_POS", "dateOfBirth": "1995-05-01" }
```

Response 201
```
{ "token": "JWT_TOKEN", "user": { "id": "user_123", "role": "PATIENT", "name": "Jane Doe", "patient": { "id": "pat_123" } } }
```

POST /api/patients/auth/login

Request
```
{ "email": "jane@example.com" }
```

Response 200
```
{ "token": "JWT_TOKEN", "user": { "id": "user_123", "role": "PATIENT", "patient": { "id": "pat_123" } } }
```

---

## Profile

GET /api/patients/profile/me

Response 200
```
{ "id": "user_123", "role": "PATIENT", "name": "Jane Doe", "patient": { "id": "pat_123" }, "addresses": [ { "id": "link_1", "isPrimary": true, "address": { "id": "addr_1", "line1": "221B Baker Street", "city": "London", "latitude": 51.5237, "longitude": -0.1586 } } ] }
```

PATCH /api/patients/profile/me

Request
```
{ "name": "Jane Q. Doe", "gender": "FEMALE", "bloodType": "O_POS", "dateOfBirth": "1995-05-01" }
```

Response 200
```
{ "id": "user_123", "name": "Jane Q. Doe", "patient": { "id": "pat_123" } }
```

PATCH /api/patients/profile/me/address

Request
```
{ "line1": "221B Baker Street", "line2": "Flat B", "city": "London", "state": "London", "postalCode": "NW1", "country": "UK", "latitude": 51.5237, "longitude": -0.1586 }
```

Response 200
```
{ "address": { "id": "addr_1", "line1": "221B Baker Street" }, "message": "Primary address updated" }
```

---

## AI Triage

POST /api/patients/triage

Request
```
{ "description": "Fever, sore throat for 2 days" }
```

Response 200
```
{ "specialty": "GENERAL_PHYSICIAN", "confidence": 0.82, "allowedSpecialties": ["GENERAL_PHYSICIAN", "CARDIOLOGY", "..."] }
```

---

## Appointments

POST /api/patients/appointments

Scheduled online example
```
{ "type": "SCHEDULED", "mode": "ONLINE", "specialty": "GENERAL_PHYSICIAN", "description": "Recurring headaches", "toolsRequired": "Previous prescriptions", "meetLink": "https://meet.example.com/abcd-1234", "scheduledAt": "2025-11-03T15:30:00.000Z", "isEmergency": false, "doctorId": "doc_123" }
```

Scheduled offline example
```
{ "type": "SCHEDULED", "mode": "OFFLINE", "specialty": "ORTHOPEDICS", "description": "Knee pain", "scheduledAt": "2025-11-04T10:00:00.000Z", "addressId": "addr_1", "isEmergency": false }
```

Response 201
```
{ "id": "appt_1", "status": "PENDING", "type": "SCHEDULED", "mode": "ONLINE", "specialty": "GENERAL_PHYSICIAN", "createdAt": "..." }
```

GET /api/patients/appointments

Response 200
```
[ { "id": "appt_1", "status": "PENDING", "specialty": "GENERAL_PHYSICIAN" } ]
```

POST /api/patients/appointments/:id/cancel

Response 200
```
{ "id": "appt_1", "status": "CANCELLED" }
```

---

## Find Doctors (as Patient)

GET /api/patients/doctors/by-specialty/:specialty

Example
```
GET /api/patients/doctors/by-specialty/GENERAL_PHYSICIAN
```

Response 200
```
[ { "id": "doc_1", "user": { "id": "user_doc_1", "name": "Dr. John Smith" }, "bio": "Internal medicine specialist.", "yearsOfExperience": 12, "services": [ { "id": "svc_1", "specialty": "GENERAL_PHYSICIAN", "basePrice": 300 } ] } ]
```

GET /api/patients/doctors/search?specialty=...&lat=&lng=&radiusKm=5&minPrice=&maxPrice=&mode=ONLINE|OFFLINE

Example
```
GET /api/patients/doctors/search?specialty=GENERAL_PHYSICIAN&radiusKm=7&mode=OFFLINE&minPrice=200&maxPrice=600
```

Response 200
```
{ "origin": { "lat": 19.076, "lng": 72.8777 }, "results": [ { "id": "doc_1", "name": "Dr. John Smith", "bio": "Internal medicine specialist.", "yearsOfExperience": 12, "distanceKm": 2.11, "service": { "id": "svc_1", "basePrice": 300, "perKmRate": 15 } } ] }
```

---

## SOS

POST /api/patients/sos

Request
```
{ "description": "Severe chest pain", "specialty": "CARDIOLOGY", "latitude": 28.6139, "longitude": 77.2090, "initialRadiusKm": 5 }
```

Response 201
```
{ "id": "sos_1", "status": "PENDING", "specialty": "CARDIOLOGY", "currentRadiusKm": 5 }
```

GET /api/patients/sos

Response 200
```
[ { "id": "sos_1", "status": "PENDING" } ]
```

POST /api/patients/sos/:id/cancel

Response 200
```
{ "id": "sos_1", "status": "CANCELLED" }
```

---

## Medicines

GET /api/patients/pharmacies/nearby

Response 200
```
[ { "id": "ph_1", "name": "City Pharmacy", "isActive": true } ]
```

POST /api/patients/orders

Request
```
{ "pharmacyId": "ph_1", "addressId": "addr_1", "items": [ { "inventoryId": "inv_1", "quantity": 2 }, { "inventoryId": "inv_2", "quantity": 1 } ] }
```

Response 201
```
{ "id": "order_1", "patientId": "pat_123", "total": 750, "items": [ { "id": "oi_1", "inventoryId": "inv_1", "quantity": 2, "unitPrice": 200 } ] }
```

GET /api/patients/orders

Response 200
```
[ { "id": "order_1", "total": 750, "items": [ { "id": "oi_1", "inventoryId": "inv_1", "quantity": 2 } ] } ]
```

---

## Health

GET /api/patients/health/status

Response 200
```
{ "countsBySpecialty": { "GENERAL_PHYSICIAN": 3 }, "lastReport": { "diagnosis": "Viral fever", "summary": "...", "recommendations": "..." }, "totalVisits": 4 }
```

GET /api/patients/health/appointments/:id/report

Response 200
```
{ "diagnosis": "Viral fever", "summary": "...", "recommendations": "...", "equipmentRequired": "Thermometer" }
```
