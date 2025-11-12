const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const { jsonrepair } = require("jsonrepair");

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

const responseSchema = {
  name: "adaptive_card_response",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      cardJson: {
        description:
          "Adaptive Card payload targeting schema version 1.5. Provide as a valid JSON object.",
        type: "object",
      },
      cardPage: {
        description:
          "String containing JSX snippet that renders the Adaptive Card using the Adaptive Cards SDK.",
        type: "string",
      },
      notes: {
        description: "Optional implementation notes or assumptions.",
        type: "string",
      },
      error: {
        description: "Optional error message when generation fails.",
        type: "string",
      },
    },
    oneOf: [
      { required: ["error"] },
      { required: ["cardJson", "cardPage"] },
    ],
  },
};

const looksLikeAdaptiveCard = (value) =>
  value &&
  typeof value === "object" &&
  (value.type === "AdaptiveCard" ||
    (typeof value.$schema === "string" &&
      value.$schema.includes("adaptive-card")));

const createCardPageSnippet = (cardJson) => {
  const payloadString = JSON.stringify(cardJson, null, 2);
  return `
import { useEffect, useRef } from "react";
import { AdaptiveCard } from "adaptivecards";

const cardPayload = ${payloadString};

export default function ClaraAdaptiveCard() {
  const hostRef = useRef(null);

  useEffect(() => {
    const adaptiveCard = new AdaptiveCard();
    adaptiveCard.parse(cardPayload);
    const rendered = adaptiveCard.render();
    const host = hostRef.current;
    if (host) {
      host.innerHTML = "";
      host.appendChild(rendered);
    }
  }, []);

  return <div ref={hostRef} />;
}
  `.trim();
};

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
        response_format: { type: "json_schema", json_schema: responseSchema },
        temperature: Number.isFinite(Number(process.env.OPENROUTER_TEMPERATURE))
          ? Number(process.env.OPENROUTER_TEMPERATURE)
          : 0.1,
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
    const attemptParse = (text) => {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (err) {
        return null;
      }
    };

    parsed = attemptParse(outputText);

    let extracted;
    if (!parsed) {
      extracted = extractJsonObject(outputText);
      parsed = attemptParse(extracted);
    }

    if (!parsed) {
      const repairSource = extracted || outputText;
      try {
        parsed = JSON.parse(jsonrepair(repairSource));
      } catch (repairError) {
        throw new Error(
          `Failed to parse model output as JSON even after repair. Raw output: ${outputText}`
        );
      }
    }

    if (parsed.error) {
      return res.status(502).json({
        error: parsed.error,
      });
    }

    const cardJson =
      parsed.cardJson ??
      parsed.card_json ??
      parsed.cardJSON ??
      parsed.card_payload ??
      parsed.card ??
      null;
    const cardPage =
      parsed.cardPage ??
      parsed.card_page ??
      parsed.cardSnippet ??
      parsed.card_snippet ??
      parsed.page ??
      null;

    let resolvedCardJson = cardJson;
    if (!resolvedCardJson && looksLikeAdaptiveCard(parsed)) {
      resolvedCardJson = parsed;
    }

    if (!resolvedCardJson) {
      return res.status(502).json({
        error:
          "Model response missing required fields. Expected cardJson and cardPage.",
        raw: parsed,
      });
    }

    if (typeof resolvedCardJson === "string") {
      try {
        resolvedCardJson = JSON.parse(jsonrepair(resolvedCardJson));
      } catch (jsonError) {
        throw new Error(
          `Model returned cardJson string that could not be parsed. Raw value: ${resolvedCardJson}`
        );
      }
    }

    let resolvedCardPage = cardPage;
    let autoGeneratedPage = false;
    if (!resolvedCardPage) {
      resolvedCardPage = createCardPageSnippet(resolvedCardJson);
      autoGeneratedPage = true;
    } else if (typeof resolvedCardPage !== "string") {
      resolvedCardPage = JSON.stringify(resolvedCardPage, null, 2);
    }

    if (!resolvedCardPage) {
      return res.status(502).json({
        error:
          "Model response missing required fields. Expected cardJson and cardPage.",
        raw: parsed,
      });
    }

    let notes = parsed.notes || null;
    if (autoGeneratedPage) {
      const generatedNote =
        "Backend generated the Clara Adaptive Card page snippet because the model omitted it.";
      notes = notes ? `${notes}\n${generatedNote}` : generatedNote;
    }

    res.json({
      cardJson: resolvedCardJson,
      cardPage: resolvedCardPage,
      notes,
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
