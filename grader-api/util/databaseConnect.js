import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

// Read database credentials from secret files
const decoder = new TextDecoder("utf-8");

const PGUSER = decoder.decode(fs.readFileSync("/run/secrets/PGUSER"));
const PGPASSWORD = decoder.decode(fs.readFileSync("/run/secrets/PGPASSWORD"));
const PGDATABASE = decoder.decode(fs.readFileSync("/run/secrets/PGDATABASE"));
const PGHOST = decoder.decode(fs.readFileSync("/run/secrets/PGHOST"));
const PGPORT = decoder.decode(fs.readFileSync("/run/secrets/PGPORT"));

// Create a new PostgreSQL client
const client = new Client({
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  host: PGHOST,
  port: parseInt(PGPORT, 10),
});

// Connect to the database
async function connectDB() {
  try {
    await client.connect();
    console.log("Database connection successful!");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    throw err;
  }
}

// Connect to the database when the app starts
connectDB();

export { client };
