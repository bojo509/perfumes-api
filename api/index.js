import express from 'express'
import pg from 'pg';
import { sql } from "@vercel/postgres";
import dotenv from 'dotenv'

const app = express()
const port = process.env.PORT || 3000
const { Pool } = pg;

dotenv.config()
app.use(express.json())

let pool;

const createPool = () => {
    pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        max: 20,
        idleTimeoutMillis: 3000000,
    });

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        reconnect();
    });
};

const reconnect = () => {
    console.log('Attempting to reconnect to the database...');
    createPool();
};

createPool();

app.get('/static-links', (req, res) => {
    res.json([
        { "link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-bez-opakovka-edp", "title": "montblanc legend blue without box" },
        { "link": "https://parfium.bg/mont-blanc-legend-blue-parfyumna-voda-za-mazhe-edp", "title": "montblanc legend blue" }
    ])
})

app.get('/', async (req, res) => {
    try {
        const { rows } = await sql`SELECT link, title FROM links`;
        res.json(rows);
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.get('/health-check', (req, res) => {
    try {
        res.status(200).json({ message: 'OK' });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/create-a-record', async (req, res) => {
    const { title, link, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            await sql`INSERT INTO links (title, link) VALUES (${title}, ${link})`;
            res.status(201).json({ message: `Record created with title: ${title} and link: ${link}` });
        }
        else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error inserting record:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/delete-a-record', async (req, res) => {
    const { title, link, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            const { rows } = await sql`SELECT * FROM links WHERE title = ${title} OR link = ${link}`;
            // Check if any rows were affected
            if (rows.length > 0) {
                await sql`DELETE FROM links WHERE title = ${title} OR link = ${link}`;
                res.status(200).json({ message: `Record deleted successfully` });
            } else {
                res.status(404).json({ error: 'Record not found' });
            }
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/delete-by-keyword', async (req, res) => {
    const { title, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            const { rows } = await sql`SELECT * FROM links WHERE title LIKE ${`%${title}%`}`;
            // Check if any rows were affected
            if (rows.length > 0) {
                await sql`DELETE FROM links WHERE title LIKE ${`%${title}%`}`;
                res.status(200).json({ message: `Records deleted successfully`, count: rows.length });
            } else {
                res.status(404).json({ error: 'No matching records found' });
            }
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting records:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})
