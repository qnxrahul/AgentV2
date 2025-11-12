import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveCard, HostConfig } from "adaptivecards";
import "adaptivecards/dist/adaptivecards.css";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const MICROSOFT_HOST_CONFIG = {
  spacing: {
    small: 4,
    default: 8,
    medium: 12,
    large: 16,
    extraLarge: 24,
    padding: 16,
  },
  separator: {
    lineThickness: 1,
    lineColor: "#E6E6E6",
  },
  supportsInteractivity: true,
  fontTypes: {
    default: {
      fontFamily: "Segoe UI, SegoeUI, \"Helvetica Neue\", Helvetica, Arial",
      fontSizes: {
        small: 10,
        default: 12,
        medium: 14,
        large: 17,
        extraLarge: 21,
      },
      fontWeights: {
        lighter: 200,
        default: 400,
        bolder: 600,
      },
    },
    monospace: {
      fontFamily:
        "\"Cascadia Mono\", \"Segoe UI Mono\", \"SFMono-Regular\", Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
      fontSizes: {
        small: 10,
        default: 12,
        medium: 14,
        large: 17,
        extraLarge: 21,
      },
      fontWeights: {
        lighter: 200,
        default: 400,
        bolder: 600,
      },
    },
  },
  containerStyles: {
    default: {
      backgroundColor: "#FFFFFF",
      foregroundColors: {
        default: { default: "#201F1E", subtle: "#605E5C" },
        accent: { default: "#0078D4", subtle: "#005A9E" },
        attention: { default: "#D13438", subtle: "#A80000" },
        good: { default: "#107C10", subtle: "#0B5A0B" },
        warning: { default: "#FBBC05", subtle: "#8E6400" },
      },
    },
    emphasis: {
      backgroundColor: "#F3F2F1",
      foregroundColors: {
        default: { default: "#323130", subtle: "#605E5C" },
        accent: { default: "#0078D4", subtle: "#005A9E" },
        attention: { default: "#D13438", subtle: "#A80000" },
        good: { default: "#107C10", subtle: "#0B5A0B" },
        warning: { default: "#FBBC05", subtle: "#8E6400" },
      },
    },
  },
  imageSizes: {
    small: 40,
    medium: 80,
    large: 120,
  },
  actions: {
    maxActions: 5,
    spacing: "default",
    buttonSpacing: 8,
    showCard: {
      actionMode: "inline",
      inlineTopMargin: 16,
    },
    actionsOrientation: "horizontal",
    actionAlignment: "stretch",
  },
  adaptiveCard: {
    allowCustomStyle: false,
  },
  factSet: {
    title: {
      color: "default",
      size: "default",
      isSubtle: false,
      weight: "bolder",
      wrap: true,
      maxWidth: 150,
    },
    value: {
      color: "default",
      size: "default",
      isSubtle: false,
      weight: "default",
      wrap: true,
    },
    spacing: 12,
  },
};

const cloneCardPayload = (payload) => {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to clone Adaptive Card payload", error);
    return payload;
  }
};

const ensureAdaptiveCardStructure = (rawPayload) => {
  const base = cloneCardPayload(rawPayload);
  if (!base || typeof base !== "object") {
    return {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.5",
      body: [],
      actions: [],
    };
  }

  if (base.type === "AdaptiveCard") {
    if (!Array.isArray(base.body)) {
      base.body = [];
    }
    if (base.actions && !Array.isArray(base.actions)) {
      base.actions = [];
    }
    return base;
  }

  const fallbackBody = Array.isArray(base.body)
    ? base.body
    : Array.isArray(base.items)
      ? base.items
      : [];

  return {
    $schema:
      typeof base.$schema === "string"
        ? base.$schema
        : "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: base.version || "1.5",
    body: fallbackBody,
    actions: Array.isArray(base.actions) ? base.actions : [],
  };
};

