import express from 'express'
import pg from 'pg';
import { sql } from "@vercel/postgres";
import dotenv from 'dotenv'

const app = express()
const port = process.env.PORT || 3000
const { Pool } = pg;

dotenv.config()

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL
})

pool.connect((error) => {
    if (error) {
        console.log(error)
    }
})

app.get('/static-links', (req, res) => {
    res.json([
        { "link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-bez-opakovka-edp", "title": "montblanc legend blue without box" },
        { "link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-edp", "title": "montblanc legend blue" }
    ])
})

app.get('/', async (req, res) => {
    try {
        const { rows } = await sql`SELECT link, title FROM links`; // Log the result of the query
        res.json(rows);
    } catch (error) {
        console.error('Error fetching links:', error); // Log any errors
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})
