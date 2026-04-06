import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    const products = await Product.find({})
      .select("name brand category finalPrice originalPrice offerType stock")
      .limit(20)
      .lean();

    const productSummary = products.length
      ? products
          .map((product) => {
            const offer =
              product.offerType && product.offerType !== "NONE"
                ? `, offer: ${product.offerType}`
                : "";
            const brand = product.brand ? `${product.brand}` : "Unknown brand";
            return `- ${product.name} (${product.category}) by ${brand} — ₹${product.finalPrice}${offer}`;
          })
          .join("\n")
      : "No products currently available.";

    const prompt = `You are a helpful assistant for the Mobile Shop website. Use the website product catalog and public pages to answer user questions accurately. Do not mention admin pages or backend details.

Website pages: Home, Mobiles, Accessories, Services, Contact, Order.

Product catalog:
${productSummary}

User: ${message}
Reply in a short, helpful way, and reference actual products when relevant.`;

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
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log("Gemini response:", data);

    // ✅ handle API error
    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(500).json({
        reply: "AI is currently unavailable. Please try again later.",
      });
    }

    // ✅ clean reply extraction
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.json({ reply });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: "Error in chatbot" });
  }
});

export default router;
