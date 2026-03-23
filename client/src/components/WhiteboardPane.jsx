import { useEffect, useRef, useCallback } from 'react'
import './WhiteboardPane.css'

const DEFAULT_COLOR = '#1a73e8'
const LINE_WIDTH = 2

function drawStrokes(ctx, strokes) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const s of strokes) {
    if (!s?.points?.length) continue
    ctx.beginPath()
    ctx.strokeStyle = s.color || DEFAULT_COLOR
    ctx.lineWidth = s.width || LINE_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const [x0, y0] = s.points[0]
    ctx.moveTo(x0, y0)
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = s.points[i]
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

/**
 * Collaborative sketch layer using Y.Array('strokes') on the same Y.Doc as the editor.
 */
export default function WhiteboardPane({ yDocRef, active }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const pointsRef = useRef([])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const yDoc = yDocRef.current
    if (!canvas || !yDoc) return
    const ctx = canvas.getContext('2d')
    const yArr = yDoc.getArray('strokes')
    drawStrokes(ctx, yArr.toArray())
  }, [yDocRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, rect.width * dpr)
      canvas.height = Math.max(1, rect.height * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      redraw()
    })
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)
    return () => ro.disconnect()
  }, [redraw])

  useEffect(() => {
    const yDoc = yDocRef.current
    if (!yDoc) return
    const yArr = yDoc.getArray('strokes')
    const obs = () => redraw()
    yArr.observe(obs)
    redraw()
    return () => yArr.unobserve(obs)
  }, [yDocRef, active, redraw])

  const toLocal = (e) => {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const onDown = (e) => {
    if (!active) return
    const yDoc = yDocRef.current
    if (!yDoc) return
    drawingRef.current = true
    pointsRef.current = [toLocal(e)]
  }

  const onMove = (e) => {
    if (!drawingRef.current || !active) return
    pointsRef.current.push(toLocal(e))
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pts = pointsRef.current
    if (pts.length < 2) return
    const [x1, y1] = pts[pts.length - 2]
    const [x2, y2] = pts[pts.length - 1]
    ctx.beginPath()
    ctx.strokeStyle = DEFAULT_COLOR
    ctx.lineWidth = LINE_WIDTH
    ctx.lineCap = 'round'
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const onUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const yDoc = yDocRef.current
    if (!yDoc) return
    const pts = pointsRef.current
    pointsRef.current = []
    if (pts.length < 2) return
    const stroke = { points: pts, color: DEFAULT_COLOR, width: LINE_WIDTH }
    yDoc.transact(() => {
      yDoc.getArray('strokes').push([stroke])
    })
  }

  return (
    <div className={`whiteboard-pane ${active ? 'active' : ''}`}>
      <p className="whiteboard-hint">
        Draw with your mouse or finger. Strokes sync in real time with collaborators.
      </p>
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
    </div>
  )
}
