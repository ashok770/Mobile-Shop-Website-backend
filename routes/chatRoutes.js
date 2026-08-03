import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    const lowerMsg = message.toLowerCase();

    // � 1. PRICE FILTER FIRST
    if (lowerMsg.includes("under")) {
      const priceMatch = lowerMsg.match(/\d+/);
      const maxPrice = priceMatch ? parseInt(priceMatch[0], 10) : 20000;

      const filter = { finalPrice: { $lt: maxPrice } };

      if (lowerMsg.includes("mobile") || lowerMsg.includes("phone")) {
        filter.category = "mobile";
      } else if (lowerMsg.includes("earbud")) {
        filter.category = "earbuds";
      } else if (lowerMsg.includes("charger")) {
        filter.category = "charger";
      }

      const products = await Product.find(filter).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 2. BRAND FILTER
    if (lowerMsg.includes("iphone")) {
      const products = await Product.find({ brand: "Apple" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    if (lowerMsg.includes("samsung")) {
      const products = await Product.find({ brand: "Samsung" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 3. CATEGORY FILTER
    if (lowerMsg.includes("mobile") || lowerMsg.includes("phone")) {
      const products = await Product.find({ category: "mobile" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    if (lowerMsg.includes("charger")) {
      const products = await Product.find({ category: "charger" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 4. EARBUD FILTER
    if (lowerMsg.includes("earbud")) {
      const products = await Product.find({ category: "earbuds" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 5. WATCH FILTER
    if (lowerMsg.includes("watch")) {
      const products = await Product.find({ category: "watch" }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 6. SCREEN PROTECTOR FILTER
    if (
      lowerMsg.includes("tempered glass") ||
      lowerMsg.includes("screen protector") ||
      lowerMsg.includes("screen")
    ) {
      const products = await Product.find({
        category: "screen protector",
      }).limit(5);

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    // 🔥 7. OFFER/DISCOUNT FILTER
    if (
      lowerMsg.includes("offer") ||
      lowerMsg.includes("discount") ||
      lowerMsg.includes("sale")
    ) {
      const products = await Product.find({ offerType: { $ne: "NONE" } }).limit(
        5,
      );

      return res.json({
        type: "products",
        products: products.map((p) => ({
          name: p.name,
          price: p.finalPrice,
          originalPrice: p.originalPrice,
          offer: p.offerType,
          link: `http://localhost:5173/mobiles/${p._id}`,
        })),
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        reply: "AI service not configured properly.",
      });
    }

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

    let data;

    try {
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

      data = await response.json();

      console.log("Gemini response:", data);

      // ✅ handle API error
      if (!response.ok) {
        console.error("Gemini API Error:", data);

        const fallbackMessage =
          data?.error?.code === 429 ||
          data?.error?.status === "RESOURCE_EXHAUSTED"
            ? "AI quota exceeded. Please try again in a few minutes."
            : "AI is currently unavailable. Please try again later.";

        return res.json({
          reply: fallbackMessage,
        });
      }
    } catch (error) {
      console.error("Gemini error:", error);
      return res.json({
        reply: "Sorry, something went wrong. Try again.",
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
