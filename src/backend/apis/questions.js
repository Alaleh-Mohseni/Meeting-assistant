import { Router } from 'express'
const router = Router()

// Endpoint for automatic question detection
router.post('/', async (req, res) => {
    try {
        const { transcript } = req.body;

        const questions = transcript.filter(entry => {
            const text = entry.text;
            // Persian question detection
            return text.includes('؟') ||
                text.includes('چی') ||
                text.includes('چه') ||
                text.includes('کی') ||
                text.includes('کجا') ||
                text.includes('چرا') ||
                text.includes('چطور') ||
                text.includes('آیا') ||
                text.startsWith('آیا') ||
                /\bچی\b|\bچه\b|\bکی\b|\bکجا\b|\bچرا\b|\bچطور\b/.test(text);
        });

        res.json({ questions });
    } catch (error) {
        console.error('Question detection error:', error);
        res.status(500).json({ error: 'Question detection failed' });
    }
});

export default router