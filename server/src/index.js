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
- Examine the provided UI image and infer the layout, elements, and data bindings.
- Return a strict JSON object with the following fields:
  {
    "cardJson": <Adaptive Card JSON>,
    "cardPage": <HTML or JSX snippet that renders the Adaptive Card using the Adaptive Cards SDK>,
    "notes": <Optional implementation notes or assumptions as a string>
  }
- The Adaptive Card must target schema version 1.5 and be valid JSON.
- Use descriptive element ids and include sample data bindings.
- Ensure "cardPage" contains a minimal, ready-to-use snippet for a React component that renders the card with the Adaptive Cards SDK.
- Do not include markdown fences or commentary outside the JSON object.
`;

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
          {
            role: "system",
            content: systemPrompt.trim(),
          },
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
      throw new Error(
        `Failed to parse model output as JSON. Raw output: ${outputText}`
      );
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
