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

const LAYOUT_ICON_MAP = {
  multi: "🗂️",
  video: "🎬",
  audio: "🎧",
  media: "🖼️",
  form: "📝",
  text: "📰",
  default: "✨",
};

const LAYOUT_STYLE_MAP = {
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

const KEYWORD_THEME_RULES = [
  {
    theme: "danger",
    keywords: [
      "critical",
      "failed",
      "error",
      "urgent",
      "severe",
      "sev 1",
      "blocked",
      "breach",
      "incident",
      "emergency",
    ],
  },
  {
    theme: "warning",
    keywords: [
      "warning",
      "risk",
      "pending",
      "overdue",
      "attention",
      "escalation",
      "issue",
      "alert",
      "caution",
      "review",
    ],
  },
  {
    theme: "success",
    keywords: [
      "success",
      "resolved",
      "completed",
      "approved",
      "done",
      "shipped",
      "delivered",
      "closed",
      "pass",
    ],
  },
  {
    theme: "info",
    keywords: ["info", "information", "details", "note", "update", "reminder"],
  },
];

const THEME_CONFIG = {
  danger: {
    heroStyle: "attention",
    heroIcon: "🚨",
    badgeText: "Critical Status",
    sectionStyle: "attention",
  },
  warning: {
    heroStyle: "attention",
    heroIcon: "⚠️",
    badgeText: "Needs Attention",
    sectionStyle: "attention",
  },
  success: {
    heroStyle: "good",
    heroIcon: "✅",
    badgeText: "On Track",
    sectionStyle: "good",
  },
  info: {
    heroStyle: "accent",
    heroIcon: "ℹ️",
    badgeText: "Information",
    sectionStyle: "default",
  },
  default: {
    heroStyle: null,
    heroIcon: null,
    badgeText: null,
    sectionStyle: null,
  },
};

const extractAllTextFromCard = (card) => {
  const textBlocks = extractTextBlocks(card);
  const raw = textBlocks.map((block) => block.text || "");
  if (typeof card.title === "string") raw.push(card.title);
  if (typeof card.subtitle === "string") raw.push(card.subtitle);
  if (typeof card.summary === "string") raw.push(card.summary);
  if (typeof card.status === "string") raw.push(card.status);
  if (typeof card.severity === "string") raw.push(card.severity);
  if (typeof card.priority === "string") raw.push(card.priority);
  return raw.join(" ").toLowerCase();
};

const determineCardTheme = (card, descriptorIndex = 0) => {
  const haystack = extractAllTextFromCard(card);
  for (const rule of KEYWORD_THEME_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.theme;
    }
  }
  return descriptorIndex % 2 === 0 ? "info" : "default";
};

const splitAdaptiveCardBody = (card) => {
  if (!card || typeof card !== "object") return [];
  if (card.type !== "AdaptiveCard") return [card];

  const bodyElements = Array.isArray(card.body) ? card.body : [];

  if (bodyElements.length <= 1) {
    return [card];
  }

  return bodyElements.map((element, index) => {
    const clonedElement = cloneCardPayload(element);
    const baseClone = cloneCardPayload(card);
    const splitCard = ensureAdaptiveCardStructure({
      ...baseClone,
      body: [clonedElement],
      actions: [],
    });
    splitCard.id = `${card.id || "card"}__section_${index}`;
    return splitCard;
  });
};

const extractPrimaryText = (card) => {
  const textBlocks = extractTextBlocks(card);
  if (textBlocks.length > 0) {
    return textBlocks[0].text?.trim() || "";
  }
  if (typeof card.title === "string" && card.title.trim()) {
    return card.title.trim();
  }
  if (typeof card.subtitle === "string" && card.subtitle.trim()) {
    return card.subtitle.trim();
  }
  if (typeof card.summary === "string" && card.summary.trim()) {
    return card.summary.trim();
  }
  return "";
};

