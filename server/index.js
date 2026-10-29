import express from 'express'
import session from 'express-session'
import FileStoreFactory from 'session-file-store'
import { rateLimit } from 'express-rate-limit'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { fileTypeFromFile } from 'file-type'
import { profile, skills, projects, additionalProjects, articles } from '../src/data.js'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 4000)
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
const DATA_DIR = path.resolve(process.env.DATA_DIR || __dirname)
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const SESSION_DIR = path.join(DATA_DIR, 'sessions')
const RESUME_PATH = path.join(UPLOAD_DIR, 'resume.pdf')
const CONTENT_PATH = path.join(DATA_DIR, 'site-content.json')
const BUNDLED_CONTENT_PATH = path.join(__dirname, 'site-content.json')
const PHOTO_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}
const PHOTO_MIME_TYPES = Object.keys(PHOTO_EXTENSIONS)
const DEFAULT_CONTENT = {
  profile, skills, projects, additionalProjects, articles,
  careerObjective: 'To build a career in VLSI design and functional verification, applying my knowledge through challenging projects and contributing to the development of reliable and efficient digital hardware.'
}
const FileStore = FileStoreFactory(session)
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(SESSION_DIR, { recursive: true })
if (!fs.existsSync(CONTENT_PATH)) {
  if (CONTENT_PATH !== BUNDLED_CONTENT_PATH && fs.existsSync(BUNDLED_CONTENT_PATH)) {
    fs.copyFileSync(BUNDLED_CONTENT_PATH, CONTENT_PATH)
  } else {
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(DEFAULT_CONTENT, null, 2))
  }
}

if (IS_PRODUCTION) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) {
    throw new Error('Production requires an ADMIN_PASSWORD of at least 16 characters.')
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('Production requires a SESSION_SECRET of at least 32 characters.')
  }
}

