import express from 'express'

import cors from 'cors'


const app = express()



app.listen(process.env.PORT, (req,res)=>{
    console.log('APP Listening on PORT ', process.env.PORT);
})