const mapCardsWithMetadata = (payload) => {
  const cards = collectCardsFromPayload(payload).flatMap((card) =>
    splitAdaptiveCardBody(card)
  );

  return cards.map((card, index) => {
    const layoutType = detectCardLayout(card);
    const theme = determineCardTheme(card, index);
    const summary = extractPrimaryText(card);
    const elements = flattenAdaptiveCardElements(card.body);
    const elementCount = elements.length;
    const actionCount = Array.isArray(card.actions) ? card.actions.length : 0;
    const inputCount = elements.filter(
      (el) => typeof el.type === "string" && el.type.startsWith("Input.")
    ).length;
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
      card,
      layoutType,
      theme,
      summary,
      elementCount,
      actionCount,
      inputCount,
      hasMedia,
      index,
      textCount,
      imageCount,
      columnSetCount,
      videoCount,
      audioCount,
      fileUploadCount,
      hasFileUpload,
    };
  });
};

const THEME_PRIORITY = ["danger", "warning", "success", "info", "default"];

const determineAggregateTheme = (descriptors) => {
  for (const theme of THEME_PRIORITY) {
    if (descriptors.some((descriptor) => descriptor.theme === theme)) {
      return theme;
    }
  }
  return "default";
};

const themeToContainerStyle = (theme, index) => {
  if (index % 2 === 0) {
    return "emphasis";
  }
  const config = THEME_CONFIG[theme];
  if (config?.sectionStyle) {
    return config.sectionStyle;
  }
  return "default";
};

const composeMultiCardLayout = (descriptors) => {
  if (descriptors.length <= 1) {
    return descriptors[0]?.card ?? {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.5",
      body: [],
    };
  }

  const unwrapCardAsSection = (card) => {
    if (!card || typeof card !== "object") {
      return null;
    }

    if (card.type === "Container") {
      return card;
    }

    if (card.type === "ColumnSet" || card.type === "Column") {
      return {
        type: "Container",
        style: card.style,
        items: [card],
      };
    }

    if (card.type && card.type !== "AdaptiveCard") {
      return {
        type: "Container",
        style: card.style,
        items: [card],
      };
    }

    const items = Array.isArray(card.body) ? [...card.body] : [];
    if (Array.isArray(card.items)) {
      items.push(...card.items);
    }
    if (Array.isArray(card.columns)) {
      items.push({
        type: "ColumnSet",
        columns: card.columns,
      });
    }

    const actions =
      Array.isArray(card.actions) && card.actions.length > 0
        ? [
            {
              type: "ActionSet",
              spacing: "Medium",
              actions: card.actions,
            },
          ]
        : [];

    return {
      type: "Container",
      style: card.style,
      items: [...items, ...actions],
    };
  };

  const sections = descriptors.map(({ card, theme }, index) => {
    const section = unwrapCardAsSection(card) || {
      type: "Container",
      items: [],
    };

    section.id = `__cardSection_${index}`;
    section.style = section.style || card.style || themeToContainerStyle(theme, index);
    section.spacing = index === 0 ? "Large" : "Medium";
    section.separator = index > 0;
    section.bleed = typeof card.bleed === "boolean" ? card.bleed : true;

    if (card.backgroundImage) {
      section.backgroundImage = card.backgroundImage;
    }
    if (card.verticalContentAlignment) {
      section.verticalContentAlignment = card.verticalContentAlignment;
    }
    if (card.minHeight) {
      section.minHeight = card.minHeight;
    }
    if (card.selectAction) {
      section.selectAction = card.selectAction;
    }

    return section;
  });

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: sections,
  };
};

const prepareCardPresentation = (payload) => {
  const descriptors = mapCardsWithMetadata(payload);
  const normalized =
    descriptors.length > 1
      ? composeMultiCardLayout(descriptors)
      : descriptors[0]?.card ??
        ensureAdaptiveCardStructure({
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.5",
          body: [],
        });

  return { descriptors, normalized };
};

const createHeroLayout = ({ style, icon, title, subtitle, badgeText }) => ({
  type: "Container",
  id: "__heroLayout",
  style: style || "default",
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
              text: icon || LAYOUT_ICON_MAP.default,
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
        badgeText
          ? {
              type: "Column",
              width: "auto",
              items: [
                {
                  type: "TextBlock",
                  text: badgeText,
                  wrap: true,
                  weight: "Bolder",
                  horizontalAlignment: "Right",
                  spacing: "None",
                  isSubtle: true,
                },
              ],
            }
          : null,
      ].filter(Boolean),
    },
  ],
});