const flattenAdaptiveCardElements = (node, acc = []) => {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((item) => flattenAdaptiveCardElements(item, acc));
    return acc;
  }
  if (typeof node !== "object") return acc;

  if (node.type) {
    acc.push(node);
  }

  if (Array.isArray(node.body)) {
    flattenAdaptiveCardElements(node.body, acc);
  }
  if (Array.isArray(node.items)) {
    flattenAdaptiveCardElements(node.items, acc);
  }
  if (Array.isArray(node.columns)) {
    node.columns.forEach((col) =>
      flattenAdaptiveCardElements(col.items || col.body, acc)
    );
  }
  if (Array.isArray(node.rows)) {
    flattenAdaptiveCardElements(node.rows, acc);
  }
  if (Array.isArray(node.actions)) {
    flattenAdaptiveCardElements(node.actions, acc);
  }
  if (Array.isArray(node.cards)) {
    flattenAdaptiveCardElements(node.cards, acc);
  }

  return acc;
};

const detectCardLayout = (card) => {
  const elements = flattenAdaptiveCardElements(card.body);

  const hasMediaElement = elements.some((el) => el.type === "Media");
  const hasVideo = elements.some(
    (el) =>
      el.type === "Media" &&
      Array.isArray(el.sources) &&
      el.sources.some((src) =>
        typeof src.mimeType === "string"
          ? src.mimeType.startsWith("video")
          : false
      )
  );
  const hasAudio = elements.some(
    (el) =>
      el.type === "Media" &&
      Array.isArray(el.sources) &&
      el.sources.some((src) =>
        typeof src.mimeType === "string"
          ? src.mimeType.startsWith("audio")
          : false
      )
  );
  const hasInputs = elements.some(
    (el) => typeof el.type === "string" && el.type.startsWith("Input.")
  );
  const textOnly =
    elements.length > 0 &&
    elements.every((el) =>
      ["TextBlock", "RichTextBlock"].includes(el.type || "")
    );

  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  if (hasMediaElement) return "media";
  if (hasInputs) return "form";
  if (textOnly) return "text";
  return "default";
};

const extractTextBlocks = (card) => {
  const elements = flattenAdaptiveCardElements(card.body);
  return elements.filter((el) => el.type === "TextBlock" && el.text);
};

const extractTitleFromCard = (card) => {
  if (typeof card.title === "string" && card.title.trim()) {
    return card.title.trim();
  }

  const textBlocks = extractTextBlocks(card);
  const priorityBlock =
    textBlocks.find(
      (block) =>
        ["ExtraLarge", "Large"].includes(block.size || "") ||
        block.weight === "Bolder"
    ) || textBlocks[0];

  return priorityBlock?.text || "Generated Adaptive Card";
};

const extractSubtitleFromCard = (card, layoutType) => {
  if (typeof card.subtitle === "string" && card.subtitle.trim()) {
    return card.subtitle.trim();
  }
  if (typeof card.summary === "string" && card.summary.trim()) {
    return card.summary.trim();
  }

  const textBlocks = extractTextBlocks(card);
  if (textBlocks.length > 1) {
    return textBlocks[1].text;
  }

  const fallbackMessage = {
    multi: "Multiple card views reconstructed from the uploaded UI.",
    video: "Rich media playback experience.",
    audio: "Stream and review audio content.",
    media: "Interactive media presentation.",
    form: "Collect responses with interactive inputs.",
    text: "Structured textual content.",
    default: "Adaptive Card generated from the uploaded UI.",
  };

  return fallbackMessage[layoutType] || fallbackMessage.default;
};

const heroIconMap = {
  multi: "🗂️",
  video: "🎬",
  audio: "🎧",
  media: "🖼️",
  form: "📝",
  text: "📰",
  default: "✨",
};

const heroStyleMap = {
  multi: "emphasis",
  video: "accent",
  audio: "accent",
  media: "accent",
  form: "emphasis",
  text: "default",
  default: "default",
};

const collectCardsFromPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload
      .filter(Boolean)
      .map((entry) => ensureAdaptiveCardStructure(entry));
  }
  return [ensureAdaptiveCardStructure(payload)];
};

