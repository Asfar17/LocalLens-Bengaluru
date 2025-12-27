/**
 * Load environment variables from .env file
 * This file should be imported FIRST in the application
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
