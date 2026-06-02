// Define standard CORS headers to permit browser-based fetch executions
const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Define list of trusted domains, specifically matching your GitHub Pages deployment
const ALLOWED_ORIGINS = [
  "https://james75x2-design.github.io",
  "https://james75x2.github.io",
];

// The priority sequence of active Groq models used for fallback
const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile", // Primary high-quality model
  "llama-3.1-8b-instant",     // Rapid low-latency backup
  "gemma2-9b-it",             // Secondary structural backup
  "mixtral-8x7b-32768"        // Final legacy structural fallback
];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    let allowOrigin = "https://james75x2-design.github.io";

    // Validate if request origin matches trusted list or any standard github.io subdomain
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".github.io"))) {
      allowOrigin = origin;
    }

    // Handle preflight OPTIONS requests immediately
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Allow-Origin": allowOrigin,
        },
      });
    }

    // Block non-POST requests to preserve endpoint security
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowOrigin,
          ...corsHeaders
        }
      });
    }

    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[Worker] Configuration Error: GROQ_API_KEY is undefined in environment variables.");
      return new Response(
        JSON.stringify({ error: "Proxy Configuration Error: Missing API credentials on the server side." }), 
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowOrigin,
            ...corsHeaders
          }
        }
      );
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON request payload." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowOrigin,
          ...corsHeaders
        }
      });
    }

    const clientMessages = requestData.messages;
    if (!clientMessages || !Array.isArray(clientMessages)) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'messages' field." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowOrigin,
          ...corsHeaders
        }
      });
    }

    // Prioritize the model requested by the client frontend if it exists
    const requestedModel = requestData.model;
    const modelQueue = [];

    if (requestedModel && FALLBACK_MODELS.includes(requestedModel)) {
      modelQueue.push(requestedModel);
      // Append other fallbacks in order, avoiding duplication
      for (const model of FALLBACK_MODELS) {
        if (model !== requestedModel) {
          modelQueue.push(model);
        }
      }
    } else {
      modelQueue.push(...FALLBACK_MODELS);
    }

    let successfulResponse = null;
    let fallbackTriggered = false;

    for (let i = 0; i < modelQueue.length; i++) {
      const activeModel = modelQueue[i];
      
      try {
        // Construct the clean OpenAI-compatible payload for the Groq completions endpoint
        const groqPayload = {
          model: activeModel,
          messages: clientMessages,
          temperature: requestData.temperature ?? 0.7,
          max_completion_tokens: requestData.max_completion_tokens ?? requestData.max_tokens,
          stream: false
        };

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "WriCoRe-Proxy-Worker/2.6"
          },
          body: JSON.stringify(groqPayload)
        });

        // If rate-limited (429) or transient server error (503), trigger next fallback model
        if (groqResponse.status === 429 || groqResponse.status === 503) {
          console.warn(`[Worker] Model '${activeModel}' returned status ${groqResponse.status}. Retrying with next model...`);
          fallbackTriggered = true;
          continue;
        }

        if (!groqResponse.ok) {
          const errorDetails = await groqResponse.text();
          console.error(`[Worker] Groq API returned failure status ${groqResponse.status} for model '${activeModel}': ${errorDetails}`);
          continue;
        }

        // Parse and record successful response data
        successfulResponse = await groqResponse.json();
        break;

      } catch (fetchError) {
        console.error(`[Worker] Exception thrown during completion fetch on model '${activeModel}':`, fetchError);
        continue;
      }
    }

    // Return the successful payload back to the frontend
    if (successfulResponse) {
      return new Response(JSON.stringify(successfulResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowOrigin,
          ...corsHeaders
        }
      });
    }

    // Exhausted all models due to continuous rate limits
    return new Response(
      JSON.stringify({ error: "High demand — please try again in a minute." }), 
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowOrigin,
          ...corsHeaders
        }
      }
    );
  }
};