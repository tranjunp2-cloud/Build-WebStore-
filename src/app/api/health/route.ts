/**
 * Health check endpoint for DO App Platform.
 *
 * Returns 200 OK without touching the database so the container passes
 * health checks even while Payload's pushDevSchema is still running.
 */
export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() })
}