app.set('trust proxy', IS_PRODUCTION ? 1 : false)
if (!IS_PRODUCTION) {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  }))
}
app.use(express.json({ limit: '1mb' }))
app.use(session({
  name: 'vishwak_admin',
  store: new FileStore({ path: SESSION_DIR, ttl: 60 * 60 * 4, retries: 0 }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 4
  }
}))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const extension = file.fieldname === 'resume' ? '.pdf' : PHOTO_EXTENSIONS[file.mimetype]
      cb(null, `upload-${crypto.randomUUID()}${extension}`)
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'resume' && file.mimetype === 'application/pdf') return cb(null, true)
    if (file.fieldname === 'photo' && PHOTO_MIME_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(new Error(file.fieldname === 'resume' ? 'Resume must be a PDF.' : 'Photo must be JPG/JPEG, PNG, or WebP.'))
  }
})
const requireAdmin = (req, res, next) => req.session?.admin ? next() : res.status(401).json({ error: 'Please sign in as admin.' })
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' })
})
const requireUploadedType = async (file, expectedMimeTypes) => {
  let detected
  try {
    detected = await fileTypeFromFile(file.path)
  } catch (error) {
    fs.unlinkSync(file.path)
    throw error
  }
  if (!detected || !expectedMimeTypes.includes(detected.mime)) {
    fs.unlinkSync(file.path)
    const error = new Error('The uploaded file contents do not match an allowed file type.')
    error.statusCode = 400
    throw error
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/content', (_req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8')))
  } catch (error) {
    console.error('Could not load portfolio content:', error)
    res.status(500).json({ error: 'Could not load portfolio content.' })
  }
})
app.put('/api/admin/content', requireAdmin, (req, res) => {
  const content = req.body
  if (!content || typeof content !== 'object' || Array.isArray(content) || !content.profile || !Array.isArray(content.projects)) {
    return res.status(400).json({ error: 'Content must be a JSON object with a profile object and projects array.' })
  }
  try {
    const tempPath = `${CONTENT_PATH}.${crypto.randomUUID()}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(content, null, 2), 'utf8')
    fs.renameSync(tempPath, CONTENT_PATH)
    res.json({ ok: true, message: 'Website content saved.' })
  } catch (error) {
    console.error('Could not save portfolio content:', error)
    res.status(500).json({ error: 'Could not save website content.' })
  }
})
app.get('/api/public-assets', (_req, res) => {
  try {
    const photo = ['profile.jpg', 'profile.jpeg', 'profile.png', 'profile.webp']
      .find(file => fs.existsSync(path.join(UPLOAD_DIR, file)))
    res.json({
      hasResume: fs.existsSync(RESUME_PATH),
      photoUrl: photo ? `/api/profile-photo?v=${fs.statSync(path.join(UPLOAD_DIR, photo)).mtimeMs}` : null
    })
  } catch (error) {
    console.error('Could not read public asset metadata:', error)
    res.status(500).json({ error: 'Could not read public assets.' })
  }
})
app.get('/api/resume', (_req, res) => {
  if (!fs.existsSync(RESUME_PATH)) return res.status(404).json({ error: 'Resume not uploaded yet.' })
  res.download(RESUME_PATH, 'Mudivarthi_Vishwak_Sai_Resume.pdf')
})
app.get('/api/profile-photo', (_req, res) => {
  const candidate = ['profile.jpg', 'profile.jpeg', 'profile.png', 'profile.webp'].map(f => path.join(UPLOAD_DIR, f)).find(fs.existsSync)
  if (!candidate) return res.status(404).end()
  res.sendFile(candidate)
})
app.post('/api/admin/login', loginLimiter, (req, res, next) => {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return res.status(503).json({ error: 'Admin password is not configured on the server.' })
  const supplied = String(req.body?.password || '')
  const a = Buffer.from(supplied), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Incorrect password.' })
  req.session.regenerate(error => {
    if (error) return next(error)
    req.session.admin = true
    req.session.save(saveError => {
      if (saveError) return next(saveError)
      res.json({ ok: true })
    })
  })
})
app.post('/api/admin/logout', requireAdmin, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error)
    res.clearCookie('vishwak_admin', { httpOnly: true, sameSite: 'lax', secure: IS_PRODUCTION })
    res.json({ ok: true })
  })
})
app.get('/api/admin/status', (req, res) => res.json({ authenticated: Boolean(req.session?.admin) }))
app.post('/api/admin/resume', requireAdmin, upload.single('resume'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a PDF file first.' })
  try {
    await requireUploadedType(req.file, ['application/pdf'])
    fs.renameSync(req.file.path, RESUME_PATH)
    res.json({ ok: true, message: 'Resume updated successfully.' })
  } catch (error) {
    next(error)
  }
})
app.post('/api/admin/photo', requireAdmin, upload.single('photo'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image first.' })
  try {
    await requireUploadedType(req.file, PHOTO_MIME_TYPES)
    const finalPath = path.join(UPLOAD_DIR, `profile${PHOTO_EXTENSIONS[req.file.mimetype]}`)
    fs.renameSync(req.file.path, finalPath)
    for (const file of ['profile.jpg', 'profile.jpeg', 'profile.png', 'profile.webp']) {
      const oldPath = path.join(UPLOAD_DIR, file)
      if (oldPath !== finalPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    res.json({ ok: true, message: 'Profile photo updated successfully.' })
  } catch (error) {
    next(error)
  }
})
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))
const DIST_DIR = path.resolve(__dirname, '../dist')
if (IS_PRODUCTION && !fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  throw new Error('Production frontend build not found. Run npm run build before starting the server.')
}
app.use(express.static(DIST_DIR))
app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
app.use((err, _req, res, _next) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message })
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 5 MB or smaller.' : err.message })
  res.status(400).json({ error: err.message || 'Request failed.' })
})
app.listen(PORT, () => console.log(`Portfolio server listening on port ${PORT}`))