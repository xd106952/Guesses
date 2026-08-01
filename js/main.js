const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

const { windowWidth, windowHeight } = wx.getSystemInfoSync()

const GAME_CONFIG = {
  GRID_COLS: 3,
  GRID_ROWS: 3,
  HOLE_WIDTH: windowWidth * 0.3,
  HOLE_HEIGHT: windowWidth * 0.3,
  GUESS_TIME: 30,
  MOLE_SHOW_TIME_MIN: 1200,
  MOLE_SHOW_TIME_MAX: 2000,
  MOLE_APPEAR_INTERVAL: 600,
  IMAGE_SHOW_TIME: 500,
  TOTAL_LEVELS: 10
}

const levels = [
  { name: '小猫', draw: drawCat, options: ['小猫', '小狗', '小兔', '小熊'] },
  { name: '小狗', draw: drawDog, options: ['小猫', '小狗', '小兔', '小熊'] },
  { name: '小兔', draw: drawRabbit, options: ['小猫', '小狗', '小兔', '小熊'] },
  { name: '小鸟', draw: drawBird, options: ['小鸟', '蝴蝶', '蜜蜂', '蜻蜓'] },
  { name: '蝴蝶', draw: drawButterfly, options: ['小鸟', '蝴蝶', '蜜蜂', '蜻蜓'] },
  { name: '向日葵', draw: drawSunflower, options: ['向日葵', '玫瑰', '郁金香', '荷花'] },
  { name: '玫瑰', draw: drawRose, options: ['向日葵', '玫瑰', '郁金香', '荷花'] },
  { name: '大树', draw: drawTree, options: ['大树', '小草', '花朵', '蘑菇'] },
  { name: '小鱼', draw: drawFish, options: ['小鱼', '螃蟹', '海星', '水母'] },
  { name: '熊猫', draw: drawPanda, options: ['熊猫', '老虎', '狮子', '大象'] }
]

let gameState = {
  currentLevel: 0,
  timeLeft: GAME_CONFIG.GUESS_TIME,
  isPlaying: false,
  isGuessing: false,
  lastMoleTime: 0,
  hitCount: 0,
  revealedAreas: [],
  gameOver: false,
  levelComplete: false
}

const holes = []
const holeSpacing = {
  x: (windowWidth - GAME_CONFIG.GRID_COLS * GAME_CONFIG.HOLE_WIDTH) / (GAME_CONFIG.GRID_COLS + 1),
  y: (windowHeight * 0.58 - GAME_CONFIG.GRID_ROWS * GAME_CONFIG.HOLE_HEIGHT) / (GAME_CONFIG.GRID_ROWS + 1)
}

for (let row = 0; row < GAME_CONFIG.GRID_ROWS; row++) {
  for (let col = 0; col < GAME_CONFIG.GRID_COLS; col++) {
    holes.push({
      x: holeSpacing.x + col * (GAME_CONFIG.HOLE_WIDTH + holeSpacing.x),
      y: windowHeight * 0.16 + holeSpacing.y + row * (GAME_CONFIG.HOLE_HEIGHT + holeSpacing.y),
      hasMole: false,
      moleTimer: null,
      showingImage: false,
      showImageTime: 0,
      row: row,
      col: col
    })
  }
}

