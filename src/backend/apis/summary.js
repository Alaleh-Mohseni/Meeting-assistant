import { Router } from 'express'
import { OpenAI } from 'openai'
const router = Router()

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Enhanced summary generation
router.post('/', async (req, res) => {
    try {
        const { transcript, speakerNames } = req.body;

        if (!transcript || transcript.length === 0) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const transcriptText = transcript
            .map(entry => `${entry.speaker}: ${entry.text}`)
            .join('\n');

        const prompt = `
لطفاً خلاصه‌ای جامع و ساختاریافته از این جلسه ارائه دهید:

متن جلسه:
${transcriptText}

شرکت‌کنندگان: ${speakerNames.join(', ')}

خلاصه باید شامل:
1. موضوعات اصلی مطرح شده
2. تصمیمات گرفته شده
3. وظایف و مسئولیت‌های تعیین شده
4. سوالات باقی‌مانده
5. اقدامات آتی

خلاصه را به صورت واضح و منظم ارائه دهید.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "شما یک متخصص خلاصه‌سازی جلسات هستید که خلاصه‌های دقیق و کاربردی تولید می‌کنید."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.5,
        });

        const summary = completion.choices[0].message.content;

        res.json({ summary });
    } catch (error) {
        console.error('Summary generation error:', error);
        res.status(500).json({ error: 'Summary generation failed' });
    }
});

export default router