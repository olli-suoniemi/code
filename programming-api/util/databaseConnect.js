import { postgres } from "../deps.js";

const decoder = new TextDecoder("utf-8");

const PGUSER = decoder.decode(Deno.readFileSync("/run/secrets/PGUSER"))
const PGPASSWORD = decoder.decode(Deno.readFileSync("/run/secrets/PGPASSWORD"))
const PGDATABASE = decoder.decode(Deno.readFileSync("/run/secrets/PGDATABASE"))
const PGHOST = decoder.decode(Deno.readFileSync("/run/secrets/PGHOST"))
const PGPORT = decoder.decode(Deno.readFileSync("/run/secrets/PGPORT"))

let sql;

try {
  sql = postgres({
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    host: PGHOST,
    port: parseInt(PGPORT, 10),
  });
} catch (error) {
  console.error("Error during database setup:", error);
  throw error;
}

// Test the connection
try {
  await sql`SELECT 1;`;
  console.log("Database connection successful!");
} catch (err) {
  console.error("Database connection failed:", err.message);
}

export { sql };