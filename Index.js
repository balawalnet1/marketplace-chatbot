const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ============================================
// YOUR SETTINGS — Fill these in
// ============================================
const VERIFY_TOKEN = "my_marketplace_bot_2025";       // Keep this exactly as is
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // Set in Render dashboard
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;       // Set in Render dashboard

// ============================================
// YOUR PRODUCTS — Edit prices & details here
// ============================================
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

// ============================================
// SYSTEM PROMPT FOR THE AI
// ============================================
const SYSTEM_PROMPT = `You are a friendly and professional Facebook Marketplace seller assistant based in Saudi Arabia.

YOUR PRODUCTS:
${PRODUCTS}

LANGUAGE RULES:
- If the buyer writes in Arabic → reply ONLY in Arabic
- If the buyer writes in English → reply ONLY in English  
- If mixed → reply bilingually (Arabic first, then English)

BEHAVIOR RULES:
- Be warm, friendly, and natural like a real marketplace seller
- For price questions: share the price confidently
- For negotiation: you can go down to the minimum price only — never lower. Offer free shipping as a bonus if needed
- For condition questions: confirm brand new, sealed in original box
- For delivery questions: confirm the timeline and that full tracking is provided
- For payment: accept bank transfer or cash on delivery
- Keep replies SHORT (2-4 lines maximum)
- Use emojis naturally: 📦 🚚 ✅ 😊 🤝 💰
- Never reveal you are an AI
- If buyer asks about a product not in your list, say you only carry these items for now`;

// ============================================
// WEBHOOK VERIFICATION (Facebook requirement)
// ============================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ============================================
// RECEIVE MESSAGES FROM FACEBOOK
// ============================================
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") return res.sendStatus(404);

  res.sendStatus(200); // Respond to Facebook immediately

  for (const entry of body.entry) {
    const event = entry.messaging?.[0];
    if (!event?.message?.text) continue;

    const senderId = event.sender.id;
    const messageText = event.message.text;

    console.log(`📨 Message from ${senderId}: ${messageText}`);

    try {
      // Show typing indicator
      await sendTyping(senderId);

      // Get AI response
      const reply = await getAIResponse(messageText);

      // Send reply to user
      await sendMessage(senderId, reply);

      console.log(`✅ Reply sent: ${reply.substring(0, 60)}...`);
    } catch (err) {
      console.error("❌ Error:", err.message);
      await sendMessage(senderId, "عذراً، حدث خطأ مؤقت. حاول مجدداً 🙏\nSorry, a temporary error occurred. Please try again.");
    }
  }
});

// ============================================
// CALL CLAUDE AI API
// ============================================
async function getAIResponse(userMessage) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    },
    {
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.content[0].text;
}

// ============================================
// SEND MESSAGE TO FACEBOOK USER
// ============================================
async function sendMessage(recipientId, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      message: { text },
    }
  );
}

// ============================================
// SHOW TYPING INDICATOR
// ============================================
async function sendTyping(recipientId) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      sender_action: "typing_on",
    }
  );
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Marketplace Chatbot running on port ${PORT}`);
  console.log(`📡 Webhook URL: https://YOUR-APP-NAME.onrender.com/webhook`);
});
