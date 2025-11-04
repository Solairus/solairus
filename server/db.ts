/**
 * Database connection helper using pg Pool.
 * Purpose: Centralize Postgres access for the backend.
 * Inputs: DATABASE_URL in environment (.env supported).
 * Outputs: export query() and pool for executing SQL.
 */
import 'dotenv/config'
import { Pool, QueryResult, QueryResultRow } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  // Fail fast with clear error if DATABASE_URL is missing
  throw new Error('DATABASE_URL is not set. Please configure .env')
}

export const pool = new Pool({ connectionString })

/**
 * Execute a SQL query with parameters.
 * @param text - SQL string
 * @param params - Parameter values
 */
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return params ? pool.query<T>(text, params as unknown[]) : pool.query<T>(text)
}