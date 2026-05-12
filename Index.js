const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "my_marketplace_bot_2025";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const PRODUCTS = `
1. Electric Peeler (مقشرة كهربائية)
   - Price: 206 SAR / $54.99
   - Condition: Brand new sealed in box (جديد بالكرتون)
   - Delivery: 2-3 days local / 15-25 days international
   - Minimum price: 187 SAR / $49.99 with free shipping
   - Details: USB rechargeable, automatic rotating, works on apples/potatoes/vegetables

2. Shoulder Pulley (بكرة كتف)
   - Price: 90 SAR
   - Condition: Brand new sealed in box (جديد بالكرتون)
   - Delivery: 2-3 days within KSA
   - Minimum price: 85 SAR with free shipping
   - Details: Over-door shoulder pulley for rehab and home exercise

3. Luxury Skeleton Watch (ساعة فاخرة)
   - Price: 350 SAR
   - Condition: Brand new (جديد)
   - Delivery: 2-3 days within KSA
   - Minimum price: 320 SAR
   - Details: Automatic mechanical, moon phase, black gold design, 30M waterproof
`;

const SYSTEM_PROMPT = `You are a friendly Facebook Marketplace seller assistant based in Saudi Arabia.

YOUR PRODUCTS:
${PRODUCTS}

LANGUAGE RULES:
- If the buyer writes in Arabic reply ONLY in Arabic
- If the buyer writes in English reply ONLY in English
- If mixed reply bilingually Arabic first then English

BEHAVIOR RULES:
- Be warm friendly and natural like a real marketplace seller
- For price questions share the price confidently
- For negotiation go down to minimum price only never lower. Offer free shipping as bonus
- For condition questions confirm brand new sealed in original box
- For delivery confirm timeline and full tracking provided
- For payment accept bank transfer or cash on delivery
- Keep replies SHORT 2-4 lines maximum
- Use emojis naturally 📦 🚚 ✅ 😊 🤝 💰
- Never reveal you are an AI`;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);
  res.sendStatus(200);

  for (const entry of body.entry) {
    const event = entry.messaging?.[0];
    if (!event?.message?.text) continue;
    const senderId = event.sender.id;
    const messageText = event.message.text;
    console.log("Message: " + messageText);

    try {
      await sendTyping(senderId);
      const reply = await getAIResponse(messageText);
      await sendMessage(senderId, reply);
      console.log("Replied successfully");
    } catch (err) {
      console.error("Error: " + err.message);
      await sendMessage(senderId, "عذراً، حدث خطأ مؤقت. حاول مجدداً 🙏\nSorry, a temporary error occurred. Please try again.");
    }
  }
});

async function getAIResponse(userMessage) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY;
  
  const response = await axios.post(url, {
    contents: [
      {
        parts: [
          {
            text: SYSTEM_PROMPT + "\n\nBuyer message: " + userMessage
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.7
    }
  });

  return response.data.candidates[0].content.parts[0].text;
}

async function sendMessage(recipientId, text) {
  await axios.post(
    "https://graph.facebook.com/v18.0/me/messages?access_token=" + PAGE_ACCESS_TOKEN,
    {
      recipient: { id: recipientId },
      message: { text },
    }
  );
}

async function sendTyping(recipientId) {
  await axios.post(
    "https://graph.facebook.com/v18.0/me/messages?access_token=" + PAGE_ACCESS_TOKEN,
    {
      recipient: { id: recipientId },
      sender_action: "typing_on",
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Marketplace Chatbot running on port " + PORT);
});
