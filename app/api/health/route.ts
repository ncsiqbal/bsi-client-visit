
export async function GET() {
  return Response.json({
    status: "ok",
    service: "bsi-client-visit",
    timestamp: new Date().toISOString(),
  });
}