function drawCat(ctx, x, y, w, h) {
  ctx.fillStyle = '#FFA500'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.35, h*0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.beginPath()
  ctx.moveTo(x + w*0.2, y + h*0.2)
  ctx.lineTo(x + w*0.3, y + h*0.05)
  ctx.lineTo(x + w*0.35, y + h*0.2)
  ctx.fill()
  
  ctx.beginPath()
  ctx.moveTo(x + w*0.8, y + h*0.2)
  ctx.lineTo(x + w*0.7, y + h*0.05)
  ctx.lineTo(x + w*0.65, y + h*0.2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(x + w*0.35, y + h*0.45, w*0.06, 0, Math.PI * 2)
  ctx.arc(x + w*0.65, y + h*0.45, w*0.06, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FF69B4'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h*0.55, w*0.05, h*0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + w*0.5, y + h*0.55)
  ctx.lineTo(x + w*0.3, y + h*0.5)
  ctx.moveTo(x + w*0.5, y + h*0.55)
  ctx.lineTo(x + w*0.7, y + h*0.5)
  ctx.stroke()
}

function drawDog(ctx, x, y, w, h) {
  ctx.fillStyle = '#8B4513'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.35, h*0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#A0522D'
  ctx.beginPath()
  ctx.ellipse(x + w*0.2, y + h*0.3, w*0.12, h*0.2, -0.3, 0, Math.PI * 2)
  ctx.ellipse(x + w*0.8, y + h*0.3, w*0.12, h*0.2, 0.3, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(x + w*0.35, y + h*0.45, w*0.06, 0, Math.PI * 2)
  ctx.arc(x + w*0.65, y + h*0.45, w*0.06, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h*0.6, w*0.12, h*0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FF69B4'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h*0.58, w*0.05, h*0.03, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawRabbit(ctx, x, y, w, h) {
  ctx.fillStyle = '#FFF'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.3, h*0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FFE4E1'
  ctx.beginPath()
  ctx.ellipse(x + w*0.35, y + h*0.15, w*0.08, h*0.25, -0.2, 0, Math.PI * 2)
  ctx.ellipse(x + w*0.65, y + h*0.15, w*0.08, h*0.25, 0.2, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(x + w*0.35, y + h*0.45, w*0.05, 0, Math.PI * 2)
  ctx.arc(x + w*0.65, y + h*0.45, w*0.05, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FFB6C1'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h*0.55, w*0.04, h*0.03, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawBird(ctx, x, y, w, h) {
  ctx.fillStyle = '#4169E1'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.3, h*0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.ellipse(x + w*0.7, y + h*0.5, w*0.15, h*0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(x + w*0.4, y + h*0.4, w*0.05, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FF6347'
  ctx.beginPath()
  ctx.moveTo(x + w*0.75, y + h*0.5)
  ctx.lineTo(x + w*0.9, y + h*0.48)
  ctx.lineTo(x + w*0.75, y + h*0.52)
  ctx.fill()
}

function drawButterfly(ctx, x, y, w, h) {
  ctx.fillStyle = '#FF69B4'
  ctx.beginPath()
  ctx.ellipse(x + w*0.3, y + h*0.4, w*0.25, h*0.35, -0.3, 0, Math.PI * 2)
  ctx.ellipse(x + w*0.7, y + h*0.4, w*0.25, h*0.35, 0.3, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FFB6C1'
  ctx.beginPath()
  ctx.ellipse(x + w*0.3, y + h*0.65, w*0.18, h*0.2, -0.3, 0, Math.PI * 2)
  ctx.ellipse(x + w*0.7, y + h*0.65, w*0.18, h*0.2, 0.3, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.05, h*0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + w/2, y + h*0.2)
  ctx.quadraticCurveTo(x + w*0.4, y + h*0.1, x + w*0.35, y + h*0.05)
  ctx.moveTo(x + w/2, y + h*0.2)
  ctx.quadraticCurveTo(x + w*0.6, y + h*0.1, x + w*0.65, y + h*0.05)
  ctx.stroke()
}

function drawSunflower(ctx, x, y, w, h) {
  ctx.fillStyle = '#FFD700'
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const px = x + w/2 + Math.cos(angle) * w*0.3
    const py = y + h/2 + Math.sin(angle) * h*0.3
    ctx.beginPath()
    ctx.ellipse(px, py, w*0.12, h*0.08, angle, 0, Math.PI * 2)
    ctx.fill()
  }
  
  ctx.fillStyle = '#8B4513'
  ctx.beginPath()
  ctx.arc(x + w/2, y + h/2, w*0.15, 0, Math.PI * 2)
  ctx.fill()
}

function drawRose(ctx, x, y, w, h) {
  ctx.fillStyle = '#DC143C'
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const px = x + w/2 + Math.cos(angle) * w*0.15
    const py = y + h/2 + Math.sin(angle) * h*0.15
    ctx.beginPath()
    ctx.ellipse(px, py, w*0.2, h*0.15, angle + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  
  ctx.fillStyle = '#FFB6C1'
  ctx.beginPath()
  ctx.arc(x + w/2, y + h/2, w*0.12, 0, Math.PI * 2)
  ctx.fill()
}

function drawTree(ctx, x, y, w, h) {
  ctx.fillStyle = '#228B22'
  ctx.beginPath()
  ctx.moveTo(x + w/2, y + h*0.1)
  ctx.lineTo(x + w*0.15, y + h*0.7)
  ctx.lineTo(x + w*0.85, y + h*0.7)
  ctx.closePath()
  ctx.fill()
  
  ctx.fillStyle = '#8B4513'
  ctx.fillRect(x + w*0.4, y + h*0.7, w*0.2, h*0.25)
}

function drawFish(ctx, x, y, w, h) {
  ctx.fillStyle = '#FF6347'
  ctx.beginPath()
  ctx.ellipse(x + w*0.45, y + h/2, w*0.35, h*0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.beginPath()
  ctx.moveTo(x + w*0.8, y + h/2)
  ctx.lineTo(x + w*0.95, y + h*0.3)
  ctx.lineTo(x + w*0.95, y + h*0.7)
  ctx.closePath()
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(x + w*0.25, y + h/2, w*0.05, 0, Math.PI * 2)
  ctx.fill()
}

function drawPanda(ctx, x, y, w, h) {
  ctx.fillStyle = '#FFF'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h/2, w*0.35, h*0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x + w*0.3, y + h*0.35, w*0.12, h*0.15, 0, 0, Math.PI * 2)
  ctx.ellipse(x + w*0.7, y + h*0.35, w*0.12, h*0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#FFF'
  ctx.beginPath()
  ctx.arc(x + w*0.3, y + h*0.35, w*0.05, 0, Math.PI * 2)
  ctx.arc(x + w*0.7, y + h*0.35, w*0.05, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x + w/2, y + h*0.6, w*0.08, h*0.06, 0, 0, Math.PI * 2)
  ctx.fill()
}

function createMoleImage(bodyColor, noseColor) {
  const offCanvas = wx.createOffscreenCanvas(100, 100)
  const offCtx = offCanvas.getContext('2d')
  
  offCtx.fillStyle = bodyColor
  offCtx.beginPath()
  offCtx.ellipse(50, 55, 40, 35, 0, 0, Math.PI * 2)
  offCtx.fill()
  
  offCtx.fillStyle = noseColor
  offCtx.beginPath()
  offCtx.ellipse(50, 60, 12, 10, 0, 0, Math.PI * 2)
  offCtx.fill()
  
  offCtx.fillStyle = '#000'
  offCtx.beginPath()
  offCtx.arc(35, 45, 6, 0, Math.PI * 2)
  offCtx.arc(65, 45, 6, 0, Math.PI * 2)
  offCtx.fill()
  
  offCtx.fillStyle = '#FFF'
  offCtx.beginPath()
  offCtx.arc(37, 43, 2, 0, Math.PI * 2)
  offCtx.arc(67, 43, 2, 0, Math.PI * 2)
  offCtx.fill()
  
  offCtx.strokeStyle = bodyColor
  offCtx.lineWidth = 3
  offCtx.beginPath()
  offCtx.arc(35, 35, 8, 0, Math.PI)
  offCtx.stroke()
  offCtx.beginPath()
  offCtx.arc(65, 35, 8, 0, Math.PI)
  offCtx.stroke()
  
  return offCanvas
}

const moleImages = {
  normal: createMoleImage('#8B4513', '#D2691E'),
  hit: createMoleImage('#FF6B6B', '#FFE66D')
}

function drawHiddenImage() {
  const level = levels[gameState.currentLevel]
  const imgX = holeSpacing.x
  const imgY = windowHeight * 0.16 + holeSpacing.y
  const imgW = GAME_CONFIG.GRID_COLS * GAME_CONFIG.HOLE_WIDTH + (GAME_CONFIG.GRID_COLS - 1) * holeSpacing.x
  const imgH = GAME_CONFIG.GRID_ROWS * GAME_CONFIG.HOLE_HEIGHT + (GAME_CONFIG.GRID_ROWS - 1) * holeSpacing.y
  
  level.draw(ctx, imgX, imgY, imgW, imgH)
}

function drawImageFragment(hole) {
  const level = levels[gameState.currentLevel]
  const imgX = holeSpacing.x
  const imgY = windowHeight * 0.16 + holeSpacing.y
  const imgW = GAME_CONFIG.GRID_COLS * GAME_CONFIG.HOLE_WIDTH + (GAME_CONFIG.GRID_COLS - 1) * holeSpacing.x
  const imgH = GAME_CONFIG.GRID_ROWS * GAME_CONFIG.HOLE_HEIGHT + (GAME_CONFIG.GRID_ROWS - 1) * holeSpacing.y
  
  ctx.save()
  
  ctx.beginPath()
  ctx.rect(hole.x, hole.y, GAME_CONFIG.HOLE_WIDTH, GAME_CONFIG.HOLE_HEIGHT)
  ctx.clip()
  
  level.draw(ctx, imgX, imgY, imgW, imgH)
  
  ctx.restore()
  
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 3
  ctx.strokeRect(hole.x, hole.y, GAME_CONFIG.HOLE_WIDTH, GAME_CONFIG.HOLE_HEIGHT)
}

function drawHole(hole) {
  const gradient = ctx.createRadialGradient(
    hole.x + GAME_CONFIG.HOLE_WIDTH / 2,
    hole.y + GAME_CONFIG.HOLE_HEIGHT / 2,
    0,
    hole.x + GAME_CONFIG.HOLE_WIDTH / 2,
    hole.y + GAME_CONFIG.HOLE_HEIGHT / 2,
    GAME_CONFIG.HOLE_WIDTH / 2
  )
  gradient.addColorStop(0, '#2C1810')
  gradient.addColorStop(0.5, '#3D2817')
  gradient.addColorStop(1, '#5A4030')
  
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.ellipse(
    hole.x + GAME_CONFIG.HOLE_WIDTH / 2,
    hole.y + GAME_CONFIG.HOLE_HEIGHT * 0.7,
    GAME_CONFIG.HOLE_WIDTH / 2,
    GAME_CONFIG.HOLE_HEIGHT * 0.3,
    0, 0, Math.PI * 2
  )
  ctx.fill()
  
  ctx.fillStyle = '#4A3525'
  ctx.beginPath()
  ctx.ellipse(
    hole.x + GAME_CONFIG.HOLE_WIDTH / 2,
    hole.y + GAME_CONFIG.HOLE_HEIGHT * 0.7,
    GAME_CONFIG.HOLE_WIDTH / 2 - 5,
    GAME_CONFIG.HOLE_HEIGHT * 0.25,
    0, 0, Math.PI * 2
  )
  ctx.fill()
}

function drawMole(hole) {
  if (!hole.hasMole && !hole.showingImage) return
  
  let image = moleImages.normal
  const moleWidth = GAME_CONFIG.HOLE_WIDTH * 0.85
  const moleHeight = GAME_CONFIG.HOLE_HEIGHT * 0.85
  
  ctx.drawImage(
    image,
    hole.x + (GAME_CONFIG.HOLE_WIDTH - moleWidth) / 2,
    hole.y + GAME_CONFIG.HOLE_HEIGHT * 0.25 - moleHeight * 0.25,
    moleWidth,
    moleHeight
  )
}

function drawUI() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, windowWidth, windowHeight * 0.15)
  
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`关卡: ${gameState.currentLevel + 1}/${GAME_CONFIG.TOTAL_LEVELS}`, 20, windowHeight * 0.06)
  
  ctx.textAlign = 'center'
  ctx.fillText(`剩余时间: ${gameState.timeLeft}s`, windowWidth / 2, windowHeight * 0.06)
  
  ctx.textAlign = 'right'
  ctx.fillText(`击中: ${gameState.hitCount}`, windowWidth - 20, windowHeight * 0.06)
  
  ctx.fillStyle = '#90EE90'
  ctx.font = '16px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('打地鼠揭示隐藏图片，然后猜猜是什么！', windowWidth / 2, windowHeight * 0.11)
}

function drawOptions() {
  const level = levels[gameState.currentLevel]
  const optionHeight = windowHeight * 0.08
  const optionWidth = (windowWidth - 40) / 2
  const startY = windowHeight * 0.75
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, startY - 10, windowWidth, windowHeight * 0.25 + 10)
  
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('猜猜这是什么？', windowWidth / 2, startY + 5)
  
  level.options.forEach((option, index) => {
    const row = Math.floor(index / 2)
    const col = index % 2
    const x = 10 + col * (optionWidth + 20)
    const y = startY + 25 + row * (optionHeight + 10)
    
    const gradient = ctx.createLinearGradient(x, y, x, y + optionHeight)
    gradient.addColorStop(0, '#4CAF50')
    gradient.addColorStop(1, '#45a049')
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, optionWidth, optionHeight)
    
    ctx.strokeStyle = '#2E7D32'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, optionWidth, optionHeight)
    
    ctx.fillStyle = '#FFF'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(option, x + optionWidth / 2, y + optionHeight / 2 + 6)
  })
}

function drawStartScreen() {
  ctx.fillStyle = '#87CEEB'
  ctx.fillRect(0, 0, windowWidth, windowHeight)
  
  const gradient = ctx.createLinearGradient(0, windowHeight * 0.3, 0, windowHeight * 0.7)
  gradient.addColorStop(0, '#90EE90')
  gradient.addColorStop(1, '#228B22')
  ctx.fillStyle = gradient
  ctx.fillRect(0, windowHeight * 0.3, windowWidth, windowHeight * 0.4)
  
  ctx.fillStyle = '#8B4513'
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('打地鼠猜图片', windowWidth / 2, windowHeight * 0.4)
  
  ctx.fillStyle = '#FFF'
  ctx.font = '20px Arial'
  ctx.fillText('点击开始游戏', windowWidth / 2, windowHeight * 0.55)
  
  ctx.font = '16px Arial'
  ctx.fillStyle = '#FFD700'
  ctx.fillText('打地鼠揭示图片，猜对通关！', windowWidth / 2, windowHeight * 0.65)
  ctx.fillText('共10个关卡等你挑战！', windowWidth / 2, windowHeight * 0.72)
}

function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, windowWidth, windowHeight)
  
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🎉 通关成功！', windowWidth / 2, windowHeight * 0.35)
  
  ctx.fillStyle = '#FFF'
  ctx.font = '24px Arial'
  ctx.fillText(`第 ${gameState.currentLevel + 1} 关完成`, windowWidth / 2, windowHeight * 0.45)
  
  if (gameState.currentLevel < GAME_CONFIG.TOTAL_LEVELS - 1) {
    ctx.fillStyle = '#90EE90'
    ctx.font = '20px Arial'
    ctx.fillText('点击进入下一关', windowWidth / 2, windowHeight * 0.6)
  } else {
    ctx.fillStyle = '#FF6B6B'
    ctx.font = 'bold 28px Arial'
    ctx.fillText('🏆 恭喜通关全部关卡！', windowWidth / 2, windowHeight * 0.55)
    ctx.fillStyle = '#90EE90'
    ctx.font = '20px Arial'
    ctx.fillText('点击重新开始', windowWidth / 2, windowHeight * 0.7)
  }
}

function drawLevelFailed() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, windowWidth, windowHeight)
  
  ctx.fillStyle = '#FF6B6B'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  
  if (gameState.timeLeft <= 0) {
    ctx.fillText('⏰ 时间到！', windowWidth / 2, windowHeight * 0.35)
  } else {
    ctx.fillText('❌ 答错了！', windowWidth / 2, windowHeight * 0.35)
  }
  
  ctx.fillStyle = '#FFF'
  ctx.font = '24px Arial'
  ctx.fillText('再接再厉！', windowWidth / 2, windowHeight * 0.45)
  
  ctx.fillStyle = '#90EE90'
  ctx.font = '20px Arial'
  ctx.fillText('点击重新挑战本关', windowWidth / 2, windowHeight * 0.6)
}

