import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import doctorsAuth from './routes/doctors/auth.js'
import doctorsProfile from './routes/doctors/profile.js'
import doctorsAppointments from './routes/doctors/appointments.js'
import doctorsSos from './routes/doctors/sos.js'

import patientsAuth from './routes/patients/auth.js'
import patientsAppointments from './routes/patients/appointments.js'
import patientsSos from './routes/patients/sos.js'
import patientsMeds from './routes/patients/meds.js'
import { notFound, errorHandler } from './middlewares/errors.js'


dotenv.config()


const app = express();

app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())

// Health
app.get('/health', (req, res) => res.json({ ok: true }))

// Doctor routes
app.use('/api/doctors/auth', doctorsAuth)
app.use('/api/doctors/profile', doctorsProfile)
app.use('/api/doctors/appointments', doctorsAppointments)
app.use('/api/doctors/sos', doctorsSos)

// Patient routes
app.use('/api/patients/auth', patientsAuth)
app.use('/api/patients/appointments', patientsAppointments)
app.use('/api/patients/sos', patientsSos)
app.use('/api/patients', patientsMeds)

// Errors
app.use(notFound)
app.use(errorHandler)


app.listen(3000, (req,res)=>{
    console.log("App is listening on port 3000")
})