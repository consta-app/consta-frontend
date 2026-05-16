"use client"

import { useEffect, useRef } from 'react'

// ASCII ramp from darkest -> brightest (dense, hand-tuned for tonal range)
const RAMP =
  ' .`\'^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'.split('')

interface Star {
  x: number
  y: number
  phase: number
  speed: number
  baseBrightness: number
  layer: number
}

interface Splash {
  x: number
  y: number
  life: number
  maxLife: number
}

export function HeroBackground() {
  const preRef = useRef<HTMLPreElement>(null)
  const glowPreRef = useRef<HTMLPreElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const pre = preRef.current
    const glowPre = glowPreRef.current
    if (!pre || !glowPre) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const glowCanvas = document.createElement('canvas')
    const glowCtx = glowCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !glowCtx) return

    let cols = 0
    let rows = 0
    let charW = 0
    let charH = 0

    const setupDimensions = () => {
      const computedStyle = getComputedStyle(pre)
      const fontSize = parseFloat(computedStyle.fontSize)
      
      const span = document.createElement('span')
      span.style.fontFamily = computedStyle.fontFamily
      span.style.fontSize = computedStyle.fontSize
      span.style.letterSpacing = computedStyle.letterSpacing
      span.style.position = 'absolute'
      span.style.visibility = 'hidden'
      span.style.whiteSpace = 'pre'
      span.textContent = 'M'
      document.body.appendChild(span)
      const charWidth = span.getBoundingClientRect().width
      document.body.removeChild(span)

      const parentW = pre.parentElement?.clientWidth || window.innerWidth
      const parentH = pre.parentElement?.clientHeight || window.innerHeight

      charW = charWidth
      charH = fontSize

      cols = Math.ceil(parentW / charWidth) + 2
      rows = Math.ceil(parentH / fontSize) + 8
      
      canvas.width = cols
      canvas.height = rows
      glowCanvas.width = cols
      glowCanvas.height = rows
      ctx.imageSmoothingEnabled = false
      glowCtx.imageSmoothingEnabled = false
    }

    setupDimensions()

    const splashes: Splash[] = []
    const startTime = performance.now()

    function draw(time: number, context: CanvasRenderingContext2D, onlyGlow: boolean) {
      const w = context.canvas.width
      const h = context.canvas.height
      
      const cx = w / 2
      const horizonY = h * 0.74
      const islandTop = horizonY - 2
      const baseY = islandTop
      const lhHeight = h * 0.5
      const baseWidth = w * 0.045
      const topWidth = w * 0.018
      const lanternY = baseY - lhHeight
      const lanternH = Math.max(3, h * 0.05)
      const domeH = Math.max(2, h * 0.035)

      if (!onlyGlow) {
        context.fillStyle = 'rgb(0, 0, 0)'
        context.fillRect(0, 0, w, horizonY)
      } else {
        context.fillStyle = 'rgb(0, 0, 0)'
        context.fillRect(0, 0, w, h)
      }

      // Lighthouse beam
      const beamAngle = (time * 0.18) % (Math.PI * 2)
      const beamOriginY = lanternY + lanternH * 0.3
      const beamLen = Math.sqrt(w * w + h * h) * 1.2

      context.beginPath()
      context.moveTo(cx, beamOriginY)
      context.arc(cx, beamOriginY, beamLen, beamAngle - 0.32, beamAngle + 0.32)
      context.closePath()
      context.fillStyle = 'rgba(255, 240, 210, 0.04)'
      context.fill()

      context.beginPath()
      context.moveTo(cx, beamOriginY)
      context.arc(cx, beamOriginY, beamLen, beamAngle - 0.16, beamAngle + 0.16)
      context.closePath()
      context.fillStyle = 'rgba(255, 235, 195, 0.09)'
      context.fill()

      context.beginPath()
      context.moveTo(cx, beamOriginY)
      context.arc(cx, beamOriginY, beamLen, beamAngle - 0.05, beamAngle + 0.05)
      context.closePath()
      context.fillStyle = 'rgba(255, 245, 220, 0.22)'
      context.fill()

      if (!onlyGlow) {
        context.fillStyle = 'rgb(6, 8, 14)'
        for (let x = 0; x < w; x++) {
          const elev = Math.sin(x * 0.05) * 1.5 + Math.sin(x * 0.13 + 1.2) * 1 + 2
          context.fillRect(x, horizonY - elev, 1, elev + 1)
        }

        for (let y = horizonY; y < h; y++) {
          const t = (y - horizonY) / (h - horizonY)
          const r = Math.round(4 + t * 6)
          const g = Math.round(7 + t * 10)
          const b = Math.round(14 + t * 16)
          context.fillStyle = `rgb(${r},${g},${b})`
          context.fillRect(0, y, w, 1)
        }

        const waveLayers = [
          { y: horizonY + 1, amp: 0.6, freq: 0.06, speed: 1.6, color: 'rgb(20, 28, 40)' },
          { y: horizonY + 3, amp: 0.9, freq: 0.045, speed: 1.3, color: 'rgb(16, 24, 36)' },
          { y: horizonY + 6, amp: 1.2, freq: 0.035, speed: 1.0, color: 'rgb(13, 20, 30)' },
          { y: horizonY + 10, amp: 1.6, freq: 0.025, speed: 0.7, color: 'rgb(10, 16, 26)' },
        ]
        for (const wl of waveLayers) {
          for (let x = 0; x < w; x++) {
            const d = Math.round(
              Math.sin(x * wl.freq + time * wl.speed) * wl.amp +
                Math.sin(x * wl.freq * 2.3 - time * wl.speed * 0.7) * wl.amp * 0.4,
            )
            context.fillStyle = wl.color
            context.fillRect(x, wl.y + d, 1, 1)
          }
        }
      }

      // Beam reflection on water
      if (Math.sin(beamAngle) > 0.05) {
        const dirX = Math.cos(beamAngle)
        const dirY = Math.sin(beamAngle)
        const dy = horizonY - beamOriginY
        const tHit = dy / dirY
        const hitX = cx + dirX * tHit
        const reflWidth = w * 0.05
        for (let y = horizonY; y < h; y++) {
          const depth = (y - horizonY) / (h - horizonY)
          const widen = reflWidth * (1 + depth * 4)
          const shimmer = Math.sin(y * 0.6 + time * 4) * 0.3 + 0.7
          const a = (1 - depth) * 0.18 * shimmer
          context.fillStyle = `rgba(255, 235, 200, ${a})`
          context.fillRect(Math.round(hitX - widen / 2), y, Math.round(widen), 1)
          for (let s = 0; s < 2; s++) {
            const sx = hitX + (Math.random() - 0.5) * widen * 1.4
            if (Math.random() < 0.4 - depth * 0.2) {
              context.fillStyle = `rgba(255,255,240,${(1 - depth) * 0.7})`
              context.fillRect(Math.round(sx), y, 1, 1)
            }
          }
        }
      }

      if (!onlyGlow) {
        const islandW = baseWidth * 3.2
        context.fillStyle = 'rgb(14, 14, 18)'
        for (let x = -islandW; x <= islandW; x++) {
          const nx = x / islandW
          const elev = Math.max(0, (1 - nx * nx) * 3 + Math.sin(x * 0.7) * 0.5)
          context.fillRect(Math.round(cx + x), Math.round(islandTop - elev), 1, h - islandTop)
        }
        context.fillStyle = 'rgb(40, 40, 48)'
        for (let i = 0; i < 12; i++) {
          const rx = cx + (Math.random() - 0.5) * islandW * 1.6
          const ry = islandTop - Math.random() * 2
          context.fillRect(Math.round(rx), Math.round(ry), 1, 1)
        }

        const stoneH = lhHeight * 0.12
        context.fillStyle = 'rgb(55, 55, 60)'
        context.beginPath()
        context.moveTo(cx - baseWidth * 1.2, baseY)
        context.lineTo(cx + baseWidth * 1.2, baseY)
        context.lineTo(cx + baseWidth, baseY - stoneH)
        context.lineTo(cx - baseWidth, baseY - stoneH)
        context.closePath()
        context.fill()

        context.beginPath()
        context.moveTo(cx - baseWidth, baseY - stoneH)
        context.lineTo(cx + baseWidth, baseY - stoneH)
        context.lineTo(cx + topWidth, lanternY + lanternH * 0.7)
        context.lineTo(cx - topWidth, lanternY + lanternH * 0.7)
        context.closePath()
        context.fillStyle = 'rgb(190, 190, 195)'
        context.fill()

        context.fillStyle = 'rgb(70, 30, 30)'
        const stripeBands = 4
        for (let i = 0; i < stripeBands; i++) {
          const t0 = i / stripeBands
          const t1 = (i + 0.5) / stripeBands
          if (i % 2 !== 0) continue
          const yA = baseY - stoneH - t0 * (lhHeight - stoneH - lanternH * 0.7)
          const yB = baseY - stoneH - t1 * (lhHeight - stoneH - lanternH * 0.7)
          const wA = baseWidth - t0 * (baseWidth - topWidth)
          const wB = baseWidth - t1 * (baseWidth - topWidth)
          context.beginPath()
          context.moveTo(cx - wA, yA)
          context.lineTo(cx + wA, yA)
          context.lineTo(cx + wB, yB)
          context.lineTo(cx - wB, yB)
          context.closePath()
          context.fill()
        }

        context.fillStyle = 'rgb(30, 20, 15)'
        context.fillRect(Math.round(cx - 1), Math.round(baseY - stoneH - 2), 2, 2)
      }

      // Windows (always drawn)
      const stoneH = lhHeight * 0.12
      context.fillStyle = 'rgba(255, 200, 120, 0.85)'
      for (let i = 1; i <= 3; i++) {
        const ty = baseY - stoneH - (i / 4) * (lhHeight - stoneH - lanternH)
        const flick = 0.7 + Math.sin(time * 6 + i) * 0.15 + Math.random() * 0.1
        context.globalAlpha = flick
        context.fillRect(Math.round(cx), Math.round(ty), 1, 1)
        context.globalAlpha = 1
      }

      if (!onlyGlow) {
        context.fillStyle = 'rgb(50, 50, 55)'
        context.fillRect(Math.round(cx - topWidth - 1), Math.round(lanternY + lanternH * 0.7), topWidth * 2 + 2, 1)
        context.fillStyle = 'rgb(80, 80, 85)'
        for (let i = -2; i <= 2; i++) {
          context.fillRect(Math.round(cx + i * (topWidth / 2)), Math.round(lanternY + lanternH * 0.7) - 1, 1, 1)
        }
      }

      // Lantern room
      const lanternPulse = 0.85 + Math.sin(time * 4) * 0.15
      context.fillStyle = `rgba(255, 230, 170, ${lanternPulse})`
      context.fillRect(
        Math.round(cx - topWidth),
        Math.round(lanternY),
        Math.round(topWidth * 2),
        Math.round(lanternH * 0.7),
      )
      
      if (!onlyGlow) {
        context.fillStyle = 'rgb(40, 30, 25)'
        for (let i = -1; i <= 1; i++) {
          context.fillRect(Math.round(cx + i * topWidth), Math.round(lanternY), 1, Math.round(lanternH * 0.7))
        }

        context.fillStyle = 'rgb(120, 40, 35)'
        context.beginPath()
        context.moveTo(cx - topWidth - 1, lanternY)
        context.quadraticCurveTo(cx, lanternY - domeH * 1.5, cx + topWidth + 1, lanternY)
        context.closePath()
        context.fill()
        context.fillStyle = 'rgb(160, 160, 160)'
        context.fillRect(Math.round(cx), Math.round(lanternY - domeH * 1.5), 1, Math.round(domeH))
      }

      // Lantern glow
      const glowR = 4 + Math.sin(time * 4) * 0.6
      for (let r = glowR; r > 0; r--) {
        const a = (1 - r / glowR) * 0.35
        context.fillStyle = `rgba(255, 240, 200, ${a})`
        context.beginPath()
        context.arc(cx, beamOriginY, r, 0, Math.PI * 2)
        context.fill()
      }

      if (!onlyGlow) {
        // Foam splashes
        const islandW = baseWidth * 3.2
        if (Math.random() < 0.25) {
          splashes.push({
            x: cx + (Math.random() - 0.5) * islandW * 1.8,
            y: islandTop + Math.random() * 1.5,
            life: 12,
            maxLife: 12,
          })
        }
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i]
          const a = sp.life / sp.maxLife
          context.fillStyle = `rgba(220, 230, 240, ${a * 0.9})`
          context.fillRect(Math.round(sp.x), Math.round(sp.y), 1, 1)
          context.fillRect(Math.round(sp.x - 1), Math.round(sp.y + 1), 1, 1)
          context.fillRect(Math.round(sp.x + 1), Math.round(sp.y + 1), 1, 1)
          sp.life--
          if (sp.life <= 0) splashes.splice(i, 1)
        }

        for (let x = 0; x < w; x++) {
          const fog = (Math.sin(x * 0.05 + time * 0.4) * 0.5 + 0.5) * 0.12
          context.fillStyle = `rgba(180, 190, 210, ${fog})`
          context.fillRect(x, Math.round(horizonY - 1), 1, 2)
        }
      }
    }

    let last = startTime
    function render(now: number) {
      if (!ctx || !glowCtx) return
      if (now - last < 33) {
        animRef.current = requestAnimationFrame(render)
        return
      }
      last = now
      const time = (now - startTime) / 1000
      
      // Calculate beam parameters for CSS variables
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const lhHeight = h * 0.5
      const lanternY = (h * 0.74 - 2) - lhHeight
      const lanternH = Math.max(3, h * 0.05)
      const beamOriginY = lanternY + lanternH * 0.3
      const beamAngle = (time * 0.18) % (Math.PI * 2)

      const pixelCx = cx * charW
      const pixelCy = beamOriginY * charH
      const conicAngleDeg = (beamAngle * 180 / Math.PI) + 90
      const maskStart = conicAngleDeg - 24
      
      if (typeof document !== 'undefined') {
        document.body.style.setProperty('--beam-mask-start', `${maskStart}deg`)
        document.body.style.setProperty('--beam-x', `${pixelCx}px`)
        document.body.style.setProperty('--beam-y', `${pixelCy}px`)
      }

      // Draw both layers
      draw(time, ctx, false)
      draw(time, glowCtx, true)

      const imgData = ctx.getImageData(0, 0, cols, rows)
      const data = imgData.data
      const glowImgData = glowCtx.getImageData(0, 0, cols, rows)
      const glowData = glowImgData.data
      
      const ramp = RAMP
      const rampLen = ramp.length
      
      let asciiBase = ''
      let asciiGlow = ''
      
      for (let y = 0; y < rows; y++) {
        let rowBase = ''
        let rowGlow = ''
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          
          // Base calculations
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          let idx = (lum / 255) * (rampLen - 1)
          if (idx < 0) idx = 0
          else if (idx > rampLen - 1) idx = rampLen - 1
          const char = ramp[idx | 0]
          
          rowBase += char

          // Glow layer calculations
          const gLum = 0.299 * glowData[i] + 0.587 * glowData[i + 1] + 0.114 * glowData[i + 2]
          if (gLum > 4) {
            rowGlow += char
          } else {
            rowGlow += ' '
          }
        }
        asciiBase += rowBase + '\n'
        asciiGlow += rowGlow + '\n'
      }
      
      if (pre) pre.textContent = asciiBase
      if (glowPre) glowPre.textContent = asciiGlow
      
      animRef.current = requestAnimationFrame(render)
    }

    const handleResize = () => {
      setupDimensions()
    }

    window.addEventListener('resize', handleResize)
    animRef.current = requestAnimationFrame(render)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <>
      {/* Base Layer */}
      <pre
        ref={preRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none w-full h-full"
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 'clamp(7px, 1.15vw, 12px)',
          lineHeight: 1,
          color: 'white',
          opacity: 0.42,
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          letterSpacing: '0.02em',
          willChange: 'contents',
          textShadow: '1.6px 0.4px rgba(255,0,0,0.3), -1.6px -0.4px rgba(0,255,255,0.3), 0 0 6px rgba(255,230,180,0.08)',
          backgroundColor: '#050507',
        }}
      >
        &nbsp;
      </pre>

      {/* Glow Overlay Layer */}
      <pre
        ref={glowPreRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none w-full h-full"
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 'clamp(7px, 1.15vw, 12px)',
          lineHeight: 1,
          color: '#fff',
          opacity: 0.8,
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          letterSpacing: '0.02em',
          willChange: 'contents',
          textShadow: '0 0 8px rgba(255, 240, 180, 0.9), 0 0 16px rgba(255, 230, 150, 0.6), 0 0 32px rgba(255, 200, 100, 0.4)',
          mixBlendMode: 'screen',
        }}
      >
      </pre>
    </>
  )
}
