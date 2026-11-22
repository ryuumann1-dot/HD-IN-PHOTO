
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({
        error: "Image URL is required"
      });
    }

    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({
        error: "Invalid image URL"
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({
        error: "Invalid URL protocol"
      });
    }

    const apiUrl = new URL(
      "https://api.zyvor.my.id/api/imagehd/wink-hd"
    );

    apiUrl.searchParams.set("url", url);

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(55000)
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Image enhancement API failed"
      });
    }

    if (contentType.startsWith("image/")) {
      const buffer = Buffer.from(
        await response.arrayBuffer()
      );

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        "inline; filename=enhanced-image"
      );

      return res.status(200).send(buffer);
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    console.error("Enhance error:", error);

    return res.status(500).json({
      error: "Enhancement failed",
      message: error.message
    });
  }
}