function showMole() {
  const availableHoles = holes.filter(h => !h.hasMole && !h.showingImage)
  if (availableHoles.length === 0) return
  
  const hole = availableHoles[Math.floor(Math.random() * availableHoles.length)]
  hole.hasMole = true
  
  const showTime = GAME_CONFIG.MOLE_SHOW_TIME_MIN + 
    Math.random() * (GAME_CONFIG.MOLE_SHOW_TIME_MAX - GAME_CONFIG.MOLE_SHOW_TIME_MIN)
  
  hole.moleTimer = setTimeout(() => {
    if (hole.hasMole) {
      hole.hasMole = false
    }
  }, showTime)
}

function hitMole(x, y) {
  for (const hole of holes) {
    if (!hole.hasMole) continue
    
    const moleX = hole.x + GAME_CONFIG.HOLE_WIDTH / 2
    const moleY = hole.y + GAME_CONFIG.HOLE_HEIGHT * 0.5
    const distance = Math.sqrt((x - moleX) ** 2 + (y - moleY) ** 2)
    
    if (distance < GAME_CONFIG.HOLE_WIDTH * 0.5) {
      hole.hasMole = false
      hole.showingImage = true
      hole.showImageTime = Date.now()
      clearTimeout(hole.moleTimer)
      
      gameState.hitCount++
      
      setTimeout(() => {
        hole.showingImage = false
      }, GAME_CONFIG.IMAGE_SHOW_TIME)
      
      return true
    }
  }
  return false
}

