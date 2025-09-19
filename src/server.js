import { createServer as createViteServer } from 'vite'
import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import apiRoutes from './backend/apis/index.js'

dotenv.config()

const isProd = import.meta.env?.PROD
const PORT = process.env.PORT || 5173

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const createServer = async () => {
    const app = express()

    app.use(express.json())
    app.use(cors())
    app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

    if (!isProd) {
        app.use('/api', (req, res, next) => setTimeout(next, 1000))
    }

    app.use('/api', apiRoutes)

    let vite
    if (isProd) {
        const compression = (await import('compression')).default
        app.use(compression())
        app.use(express.static(path.resolve(__dirname, '../public')))

        app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, '../public/index.html'))
        })
    } else {
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom',
        })

        app.use(vite.middlewares)

        app.get('*', async (req, res, next) => {
            try {
                const url = req.originalUrl
                const template = await vite.transformIndexHtml(
                    url,
                    await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
                )
                res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
            } catch (e) {
                next(e)
            }
        })
    }

    app.listen(PORT, '0.0.0.0', err => {
        if (err) {
            console.error(`🚨 Failed to start server on port ${PORT}:`, err.message)
            process.exit(1)
        } else {
            console.log('\n\n================== ✅ Server Started ==================')
            console.log(`🚀 Running at: http://localhost:${PORT}`)
            console.log('=======================================================\n\n')
        }
    })
}

createServer()
