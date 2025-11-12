import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveCard } from "adaptivecards";
import "adaptivecards/dist/adaptivecards.css";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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
      const adaptiveCard = new AdaptiveCard();
      adaptiveCard.parse(payload);
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
              <div className="card-preview-glow" />
              <div className="card-preview-stage">
                <div className="card-preview-reflection" />
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