function checkOption(x, y) {
  const level = levels[gameState.currentLevel]
  const optionHeight = windowHeight * 0.08
  const optionWidth = (windowWidth - 40) / 2
  const startY = windowHeight * 0.75
  
  for (let index = 0; index < level.options.length; index++) {
    const row = Math.floor(index / 2)
    const col = index % 2
    const optX = 10 + col * (optionWidth + 20)
    const optY = startY + 25 + row * (optionHeight + 10)
    
    if (x >= optX && x <= optX + optionWidth && y >= optY && y <= optY + optionHeight) {
      if (level.options[index] === level.name) {
        gameState.levelComplete = true
        gameState.isPlaying = false
      } else {
        gameState.gameOver = true
        gameState.isPlaying = false
      }
      return true
    }
  }
  return false
}

wx.onTouchStart((e) => {
  const touch = e.touches[0]
  
  if (!gameState.isPlaying && !gameState.levelComplete && !gameState.gameOver) {
    startGame()
    return
  }
  
  if (gameState.levelComplete) {
    if (gameState.currentLevel < GAME_CONFIG.TOTAL_LEVELS - 1) {
      gameState.currentLevel++
      startGame()
    } else {
      gameState.currentLevel = 0
      gameState.levelComplete = false
      startGame()
    }
    return
  }
  
  if (gameState.gameOver) {
    startGame()
    return
  }
  
  if (touch.clientY > windowHeight * 0.75) {
    checkOption(touch.clientX, touch.clientY)
  } else {
    hitMole(touch.clientX, touch.clientY)
  }
})

