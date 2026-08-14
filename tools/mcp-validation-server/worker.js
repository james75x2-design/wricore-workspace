export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Use POST", { status: 405 });
    }

    const body = await request.json();

    if (body.method === "tools/list") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Returns the supplied text.",
              inputSchema: {
                type: "object",
                properties: {
                  text: {
                    type: "string"
                  }
                },
                required: ["text"]
              }
            }
          ]
        }
      });
    }

    if (body.method === "tools/call") {
      const text =
        body?.params?.arguments?.text ??
        "";

      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [
            {
              type: "text",
              text
            }
          ]
        }
      });
    }

    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    });
  }
};
