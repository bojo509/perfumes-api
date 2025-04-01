import express from 'express'
import sql from "../utilities.js";
import dotenv from 'dotenv'

const app = express()
const port = process.env.PORT || 3000

function extractDomain(url) {
    try {
        // Remove protocol and get domain
        return url.replace(/(https?:\/\/)?(www\.)?/i, '').split('/')[0];
    } catch (error) {
        console.error('Error processing URL:', error);
        return null;
    }
}

// Create a shortid for a given link using url shortener
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

// Delete a record from the url shortener
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

function getStringLength(str) {
    return str.length;
}

dotenv.config()
app.use(express.json())

// Returns url shortener link
app.get('/shortidendpoint', (req, res) => {
    return res.json({ url: process.env.SHORTID_URL });
})

// Returns discord webhook link
app.get('/webhook', (req, res) => {
    return res.json({ url: process.env.WEBHOOK_URL });
})

app.get('/venera/webhook', (req, res) => {
    return res.json({ url: process.env.VENERA_WEBHOOK_URL });
})

// Return all records and their links
app.get('/', async (req, res) => {
    try {
        const data = await sql(`SELECT p.title, pl.link, pl.shortid, pl.site FROM perfume p JOIN perfume_listing pl ON p.id = pl.perfume_id;`);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error });
    }
});

app.post('/create', async (req, res) => {
    try {
        const { title, link, authKey } = req.body;
        if (!title || !link || !authKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (authKey === process.env.AUTH_KEY) {
            const exists = await sql(`SELECT TITLE, public_id FROM perfume WHERE title = $1 ;`, [title]);
            // Create perfume-listing if the perfume record exists
            if (exists[0]) {
                const shortid = await postData('POST', link);
                const site = extractDomain(link);
                await sql(`
                    INSERT INTO perfume_listing (perfume_id, link, shortid, site) 
                    VALUES ($1, $2, $3, $4);
                `, [exists[0].public_id, link, shortid, site]);
                return res.status(201).json({ message: `Record created with title: ${title} and link: ${link}` });
            }
            // Create perfume record if it doesn't exist
            else {
                // Get the next public_id
                const nextPublicId = await sql(`SELECT COALESCE(MAX(public_id) + 1, 1) as next_id FROM perfume;`);

                await sql(`INSERT INTO perfume (title, public_id) VALUES ($1, $2);`, [title, nextPublicId[0].next_id]);

                const titleAndPublicId = await sql(`SELECT TITLE, public_id FROM perfume WHERE title = $1;`, [title]);
                const shortid = await postData('POST', link);
                await sql(`
                    INSERT INTO perfume_listing (perfume_id, link, shortid, site) 
                    VALUES ($1, $2, $3, $4);
                `, [titleAndPublicId[0].public_id, link, shortid, extractDomain(link)]);
                return res.status(201).json({ message: `Record created with title: ${title} and link: ${link}` });
            }
        }
        else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
            details: error
        });
    }
})

app.post('/delete-listing', async (req, res) => {
    const { link, authKey } = req.body;

    try {
        if (authKey === process.env.AUTH_KEY) {
            const data = await sql(`SELECT * FROM perfume_listing WHERE link = $1`, [link]);
            if (data.length > 0) {
                const shortid = data[0].shortid;
                await deleteRecord(shortid)
                await sql(`DELETE FROM perfume_listing WHERE link = $1`, [link]);
                return res.status(200).json({ message: `Record deleted successfully` });
            } else {
                return res.status(404).json({ error: 'Record not found' });
            }
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting perfume-listing:', error);
        return res.status(500).json({ error });
    }
})

app.post('/delete-perfume', async (req, res) => {
    const { title, authKey } = req.body;

    try {
        if (authKey === process.env.AUTH_KEY) {
            const data = await sql (`SELECT * FROM perfume WHERE title = $1`, [title]);
            if (data.length > 0) {
                const shortid = data[0].shortid;
                await deleteRecord(shortid)
                await sql(`DELETE FROM perfume WHERE title = $1`, [title]);
                return res.status(200).json({ message: `Record deleted successfully` });
            } else {
                return res.status(404).json({ error: 'Record not found' });
            }
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting perfume:', error);
        return res.status(500).json({ error});
    }
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})
