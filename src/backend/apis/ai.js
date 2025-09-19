import { Router } from 'express'
import { OpenAI } from 'openai'
const router = Router()

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Endpoint for AI question answering
router.post('/', async (req, res) => {
    try {
        const { question, context, speakerNames } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const contextText = context ?
            context.map(entry => `${entry.speaker}: ${entry.text}`).join('\n') : '';

        const prompt = `
شما یک دستیار هوشمند جلسات هستید که به زبان فارسی پاسخ می‌دهید.

متن جلسه:
${contextText}

شرکت‌کنندگان: ${speakerNames ? speakerNames.join(', ') : ''}

سوال: ${question}

لطفاً پاسخ کوتاه، مفید و مربوط به محتوای جلسه ارائه دهید. اگر اطلاعات کافی در متن جلسه وجود ندارد، این موضوع را ذکر کنید.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "شما یک دستیار جلسات هوشمند هستید که به زبان فارسی پاسخ می‌دهید و در تحلیل محتوای جلسات تخصص دارید."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        const aiResponse = completion.choices[0].message.content;

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('AI response error:', error);
        res.status(500).json({ error: 'AI response failed' });
    }
});

export default router