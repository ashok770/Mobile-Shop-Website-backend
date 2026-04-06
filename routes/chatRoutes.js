import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a helpful assistant for a mobile shop website.
User: ${message}
Reply in short and helpful way.`,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log("Gemini response:", data); // 🔥 VERY IMPORTANT

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.json({ reply });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: "Error in chatbot" });
  }
});

export default router;
