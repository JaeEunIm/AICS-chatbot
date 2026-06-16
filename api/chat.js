export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY on Vercel' });
  }

  try {
    const {
      model,
      messages,
      max_completion_tokens,
      max_tokens,
      participantId,
      condition,
      pageMode,
      userMessage,
      storageKey
    } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: max_completion_tokens || max_tokens || 300
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const botReply = data?.choices?.[0]?.message?.content || '';

    if (process.env.GOOGLE_LOG_WEBHOOK_URL) {
      try {
        const logPayload = {
          timestamp: new Date().toISOString(),
          participantId: participantId || '',
          condition: condition || '',
          pageMode: pageMode || '',
          userMessage: userMessage || '',
          botReply,
          model: model || '',
          storageKey: storageKey || ''
        };

        await Promise.race([
          fetch(process.env.GOOGLE_LOG_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(logPayload)
          }),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      } catch (logError) {
        console.error('Log saving failed:', logError);
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
}
