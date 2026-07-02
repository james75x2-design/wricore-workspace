const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Bulletproof CORS for any environment
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
      }

      const requestData = await request.json();
      const clientMessages = requestData.messages;

      // 2. Define the Dual-Engine Queue
      const modelQueue = [];

      // Primary: Google Gemini 2.5 Flash
      if (env.GEMINI_API_KEY) {
        modelQueue.push({
          provider: "gemini",
          model: "GEMINI-2.5-FLASH",
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", // Corrected Google Endpoint
          apiKey: env.GEMINI_API_KEY
        });
      }

      // Secondary: Groq Llama Fallbacks
      if (env.GROQ_API_KEY) {
        modelQueue.push({
          provider: "groq",
          model: "LLAMA-3.3-70B",
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: env.GROQ_API_KEY
        });
        modelQueue.push({
          provider: "groq",
          model: "LLAMA-3.1-8B",
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: env.GROQ_API_KEY
        });
      }

      if (modelQueue.length === 0) {
        return new Response(JSON.stringify({ error: "Configuration Error: Add GEMINI_API_KEY or GROQ_API_KEY to Cloudflare." }), { status: 500, headers: corsHeaders });
      }

      let successfulResponse = null;
      let lastErrorStatus = 500;

      // 3. Fallback Loop
      for (const activeModel of modelQueue) {
        try {
          const apiPayload = {
            model: activeModel.model.toLowerCase(),
            messages: clientMessages,
            temperature: requestData.temperature ?? 0.7,
            stream: false
          };

          const response = await fetch(activeModel.url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${activeModel.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(apiPayload)
          });

          if (!response.ok) {
            lastErrorStatus = response.status;
            console.warn(`[Worker] ${activeModel.model} failed with ${response.status}. Retrying...`);
            continue; // Skip to the next fallback model
          }

          successfulResponse = await response.json();
          // Inject the exact model name so the frontend UI can display it
          successfulResponse.model = activeModel.model; 
          break; // Success! Break the loop.

        } catch (err) {
          console.error(`[Worker] Fetch exception on ${activeModel.model}:`, err);
          continue;
        }
      }

      // 4. Return Data
      if (successfulResponse) {
        return new Response(JSON.stringify(successfulResponse), { status: 200, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "Dual Engine Exhausted: Both Gemini and Groq are rate-limited. Please try again." }), { status: 429, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy Exception: " + err.message }), { status: 500, headers: corsHeaders });
    }
  }
};