const augmentAdaptiveCardLayout = (rawPayload) => {
  const { descriptors, normalized } = prepareCardPresentation(rawPayload);
  const adaptiveCard = normalized;

  if (!Array.isArray(adaptiveCard.body)) {
    adaptiveCard.body = [];
  }

  const alreadyHasHero = adaptiveCard.body.some(
    (item) => item?.id === "__heroLayout"
  );
  if (alreadyHasHero) {
    return adaptiveCard;
  }

  const aggregateTheme = determineAggregateTheme(descriptors);
  const themeConfig = THEME_CONFIG[aggregateTheme] || THEME_CONFIG.default;

  const heroLayoutType =
    descriptors.length > 1
      ? descriptors.find((descriptor) => descriptor.layoutType !== "default")
          ?.layoutType || "multi"
      : descriptors[0]?.layoutType || "default";

  const layoutType =
    descriptors.length > 1 ? "multi" : descriptors[0]?.layoutType || "default";

  const title =
    descriptors.length > 1
      ? `${descriptors.length} Adaptive Cards`
      : extractTitleFromCard(descriptors[0]?.card ?? adaptiveCard);

  const subtitle = extractSubtitleFromCard(
    descriptors[0]?.card ?? adaptiveCard,
    layoutType
  );

  const heroIcon =
    themeConfig.heroIcon ||
    LAYOUT_ICON_MAP[heroLayoutType] ||
    LAYOUT_ICON_MAP.default;

  const heroStyle =
    themeConfig.heroStyle ||
    LAYOUT_STYLE_MAP[heroLayoutType] ||
    LAYOUT_STYLE_MAP.default;

  const badgeText =
    themeConfig.badgeText ||
    (layoutType === "multi"
      ? "Multi-card Layout"
      : {
          video: "Video Layout",
          audio: "Audio Layout",
          media: "Media Layout",
          form: "Interactive Form",
          text: "Text Layout",
          default: "Adaptive Card",
        }[layoutType] || "Adaptive Card");

  const heroContainer = createHeroLayout({
    style: heroStyle,
    icon: heroIcon,
    title,
    subtitle,
    badgeText,
  });

  adaptiveCard.body = [heroContainer, ...adaptiveCard.body];

  return { card: adaptiveCard, descriptors };
};