function startGame() {
  gameState.timeLeft = GAME_CONFIG.GUESS_TIME
  gameState.isPlaying = true
  gameState.isGuessing = false
  gameState.lastMoleTime = 0
  gameState.hitCount = 0
  gameState.revealedAreas = []
  gameState.gameOver = false
  gameState.levelComplete = false
  
  holes.forEach(h => {
    h.hasMole = false
    h.showingImage = false
    clearTimeout(h.moleTimer)
  })
}

function update() {
  if (!gameState.isPlaying) return
  
  const now = Date.now()
  if (now - gameState.lastMoleTime > GAME_CONFIG.MOLE_APPEAR_INTERVAL) {
    showMole()
    gameState.lastMoleTime = now
  }
}

function render() {
  ctx.clearRect(0, 0, windowWidth, windowHeight)
  
  if (!gameState.isPlaying && !gameState.levelComplete && !gameState.gameOver) {
    drawStartScreen()
    return
  }
  
  if (gameState.levelComplete) {
    drawLevelComplete()
    return
  }
  
  if (gameState.gameOver) {
    drawLevelFailed()
    return
  }
  
  const gradient = ctx.createLinearGradient(0, 0, 0, windowHeight)
  gradient.addColorStop(0, '#87CEEB')
  gradient.addColorStop(0.3, '#90EE90')
  gradient.addColorStop(1, '#228B22')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, windowWidth, windowHeight)
  
  holes.forEach(hole => {
    if (hole.showingImage) {
      drawImageFragment(hole)
    } else {
      drawHole(hole)
      drawMole(hole)
    }
  })
  
  drawUI()
  drawOptions()
}

let lastTime = Date.now()

function gameLoop() {
  const now = Date.now()
  
  if (gameState.isPlaying) {
    update()
    
    if (now - lastTime >= 1000) {
      gameState.timeLeft--
      lastTime = now
      
      if (gameState.timeLeft <= 0) {
        gameState.gameOver = true
        gameState.isPlaying = false
        holes.forEach(h => {
          clearTimeout(h.moleTimer)
          h.hasMole = false
        })
      }
    }
  }
  
  render()
  requestAnimationFrame(gameLoop)
}

gameLoop()
