const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const REQUIRED_ENV = ["OPENROUTER_API_KEY"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(
    `Warning: Missing environment variables: ${missingEnv.join(
      ", "
    )}. The generation endpoint will not function without them.`
  );
}

const systemPrompt = `
You are an assistant that converts UI screenshots into Adaptive Card payloads for integration with Clara AI.
You MUST respond with a single JSON object and nothing else—no markdown, no commentary, no code fences.
The JSON object MUST include:
  {
    "cardJson": <Adaptive Card JSON object targeting schema version 1.5>,
    "cardPage": <String containing JSX snippet that renders the Adaptive Card using Adaptive Cards SDK>,
    "notes": <Optional string with implementation notes>
  }
Use descriptive element ids and include sample data bindings. The "cardPage" value must be a valid JSON string (escape quotes/newlines as needed).
If you cannot produce a valid Adaptive Card, respond with:
  { "error": "Reason why generation failed." }
`.trim();

const extractJsonObject = (text) => {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-11b-vision-instruct";

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate", upload.single("uiImage"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "uiImage file is required." });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "Server misconfiguration: OPENROUTER_API_KEY is not set.",
    });
  }

  const mimeType = req.file.mimetype;
  const base64Image = req.file.buffer.toString("base64");

  try {
    const headers = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Generate the Adaptive Card response for this UI.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ error: { message: "Unknown error" } }));
      throw new Error(
        errorPayload?.error?.message ||
          `Model request failed with status ${response.status}`
      );
    }

    const completion = await response.json();

    const outputText =
      completion?.choices?.[0]?.message?.content?.trim?.() ?? "";
    if (!outputText) {
      throw new Error("No text output received from the model.");
    }

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      const extracted = extractJsonObject(outputText);
      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
        } catch (secondaryError) {
          throw new Error(
            `Failed to parse extracted JSON. Raw output: ${outputText}`
          );
        }
      } else {
        throw new Error(
          `Failed to parse model output as JSON. Raw output: ${outputText}`
        );
      }
    }

    if (!parsed.cardJson || !parsed.cardPage) {
      return res.status(502).json({
        error:
          "Model response missing required fields. Expected cardJson and cardPage.",
        raw: parsed,
      });
    }

    res.json({
      cardJson: parsed.cardJson,
      cardPage: parsed.cardPage,
      notes: parsed.notes || null,
    });
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: "Failed to generate Adaptive Card content.",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Adaptive Card generator listening on port ${PORT}`);
});
