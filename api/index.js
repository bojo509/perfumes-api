import express from 'express'
import pg from 'pg';
import { sql } from "@vercel/postgres";
import dotenv from 'dotenv'

const app = express()
const port = process.env.PORT || 3000
const { Pool } = pg;

const postData = async (method, link) => {
    try {
        const response = await fetch(process.env.SHORTENER_URL + 'api/create', {
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
        const response = await fetch(process.env.SHORTENER_URL + "api/delete", {
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

app.get('/webhook', (req, res) => {
    return res.json({ url: process.env.WEBHOOK_URL });
})

app.get('/venera/webhook', (req, res) => {
    return res.json({ url: process.env.VENERA_WEBHOOK_URL });
})

app.get('/', async (req, res) => {
    try {
        const { rows } = await sql`SELECT link, title, shortid FROM links`;
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching links:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.get('/venera', async (req, res) => {
    try {
        const { rows } = await sql`SELECT link, title, shortid FROM venera`;
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching links:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.get('/health-check', (req, res) => {
    try {
        return res.status(200).json({ message: 'OK' });
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/create-a-record', async (req, res) => {
    const { title, link, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            const shortid = await postData('POST', link);
            await sql`INSERT INTO links (title, link, shortid) VALUES (${title}, ${link}, ${shortid})`;
            return res.status(201).json({ message: `Record created with title: ${title} and link: ${link}` });
        }
        else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error inserting record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/venera/create-a-record', async (req, res) => {
    const { title, link, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            const shortid = await postData('POST', link);
            await sql`INSERT INTO venera (title, link, shortid) VALUES (${title}, ${link}, ${shortid})`;
            return res.status(201).json({ message: `Record created with title: ${title} and link: ${link}` });
        }
        else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error inserting record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
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
                return res.status(200).json({ message: `Record deleted successfully` });
            } else {
                return res.status(404).json({ error: 'Record not found' });
            }
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/venera/delete-a-record', async (req, res) => {
    const { title, link, authKey } = req.body;

    try {
        if (authKey === process.env.AUTH_KEY) {
            const { rows } = await sql`SELECT * FROM venera WHERE title = ${title} OR link = ${link}`;
            if (rows.length > 0) {
                const shortid = rows[0].shortid;
                await deleteRecord(shortid)
                await sql`DELETE FROM venera WHERE title = ${title} OR link = ${link}`;
                return res.status(200).json({ message: `Record deleted successfully` });
            } else {
                return res.status(404).json({ error: 'Record not found' });
            }
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.post('/delete-by-keyword', async (req, res) => {
    const { title, authKey } = req.body;
    try {
        if (authKey === process.env.AUTH_KEY) {
            const { rows } = await sql`SELECT * FROM links WHERE title LIKE ${`%${title}%`}`;
            if (rows.length > 0) {
                await sql`DELETE FROM links WHERE title LIKE ${`%${title}%`}`;
                return res.status(200).json({ message: `Records deleted successfully`, count: rows.length });
            } else {
                return res.status(404).json({ error: 'No matching records found' });
            }
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting records:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})
