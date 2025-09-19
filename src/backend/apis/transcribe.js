import { Router } from "express"
import fs from "fs"
import speech from "@google-cloud/speech"
import multer from "multer"

const router = Router()
const upload = multer({ dest: "uploads/" })

const speechClient = new speech.SpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
})

router.post("/", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided" })
        }

        const audioBytes = fs.readFileSync(req.file.path).toString("base64")

        const request = {
            audio: { content: audioBytes },
            config: {
                encoding: "WEBM_OPUS",
                sampleRateHertz: 16000,
                languageCode: "fa-IR",
                enableAutomaticPunctuation: true,
                enableSpeakerDiarization: true,
                diarizationSpeakerCount: parseInt(req.body.speakerCount) || 2,
                model: "latest_long"
            }
        }

        const [response] = await speechClient.recognize(request)

        const words = []
        for (const r of response.results || []) {
            const alt = r.alternatives?.[0]
            if (!alt?.words) continue
            for (const w of alt.words) {
                words.push({
                    word: w.word,
                    startTime: w.startTime,
                    endTime: w.endTime,
                    speakerTag: w.speakerTag || 1
                })
            }
        }

        const segments = []
        let cur = null
        for (const w of words) {
            if (cur && cur.speakerTag === w.speakerTag) {
                cur.transcript += (w.word.startsWith("'") ? "" : " ") + w.word
                cur.endTime = w.endTime
            } else {
                if (cur) segments.push(cur)
                cur = {
                    speakerTag: w.speakerTag,
                    transcript: w.word,
                    startTime: w.startTime,
                    endTime: w.endTime
                }
            }
        }
        if (cur) segments.push(cur)

        fs.unlinkSync(req.file.path)

        return res.json({
            transcription: segments,
            confidence:
                response.results?.[0]?.alternatives?.[0]?.confidence ?? null
        })
    } catch (error) {
        console.error("Transcription error:", error)
        try {
            if (req.file) fs.unlinkSync(req.file.path)
        } catch (e) { }
        res
            .status(500)
            .json({ error: "Transcription failed", detail: error.message })
    }
})

export default router