function AdaptiveCardRenderer({ payload, variant = "inline", metadata }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current || !payload) return;

    try {
      const adaptiveCardInstance = new AdaptiveCard();
      adaptiveCardInstance.hostConfig = new HostConfig(MICROSOFT_HOST_CONFIG);
      adaptiveCardInstance.parse(ensureAdaptiveCardStructure(payload));
      const rendered = adaptiveCardInstance.render();

      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(rendered);
    } catch (err) {
      hostRef.current.innerHTML = `<div class="card-render-error">Unable to render Adaptive Card${
        err instanceof Error ? `: ${err.message}` : ""
      }</div>`;
    }
  }, [payload]);

  const shellClassNames = [
    "card-fancy-shell",
    variant === "primary"
      ? "card-fancy-shell--primary"
      : "card-fancy-shell--inline",
  ].join(" ");

  const hostClassNames = [
    "card-host",
    variant === "primary" ? "card-host--primary" : "card-host--inline",
  ].join(" ");

  const overlayChips = useMemo(() => {
    if (!metadata) return [];
    const chips = [];
    if (metadata.summary) {
      chips.push({
        icon: "✨",
        label: metadata.summary,
        className: "overlay-chip--summary",
      });
    }
    if (metadata.textCount > 0) {
      chips.push({
        icon: "📝",
        label: `${metadata.textCount} text`,
        className: "overlay-chip--text",
      });
    }
    if (metadata.imageCount > 0) {
      chips.push({
        icon: "🖼️",
        label: `${metadata.imageCount} images`,
        className: "overlay-chip--image",
      });
    }
    if (metadata.videoCount > 0) {
      chips.push({
        icon: "🎬",
        label: `${metadata.videoCount} video`,
        className: "overlay-chip--video",
      });
    }
    if (metadata.audioCount > 0) {
      chips.push({
        icon: "🎧",
        label: `${metadata.audioCount} audio`,
        className: "overlay-chip--audio",
      });
    }
    if (metadata.fileUploadCount > 0 || metadata.hasFileUpload) {
      chips.push({
        icon: "📁",
        label: `${metadata.fileUploadCount || 1} upload`,
        className: "overlay-chip--file",
      });
    }
    if (metadata.columnSetCount > 0) {
      chips.push({
        icon: "🧩",
        label: `${metadata.columnSetCount} column sets`,
        className: "overlay-chip--layout",
      });
    }
    if (metadata.hasMedia && metadata.videoCount === 0 && metadata.audioCount === 0) {
      chips.push({
        icon: "🎞️",
        label: "Media",
        className: "overlay-chip--media",
      });
    }
    return chips;
  }, [metadata]);

  return (
    <div className={shellClassNames}>
      <div className="card-fancy-glow" />
      {overlayChips.length > 0 && (
        <div className="card-overlay">
          {overlayChips.map((chip, idx) => (
            <span
              key={`${chip.label}-${idx}`}
              className={`overlay-chip ${chip.className}`}
              data-icon={chip.icon}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}
      <div className={hostClassNames} ref={hostRef} />
    </div>
  );
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [cardDescriptors, setCardDescriptors] = useState([]);
  const [normalizedCard, setNormalizedCard] = useState(null);

  const isGenerating = status === "generating";

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setPreviewError("");

    if (!result?.cardJson) {
      setCardDescriptors([]);
      setNormalizedCard(null);
      return;
    }

    try {
      const payload =
        typeof result.cardJson === "string"
          ? JSON.parse(result.cardJson)
          : result.cardJson;
      const { card: normalizedPayload, descriptors } =
        augmentAdaptiveCardLayout(payload);
      setNormalizedCard(normalizedPayload);
      setCardDescriptors(descriptors);
    } catch (err) {
      setNormalizedCard(null);
      setCardDescriptors([]);
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
    setCardDescriptors([]);
    setNormalizedCard(null);

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
    setCardDescriptors([]);
    setNormalizedCard(null);
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

  const aggregateStats = useMemo(() => {
    if (!cardDescriptors.length) {
      return null;
    }
    return cardDescriptors.reduce(
      (acc, descriptor) => {
        acc.cards += 1;
        acc.elements += descriptor.elementCount;
        acc.actions += descriptor.actionCount;
        acc.inputs += descriptor.inputCount;
        acc.media += descriptor.hasMedia ? 1 : 0;
        acc.videos += descriptor.videoCount;
        acc.audios += descriptor.audioCount;
        acc.files += descriptor.fileUploadCount;
        acc.textBlocks += descriptor.textCount;
        acc.images += descriptor.imageCount;
        acc.columns += descriptor.columnSetCount;
        return acc;
      },
      {
        cards: 0,
        elements: 0,
        actions: 0,
        inputs: 0,
        media: 0,
        videos: 0,
        audios: 0,
        files: 0,
        textBlocks: 0,
        images: 0,
        columns: 0,
      }
    );
  }, [cardDescriptors]);

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
          <section className="results results--no-stage">
              {normalizedCard && (
              <div className="focus-card">
                <div className="focus-card-header">
                  <div>
                    <h2>Adaptive Card Overview</h2>
                    <p>Composite card reconstructed from the uploaded UI.</p>
                  </div>
                  {aggregateStats && (
                    <div className="focus-card-badges">
                      <span className="focus-chip">
                        {aggregateStats.cards} Cards
                      </span>
                      <span className="focus-chip focus-chip--muted">
                        {aggregateStats.elements} Elements
                      </span>
                      <span className="focus-chip focus-chip--muted">
                        {aggregateStats.actions} Actions
                      </span>
                      {aggregateStats.inputs > 0 && (
                        <span className="focus-chip focus-chip--muted">
                          {aggregateStats.inputs} Inputs
                        </span>
                      )}
                      {aggregateStats.media > 0 && (
                        <span className="focus-chip">
                          {aggregateStats.media} Media Blocks
                        </span>
                      )}
                        {aggregateStats.textBlocks > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.textBlocks} Text Blocks
                          </span>
                        )}
                        {aggregateStats.images > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.images} Images
                          </span>
                        )}
                        {aggregateStats.files > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.files} File Uploads
                          </span>
                        )}
                        {aggregateStats.videos > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.videos} Videos
                          </span>
                        )}
                        {aggregateStats.audios > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.audios} Audio Clips
                          </span>
                        )}
                        {aggregateStats.columns > 0 && (
                          <span className="focus-chip focus-chip--muted">
                            {aggregateStats.columns} Column Sets
                          </span>
                        )}
                    </div>
                  )}
                </div>
                  <AdaptiveCardRenderer
                    payload={normalizedCard}
                    variant="primary"
                    metadata={
                      aggregateStats
                        ? {
                            summary: "Composite Layout",
                            textCount: aggregateStats.textBlocks,
                            imageCount: aggregateStats.images,
                            videoCount: aggregateStats.videos,
                            audioCount: aggregateStats.audios,
                            fileUploadCount: aggregateStats.files,
                            columnSetCount: aggregateStats.columns,
                            hasMedia: aggregateStats.media > 0,
                          }
                        : undefined
                    }
                  />
                {aggregateStats && (
                  <div className="focus-card-meta">
                    <span className="focus-chip focus-chip--muted">
                      Generated with adaptive layout heuristics
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="multi-card-grid multi-card-grid--standalone">
              {cardDescriptors.map(
                ({
                  card,
                  theme,
                  layoutType,
                  summary,
                  elementCount,
                  actionCount,
                  inputCount,
                  hasMedia,
                  textCount,
                  imageCount,
                  columnSetCount,
                  videoCount,
                  audioCount,
                  fileUploadCount,
                  hasFileUpload,
                  index: cardIndex,
                }) => (
                  <div
                    key={`card-descriptor-${cardIndex}`}
                    className="multi-card-item multi-card-item--standalone"
                  >
                    <AdaptiveCardRenderer
                      payload={card}
                      metadata={{
                        summary,
                        textCount,
                        imageCount,
                        videoCount,
                        audioCount,
                        fileUploadCount,
                        columnSetCount,
                        hasFileUpload,
                        hasMedia,
                      }}
                    />
                  <div className="card-summary card-summary--standalone">
                      <span className="card-chip card-chip--index">
                        Card {cardIndex + 1}
                      </span>
                    <span className="card-chip card-chip--style">
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </span>
                    <span className="card-chip card-chip--layout">
                      {layoutType.charAt(0).toUpperCase() + layoutType.slice(1)}
                    </span>
                      <span className="card-chip card-chip--meta">
                        {elementCount} Elements
                      </span>
                      <span className="card-chip card-chip--meta">
                        {actionCount} Actions
                      </span>
                      {inputCount > 0 && (
                        <span className="card-chip card-chip--meta">
                          {inputCount} Inputs
                        </span>
                      )}
                        {textCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {textCount} Text
                          </span>
                        )}
                        {imageCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {imageCount} Images
                          </span>
                        )}
                        {columnSetCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {columnSetCount} Column Sets
                          </span>
                        )}
                        {fileUploadCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {fileUploadCount} File Uploads
                          </span>
                        )}
                        {videoCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {videoCount} Videos
                          </span>
                        )}
                        {audioCount > 0 && (
                          <span className="card-chip card-chip--meta">
                            {audioCount} Audio
                          </span>
                        )}
                        {hasMedia && videoCount === 0 && audioCount === 0 && (
                        <span className="card-chip card-chip--media">Media</span>
                      )}
                    {summary && (
                      <span className="card-chip card-chip--summary">
                        {summary}
                      </span>
                    )}
                  </div>
                </div>
                )
              )}
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
