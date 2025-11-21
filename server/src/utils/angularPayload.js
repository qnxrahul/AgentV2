const clonePayload = (payload) => {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (error) {
    return payload;
  }
};

const ensureAdaptiveCardStructure = (rawPayload) => {
  const base = clonePayload(rawPayload);
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
        typeof src.mimeType === "string" ? src.mimeType.startsWith("video") : false
      )
  );
  const hasAudio = elements.some(
    (el) =>
      el.type === "Media" &&
      Array.isArray(el.sources) &&
      el.sources.some((src) =>
        typeof src.mimeType === "string" ? src.mimeType.startsWith("audio") : false
      )
  );
  const hasInputs = elements.some(
    (el) => typeof el.type === "string" && el.type.startsWith("Input.")
  );
  const textOnly =
    elements.length > 0 &&
    elements.every((el) => ["TextBlock", "RichTextBlock"].includes(el.type || ""));

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
    multi: "Multiple card sections reconstructed from the uploaded UI.",
    video: "Rich media playback experience.",
    audio: "Stream and review audio content.",
    media: "Interactive media presentation.",
    form: "Collect responses with interactive inputs.",
    text: "Structured textual content.",
    default: "Adaptive Card generated from the uploaded UI.",
  };

  return fallbackMessage[layoutType] || fallbackMessage.default;
};

const collectStats = (card) => {
  const elements = flattenAdaptiveCardElements(card.body);
  const elementCount = elements.length;
  const actionCount = Array.isArray(card.actions) ? card.actions.length : 0;
  const inputElements = elements.filter(
    (el) => typeof el.type === "string" && el.type.startsWith("Input.")
  );
  const inputCount = inputElements.length;
  const textCount = elements.filter((el) =>
    ["TextBlock", "RichTextBlock"].includes(el.type || "")
  ).length;
  const imageCount = elements.filter((el) => el.type === "Image").length;
  const columnSetCount = elements.filter((el) => el.type === "ColumnSet").length;
  let videoCount = 0;
  let audioCount = 0;
  const mediaElements = elements.filter((el) => el.type === "Media");
  mediaElements.forEach((media) => {
    if (!Array.isArray(media.sources)) return;
    media.sources.forEach((source) => {
      const mime = source?.mimeType || "";
      if (typeof mime === "string") {
        if (mime.startsWith("video")) {
          videoCount += 1;
        } else if (mime.startsWith("audio")) {
          audioCount += 1;
        }
      }
    });
  });
  const fileUploadCount = elements.filter((el) => el.type === "Input.File").length;
  const hasMedia = mediaElements.length > 0;
  const hasFileUpload = fileUploadCount > 0;

  return {
    elementCount,
    actionCount,
    inputCount,
    textCount,
    imageCount,
    columnSetCount,
    videoCount,
    audioCount,
    fileUploadCount,
    hasMedia,
    hasFileUpload,
  };
};

const extractInputDefaults = (card) => {
  const defaults = {};

  const applyValue = (node) => {
    if (!node || typeof node !== "object") return;
    const inputType = typeof node.type === "string" ? node.type : "";
    if (!inputType.startsWith("Input.")) return;

    const key = node.id || node.name || node.inputId;
    if (!key) return;

    let value = null;
    if (Object.prototype.hasOwnProperty.call(node, "value")) {
      value = node.value;
    } else if (Object.prototype.hasOwnProperty.call(node, "defaultValue")) {
      value = node.defaultValue;
    } else if (Object.prototype.hasOwnProperty.call(node, "placeholder")) {
      value = node.placeholder;
    }

    if (inputType === "Input.Toggle") {
      value = node.value || node.valueOn || "true";
    }

    if (inputType === "Input.ChoiceSet" && node.isMultiSelect) {
      const delimiter = typeof node.valueSeparator === "string" ? node.valueSeparator : ",";
      const raw = node.value || "";
      value = raw ? raw.split(delimiter).map((item) => item.trim()) : [];
    }

    defaults[key] = value;
  };

  const traverse = (target) => {
    if (!target) return;
    if (Array.isArray(target)) {
      target.forEach(traverse);
      return;
    }
    if (typeof target !== "object") return;

    applyValue(target);

    traverse(target.body);
    traverse(target.items);
    traverse(target.columns);
    traverse(target.rows);
    traverse(target.actions);
    traverse(target.cards);
  };

  traverse(card);
  return defaults;
};

const buildAngularCompatiblePayload = (rawPayload) => {
  const normalized = ensureAdaptiveCardStructure(rawPayload);
  const layoutType = detectCardLayout(normalized);
  const title = extractTitleFromCard(normalized);
  const subtitle = extractSubtitleFromCard(normalized, layoutType);
  const stats = collectStats(normalized);
  const defaults = extractInputDefaults(normalized);
  const adaptiveCardDataObject = Object.entries(defaults).map(([key, value]) => ({
    key,
    value,
  }));

  const AdaptiveAnswerMetaData = {
    title,
    subtitle,
    layoutType,
    stats,
    version: normalized.version || "1.5",
    schema: normalized.$schema || "http://adaptivecards.io/schemas/adaptive-card.json",
    generatedAt: new Date().toISOString(),
  };

  const layout = {
    columnTitle: title,
    isPopupView: false,
    isColumnTitleVisible: true,
    descriptorLayoutType: layoutType,
  };

  const adaptiveCardObject = [
    {
      id: normalized.id || "generatedAdaptiveCard",
      layout,
      defaultdata: defaults,
      adaptiveCardSchema: normalized,
      metadata: AdaptiveAnswerMetaData,
    },
  ];

  return {
    adaptiveCardObject,
    adaptiveCardDataObject,
    AdaptiveAnswerMetaData,
  };
};

module.exports = {
  buildAngularCompatiblePayload,
  ensureAdaptiveCardStructure,
};
