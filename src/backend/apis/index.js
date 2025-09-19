import express, { Router } from 'express'
import ai from './ai.js'
import transcribe from './transcribe.js'
import questions from './questions.js'
import summary from './summary.js'

const router = Router()

router.use(express.json())

router.use('/ask-ai', ai)
router.use('/transcribe', transcribe)
router.use('/detect-questions', questions)
router.use('/generate-summary', summary)
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router