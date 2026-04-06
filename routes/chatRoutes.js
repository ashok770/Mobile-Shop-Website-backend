import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: message }] }],
      },
    );

    const reply = response.data.candidates[0].content.parts[0].text;

    res.json({ reply });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error in chatbot" });
  }
});

export default router;
