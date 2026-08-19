import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HomePage } from '@/views/home'
import './app/styles/globals.css'

const container = document.getElementById('root')

// 握りつぶさない（`.claude/rules/error-handling.md`）。
// index.html の #root が消えた場合は静かに空画面になるのではなく落とす。
if (!container) {
  throw new Error('#root が見つからない。index.html を確認すること。')
}

createRoot(container).render(
  <StrictMode>
    <HomePage />
  </StrictMode>
)
