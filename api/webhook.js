// ================================================
//  Bella Napoli — WhatsApp AI Bot
//  Meta Cloud API + Groq (llama-3.1-8b-instant)
// ================================================
 
const SYSTEM_PROMPT = `You are a warm and friendly AI assistant for Bella Napoli, an authentic Neapolitan Italian restaurant in Mumbai.
 
STRICT RULE: ONLY answer questions about Bella Napoli. If anyone asks anything unrelated, respond ONLY with:
"I can only help with Bella Napoli questions! Ask me about our menu, hours, reservations, or location 🍕"
 
RESTAURANT DETAILS:
Name: Bella Napoli
Type: Authentic Neapolitan Italian
Address: 42 Harbour Street, Mumbai, Maharashtra
Phone: +91 98765 43210
WhatsApp: +91 98765 43210
 
OPENING HOURS:
Monday - Thursday: 12:00 PM to 10:00 PM
Friday - Saturday: 12:00 PM to 11:00 PM
Sunday: 1:00 PM to 9:00 PM
 
MENU:
Starters:
- Bruschetta al Pomodoro — ₹320
- Burrata Fresca — ₹480
- Calamari Fritti — ₹420
- Antipasto Misto — ₹560
 
Wood-Fired Pizzas:
- Margherita — ₹550
- Diavola (spicy salami) — ₹650
- Truffle Funghi — ₹780
- Quattro Formaggi — ₹680
- Prosciutto e Rucola — ₹720
 
Pasta:
- Spaghetti Carbonara — ₹620
- Penne Arrabbiata — ₹480
- Tagliatelle al Ragu — ₹680
- Cacio e Pepe — ₹540
 
Desserts:
- Tiramisu — ₹320
- Panna Cotta — ₹280
- Cannoli Siciliani — ₹260
 
Drinks:
- Italian Sodas — ₹180
- House Wine — ₹380 per glass
- Espresso — ₹120
- Aperol Spritz — ₹420
 
POLICIES:
- Reservations: Yes, call or WhatsApp +91 98765 43210
- Home Delivery: Available on Swiggy and Zomato
- Parking: Free parking behind the restaurant
- Vegetarian options: Yes, many available
- Gluten-free pasta: Available on request
- Private dining: Yes, for groups of 10 or more
 
IMPORTANT FORMATTING RULES FOR WHATSAPP:
- Never use markdown like ** or ## 
- Use plain text only
- Keep replies to 2-4 sentences maximum
- Use ₹ symbol for all prices
- Be warm, friendly and welcoming`;
 
export default async function handler(req, res) {
 
  // ── Webhook Verification (Meta calls this once during setup) ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
 
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return res.status(200).send(challenge);
    }
 
    console.log('❌ Webhook verification failed');
    return res.status(403).send('Forbidden');
  }
 
  // ── Incoming WhatsApp Message ──
  if (req.method === 'POST') {
    try {
      const body = req.body;
 
      // Ignore non-message events (status updates etc.)
      if (body.object !== 'whatsapp_business_account') {
        return res.status(200).send('OK');
      }
 
      const entry   = body.entry?.[0];
      const change  = entry?.changes?.[0];
      const value   = change?.value;
      const message = value?.messages?.[0];
 
      // No message found — probably a status update, ignore it
      if (!message) {
        return res.status(200).send('OK');
      }
 
      const from = message.from; // Customer's phone number
 
      // Handle non-text messages (voice notes, images etc.)
      if (message.type !== 'text') {
        await sendReply(from, "Hi there! I can only read text messages right now. Please type your question and I'll help right away! 😊");
        return res.status(200).send('OK');
      }
 
      const userText = message.text.body.trim();
      console.log(`📩 Message from ${from}: ${userText}`);
 
      // Get AI reply from Groq
      const aiReply = await getGroqReply(userText);
      console.log(`🤖 AI reply: ${aiReply}`);
 
      // Send reply back on WhatsApp
      await sendReply(from, aiReply);
 
      return res.status(200).send('OK');
 
    } catch (error) {
      console.error('❌ Error handling message:', error);
      return res.status(200).send('OK'); // Always return 200 to Meta
    }
  }
 
  return res.status(405).send('Method Not Allowed');
}
 
// ── Get reply from Groq ──
async function getGroqReply(userMessage) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage   }
      ],
      max_tokens: 300,
      temperature: 0.6
    })
  });
 
  const data = await response.json();
 
  if (data.error) {
    console.error('Groq error:', data.error);
    throw new Error(data.error.message);
  }
 
  return data.choices[0].message.content.trim();
}
 
// ── Send WhatsApp reply via Meta Cloud API ──
async function sendReply(to, text) {
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
 
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                to,
      type:              'text',
      text:              { body: text }
    })
  });
 
  const data = await response.json();
 
  if (data.error) {
    console.error('WhatsApp send error:', data.error);
    throw new Error(data.error.message);
  }
 
  console.log(`✅ Reply sent to ${to}`);
  return data;
}
