import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();
const sql = neon(process.env.POSTGRES_URL);

export default sql;