const normalizeAdaptiveCardPayload = (payload) => {
  const cards = collectCardsFromPayload(payload);

  if (cards.length <= 1) {
    return cards[0];
  }

  const sections = cards.map((card, index) => {
    const items = Array.isArray(card.body) ? card.body : [];
    const actions =
      Array.isArray(card.actions) && card.actions.length > 0
        ? [
            {
              type: "ActionSet",
              actions: card.actions,
            },
          ]
        : [];

    return {
      type: "Container",
      id: `__cardSection_${index}`,
      style: index % 2 === 0 ? "default" : "emphasis",
      spacing: index === 0 ? "Large" : "Medium",
      bleed: true,
      items: [...items, ...actions],
    };
  });

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: sections,
  };
};

const createHeroLayout = (layoutType, title, subtitle) => ({
  type: "Container",
  id: "__heroLayout",
  style: heroStyleMap[layoutType] || heroStyleMap.default,
  bleed: true,
  spacing: "Large",
  items: [
    {
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "auto",
          verticalContentAlignment: "Center",
          items: [
            {
              type: "TextBlock",
              text: heroIconMap[layoutType] || heroIconMap.default,
              size: "ExtraLarge",
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: title,
              wrap: true,
              size: "Large",
              weight: "Bolder",
              spacing: "None",
            },
            subtitle
              ? {
                  type: "TextBlock",
                  text: subtitle,
                  wrap: true,
                  spacing: "Small",
                  isSubtle: true,
                }
              : null,
          ].filter(Boolean),
        },
      ],
    },
  ],
});

