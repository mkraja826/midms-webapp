export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json(
        {
          ok: true,
          app: env.CAPDENT_APP_NAME || "CapDent",
          deployment: env.CAPDENT_DEPLOYMENT || "worker-project",
          hostname: url.hostname,
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-CapDent-Project": "worker",
          },
        }
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    headers.set("X-CapDent-Project", "worker");

    const contentType = headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
