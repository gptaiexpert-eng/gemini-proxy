import express from "express";

const app = express();

app.use(express.json({ limit: "20mb" }));

// CORS — чтобы Lovable мог обращаться к нашему прокси
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Проверка, что сам прокси жив
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "gemini-proxy",
    message: "Gemini proxy is running"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Основной маршрут к Gemini
app.post("/gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is not configured on server"
      });
    }

    const {
      contents,
      systemInstruction,
      generationConfig,
      safetySettings,
      model = "gemini-3.6-flash"
    } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({
        ok: false,
        error: "Request must contain contents array"
      });
    }

    const body = { contents };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (generationConfig) {
      body.generationConfig = generationConfig;
    }

    if (safetySettings) {
      body.safetySettings = safetySettings;
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);

      return res.status(response.status).json({
        ok: false,
        upstreamStatus: response.status,
        error: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Proxy error:", error);

    return res.status(500).json({
      ok: false,
      error: "Proxy request failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gemini proxy running on 0.0.0.0:${PORT}`);
});