const augmentAdaptiveCardLayout = (rawPayload) => {
  const sourceCards = collectCardsFromPayload(rawPayload);
  const adaptiveCard = normalizeAdaptiveCardPayload(rawPayload);

  if (!Array.isArray(adaptiveCard.body)) {
    adaptiveCard.body = [];
  }

  const alreadyHasHero = adaptiveCard.body.some(
    (item) => item?.id === "__heroLayout"
  );
  if (alreadyHasHero) {
    return adaptiveCard;
  }

  const layoutType =
    sourceCards.length > 1
      ? sourceCards
          .map((card) => detectCardLayout(card))
          .find((type) => type !== "default") || "multi"
      : detectCardLayout(sourceCards[0]);

  const title =
    sourceCards.length > 1
      ? `${sourceCards.length} Adaptive Cards`
      : extractTitleFromCard(sourceCards[0]);

  const subtitle =
    sourceCards.length > 1
      ? extractSubtitleFromCard(sourceCards[0], layoutType) ||
        "Multiple card views reconstructed from the uploaded UI."
      : extractSubtitleFromCard(sourceCards[0], layoutType);

  const heroContainer = createHeroLayout(layoutType, title, subtitle);

  adaptiveCard.body = [heroContainer, ...adaptiveCard.body];

  return adaptiveCard;
};

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const cardHostRef = useRef(null);

  const isGenerating = status === "generating";

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!cardHostRef.current) {
      return;
    }
    cardHostRef.current.innerHTML = "";
    setPreviewError("");

    if (!result?.cardJson) {
      return;
    }

    try {
      const payload =
        typeof result.cardJson === "string"
          ? JSON.parse(result.cardJson)
          : result.cardJson;
      const normalizedPayload = augmentAdaptiveCardLayout(payload);
      const adaptiveCard = new AdaptiveCard();
      adaptiveCard.hostConfig = new HostConfig(MICROSOFT_HOST_CONFIG);
      adaptiveCard.parse(normalizedPayload);
      const renderedCard = adaptiveCard.render();
      cardHostRef.current.appendChild(renderedCard);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to render Adaptive Card."
      );
    }
  }, [result]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, JPEG).");
      return;
    }

    setError("");
    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      setError("Upload a UI image before generating.");
      return;
    }

    setError("");
    setStatus("generating");
    setResult(null);
    setPreviewError("");

    const formData = new FormData();
    formData.append("uiImage", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error || "Generation request failed.");
      }

      const data = await response.json();
      setResult(data);
      setStatus("completed");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the Adaptive Card."
      );
      setStatus("error");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setStatus("idle");
    setError("");
    setPreviewError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus((prev) => (prev === "generating" ? prev : "copied"));
      setTimeout(
        () =>
          setStatus((prev) => (prev === "copied" ? "completed" : prev)),
        1500
      );
    } catch (err) {
      setError("Unable to copy to clipboard.");
    }
  };

  const handleDownloadJson = () => {
    if (!result?.cardJson) {
      return;
    }
    const payload =
      typeof result.cardJson === "string"
        ? result.cardJson
        : JSON.stringify(result.cardJson, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "adaptive-card.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const cardJsonString = useMemo(() => {
    if (!result?.cardJson) {
      return "";
    }
    return typeof result.cardJson === "string"
      ? result.cardJson
      : JSON.stringify(result.cardJson, null, 2);
  }, [result]);

  const cardPageString = useMemo(() => result?.cardPage ?? "", [result]);

  return (
    <div className="app">
      <header>
        <h1>Create Your Own Agent V2</h1>
        <p>
          Upload a UI screenshot or mockup. We&apos;ll analyze it and return the
          Adaptive Card payload and a ready-to-use Clara AI page.
        </p>
      </header>

      <section className="uploader">
        <div className="upload-box">
          <label className="upload-label" htmlFor="ui-image">
            <span>Drop or browse your UI image</span>
            <small>PNG, JPG up to 10MB</small>
          </label>
          <input
            id="ui-image"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <button className="secondary" type="button" onClick={handleReset}>
              Remove image
            </button>
          )}
        </div>
        <button
          className="primary"
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Adaptive Card"}
        </button>
      </section>

      {previewUrl && (
        <section className="image-preview">
          <h2>Uploaded UI</h2>
          <img src={previewUrl} alt="Uploaded UI preview" />
        </section>
      )}

      {error && <div className="alert error">{error}</div>}
      {previewError && <div className="alert warning">{previewError}</div>}

      {result && (
        <section className="results">
          <div className="result-card">
            <div className="result-header">
              <h2>Adaptive Card Preview</h2>
            </div>
            <div className="card-preview">
              <div className="card-preview-stage">
                <div className="card-host" ref={cardHostRef} />
              </div>
            </div>
          </div>

          <div className="result-card result-card--fancy">
            <div className="fancy-card">
              <div className="fancy-card-header">
                <div className="fancy-card-title">
                  <span className="fancy-card-dot" />
                  <span>Adaptive Card JSON</span>
                </div>
                <span className="fancy-card-badge">Schema 1.5</span>
              </div>
              <div className="fancy-card-body">
                <pre className="code-block">{cardJsonString}</pre>
              </div>
              <div className="fancy-card-actions">
                <button
                  className="ghost-button ghost-button--accent"
                  type="button"
                  onClick={handleDownloadJson}
                >
                  Download JSON
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleCopy(cardJsonString)}
                >
                  Copy Payload
                </button>
              </div>
            </div>
          </div>

          <div className="result-card result-card--fancy">
            <div className="fancy-card">
              <div className="fancy-card-header">
                <div className="fancy-card-title">
                  <span className="fancy-card-dot fancy-card-dot--secondary" />
                  <span>Clara AI Page Snippet</span>
                </div>
                <span className="fancy-card-badge fancy-card-badge--secondary">
                  JSX
                </span>
              </div>
              <div className="fancy-card-body">
                <pre className="code-block">{cardPageString}</pre>
              </div>
              <div className="fancy-card-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleCopy(cardPageString)}
                >
                  Copy Snippet
                </button>
              </div>
            </div>
          </div>

          {result.notes && (
            <div className="result-card result-card--fancy">
              <div className="fancy-card">
                <div className="fancy-card-header">
                  <div className="fancy-card-title">
                    <span className="fancy-card-dot fancy-card-dot--tertiary" />
                    <span>Model Notes</span>
                  </div>
                  <span className="fancy-card-badge fancy-card-badge--tertiary">
                    Insights
                  </span>
                </div>
                <div className="fancy-card-body">
                  <p className="fancy-card-text">{result.notes}</p>
                </div>
                <div className="fancy-card-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleCopy(result.notes ?? "")}
                  >
                    Copy Notes
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
