import express from 'express'
import pg from 'pg';
import { sql } from "@vercel/postgres";
import dotenv from 'dotenv'

const app = express()
const port = process.env.PORT || 3000
const { Pool } = pg;

const postData = async (method, url, link) => {
    try {
        const response = await fetch(process.env.SHORTID_URL + 'api/create', {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey: process.env.API_KEY, url: link }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.error}`);
        }

        const result = await response.json();
        return result.shortUrl[0].shortid;
    } catch (error) {
        console.error('Error:', error);
    }
};

const deleteRecord = async (shortid) => {
    try {
        const response = await fetch(process.env.SHORTID_URL + "api/delete", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey: process.env.API_KEY, shortid }),
        });

        if (!response.ok) {
            const errorMessage = await response.text();
            console.error(`Delete request failed with status: ${response.status}, message: ${errorMessage}`);
            throw new Error(`${response.status}, message: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Error in deleteRecord:', error);
    }
}

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

app.get('/shortidendpoint', (req, res) => {
    return res.json({ url: process.env.SHORTID_URL });
})

app.get('/', async (req, res) => {
    try {
        const { rows } = await sql`SELECT link, title, shortid FROM links`;
        res.status(200).json(rows);
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
            const shortid = await postData('POST', process.env.SHORTID_URL + "/api/create", link);
            await sql`INSERT INTO links (title, link, shortid) VALUES (${title}, ${link}, ${shortid})`;
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
            if (rows.length > 0) {
                const shortid = rows[0].shortid;
                await deleteRecord(shortid)
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
