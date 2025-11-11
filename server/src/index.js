const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const REQUIRED_ENV = ["OPENAI_API_KEY"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(
    `Warning: Missing environment variables: ${missingEnv.join(
      ", "
    )}. The generation endpoint will not function without them.`
  );
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate", upload.single("uiImage"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "uiImage file is required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Server misconfiguration: OPENAI_API_KEY is not set.",
    });
  }

  const mimeType = req.file.mimetype;
  const base64Image = req.file.buffer.toString("base64");

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Generate the Adaptive Card response for this UI.",
            },
            {
              type: "input_image",
              mime_type: mimeType,
              image_base64: base64Image,
            },
          ],
        },
      ],
    });

    const outputText = response.output_text;
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
