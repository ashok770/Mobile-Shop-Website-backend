import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    if (message.toLowerCase().includes("under")) {
      const products = await Product.find({ finalPrice: { $lt: 20000 } }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

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
            return `- ${product.name} (${product.category}) by ${brand} — ₹${product.finalPrice}
Link: http://localhost:5173/mobiles/${product._id}`;
          })
          .join("\n")
      : "No products currently available.";

    const prompt = `You are a helpful assistant for the Mobile Shop website.

When recommending products:
- Always include product name
- Include price
- Include the provided link

Product catalog:
${productSummary}

User: ${message}

Reply in a clean list format.`;

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
