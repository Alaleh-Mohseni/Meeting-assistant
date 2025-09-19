// import { Router } from 'express'
// import fs from 'fs'
// import multer from 'multer'
// import speech from '@google-cloud/speech'
// const router = Router()

// const speechClient = new speech.SpeechClient({
//     keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
// });

// const upload = multer({
//     dest: 'uploads/',
//     limits: { fileSize: 10 * 1024 * 1024 }
// });

// router.post('/', upload.single('audio'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({ error: 'No audio file provided' });
//         }

//         const audioBytes = fs.readFileSync(req.file.path).toString('base64');

//         const request = {
//             audio: {
//                 content: audioBytes,
//             },
//             config: {
//                 encoding: 'WEBM_OPUS', // or 'MP3', 'WAV' depending on your audio format
//                 sampleRateHertz: 16000,
//                 languageCode: 'fa-IR',
//                 enableSpeakerDiarization: true,
//                 diarizationSpeakerCount: parseInt(req.body.speakerCount) || 2,
//                 enableAutomaticPunctuation: true,
//                 model: 'latest_long',
//             },
//         };

//         const [response] = await speechClient.recognize(request);
//         const transcription = response.results
//             .map(result => result.alternatives[0])
//             .map((alternative, index) => {
//                 const speakerTag = response.results[index].alternatives[0].words?.[0]?.speakerTag || 1;
//                 return {
//                     transcript: alternative.transcript,
//                     confidence: alternative.confidence,
//                     speakerTag: speakerTag,
//                     timestamp: new Date().toISOString()
//                 };
//             });

//         // Clean up uploaded file
//         fs.unlinkSync(req.file.path);

//         res.json({ transcription });
//     } catch (error) {
//         console.error('Transcription error:', error);
//         res.status(500).json({ error: 'Transcription failed' });
//     }
// });

// export default router



// backend/apis/transcribe.js
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
                encoding: "WEBM_OPUS", // یا فرمت واقعی فایل (مثلاً LINEAR16)
                sampleRateHertz: 16000,
                languageCode: "fa-IR",
                enableAutomaticPunctuation: true,
                enableSpeakerDiarization: true,
                diarizationSpeakerCount: parseInt(req.body.speakerCount) || 2,
                model: "latest_long"
            }
        }

        const [response] = await speechClient.recognize(request)

        // استخراج واژه‌ها از نتایج
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

        // گروه‌بندی واژه‌ها بر اساس speakerTag
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

        // اطمینان از پاک‌سازی فایل موقت
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

