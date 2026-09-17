/**
 * 打地鼠猜图片微信小游戏
 *
 * 游戏玩法：
 * 1. 玩家通过打地鼠来揭示底层隐藏的图片
 * 2. 打到地鼠后，该区域会显示底层图片片段
 * 3. 玩家根据揭示的图片片段猜测图片内容
 * 4. 在规定时间内猜对则通关，进入下一关
 * 5. 共10个关卡，难度递增（网格从3×3到7×7）
 */

// ==================== 初始化Canvas和系统信息 ====================

/** 游戏画布 */
const canvas = wx.createCanvas()
/** 画布上下文 */
const ctx = canvas.getContext('2d')

/** 获取屏幕尺寸 */
const { windowWidth, windowHeight } = wx.getSystemInfoSync()

// ==================== 游戏配置 ====================

/**
 * 游戏全局配置
 * @property {number} GUESS_TIME - 每关猜图时间（秒）
 * @property {number} MOLE_SHOW_TIME_MIN - 地鼠显示最短时间（毫秒）
 * @property {number} MOLE_SHOW_TIME_MAX - 地鼠显示最长时间（毫秒）
 * @property {number} MOLE_APPEAR_INTERVAL - 地鼠出现间隔（毫秒）
 * @property {number} IMAGE_SHOW_TIME - 图片片段显示时间（毫秒）
 * @property {number} TOTAL_LEVELS - 总关卡数
 */
const GAME_CONFIG = {
  GUESS_TIME: 30,
  MOLE_SHOW_TIME_MIN: 1200,
  MOLE_SHOW_TIME_MAX: 2000,
  MOLE_APPEAR_INTERVAL: 600,
  IMAGE_SHOW_TIME: 2000,
  TOTAL_LEVELS: 10
}

/** 图片宽高比，初始值为1，图片加载后根据实际尺寸计算 */
let IMAGE_ASPECT_RATIO = 1

// ==================== 关卡难度系统 ====================

/**
 * 根据关卡获取网格大小
 * 1-2关：3×3，3-4关：4×4，5-6关：5×5，7-8关：6×6，9-10关：7×7
 * @param {number} level - 当前关卡索引（0-based）
 * @returns {number} 网格大小
 */
function getGridSize(level) {
  if (level < 2) return 3
  if (level < 4) return 4
  if (level < 6) return 5
  if (level < 8) return 6
  return 7
}

// ==================== 图片区域定义 ====================

/**
 * 图片显示区域
 * 根据图片宽高比计算，确保图片不变形
 */
const imageArea = {
  x: windowWidth * 0.05,
  y: windowHeight * 0.15,
  width: windowWidth * 0.9,
  height: windowWidth * 0.9 / IMAGE_ASPECT_RATIO
}

// 如果图片区域超出屏幕，自动调整大小和位置
if (imageArea.y + imageArea.height > windowHeight * 0.7) {
  imageArea.height = windowHeight * 0.55
  imageArea.width = imageArea.height * IMAGE_ASPECT_RATIO
  imageArea.x = (windowWidth - imageArea.width) / 2
}

// ==================== 关卡数据 ====================

/** 从bg/index.js加载关卡配置 */
const levelConfigs = require('../bg/index.js')
const levels = levelConfigs.map(config => ({
  name: config.name,
  file: config.file,
  options: config.options,
  image: null,
  imageLoaded: false
}))

/** 预加载所有关卡图片 */
levels.forEach(level => {
  level.image = wx.createImage()
  level.image.onload = function() {
    level.imageLoaded = true
  }
  level.image.src = 'bg/' + level.file
})

/**
 * 随机打乱数组顺序
 * @param {Array} arr - 待打乱的数组
 * @returns {Array} 打乱后的新数组
 */
function shuffleArray(arr) {
  const result = arr.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

// ==================== 游戏状态 ====================

/**
 * 游戏全局状态
 * @property {number} currentLevel - 当前关卡（0-based）
 * @property {number} timeLeft - 剩余时间（秒）
 * @property {boolean} isPlaying - 是否正在游戏
 * @property {number} lastMoleTime - 上次地鼠出现时间
 * @property {number} hitCount - 击中次数
 * @property {boolean} gameOver - 游戏失败
 * @property {boolean} levelComplete - 关卡完成
 * @property {number} gridSize - 当前网格大小
 * @property {Array} holes - 地鼠洞数组
 */
let gameState = {
  currentLevel: 0,
  currentLevelData: null,
  shuffledOptions: [],
  usedLevels: [],
  timeLeft: GAME_CONFIG.GUESS_TIME,
  isPlaying: false,
  lastMoleTime: 0,
  hitCount: 0,
  gameOver: false,
  levelComplete: false,
  gridSize: 3,
  holes: []
}

// ==================== 地鼠洞初始化 ====================

/**
 * 根据当前关卡初始化地鼠洞
 * 将图片区域平均划分为gridSize×gridSize的网格
 */
function initHoles() {
  const gridSize = getGridSize(gameState.currentLevel)
  gameState.gridSize = gridSize
  gameState.holes = []

  const cellWidth = imageArea.width / gridSize
  const cellHeight = imageArea.height / gridSize

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      gameState.holes.push({
        x: imageArea.x + col * cellWidth,
        y: imageArea.y + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        hasMole: false,
        moleTimer: null,
        showingImage: false,
        showImageTime: 0,
        hitAnimation: false,
        row: row,
        col: col
      })
    }
  }
}

initHoles()

// ==================== 图片资源加载 ====================

/** 图片资源对象 */
const images = {
  hole: wx.createImage(),
  mole: wx.createImage(),
  hitMole: wx.createImage()
}

images.hole.src = 'img/hole.png'
images.mole.src = 'img/mole.png'
images.hitMole.src = 'img/hit_mole.png'

/** 图片加载状态 */
const imageLoaded = {
  hole: false,
  mole: false,
  hitMole: false
}

images.hole.onload = function() {
  imageLoaded.hole = true
  updateImageAspectRatio(images.hole)
}
images.mole.onload = function() {
  imageLoaded.mole = true
  updateImageAspectRatio(images.mole)
}
images.hitMole.onload = function() { imageLoaded.hitMole = true }

/**
 * 根据图片实际尺寸更新宽高比，并重新计算图片区域
 * @param {Image} img - 已加载的图片对象
 */
function updateImageAspectRatio(img) {
  if (img.width > 0 && img.height > 0) {
    IMAGE_ASPECT_RATIO = img.width / img.height
    recalcImageArea()
  }
}

/** 根据当前宽高比重新计算图片显示区域 */
function recalcImageArea() {
  imageArea.width = windowWidth * 0.9
  imageArea.height = imageArea.width / IMAGE_ASPECT_RATIO
  imageArea.x = windowWidth * 0.05
  imageArea.y = windowHeight * 0.15

  if (imageArea.y + imageArea.height > windowHeight * 0.7) {
    imageArea.height = windowHeight * 0.55
    imageArea.width = imageArea.height * IMAGE_ASPECT_RATIO
    imageArea.x = (windowWidth - imageArea.width) / 2
  }

  initHoles()
}

// ==================== 绘制函数 ====================

/**
 * 绘制图片片段（地鼠被打后显示）
 * @param {Object} hole - 地鼠洞对象
 */
function drawImageFragment(hole) {
  const level = gameState.currentLevelData
  if (!level || !level.imageLoaded) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(hole.x, hole.y, hole.width, hole.height)
  ctx.clip()
  ctx.drawImage(level.image, imageArea.x, imageArea.y, imageArea.width, imageArea.height)
  ctx.restore()

  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 3
  ctx.strokeRect(hole.x, hole.y, hole.width, hole.height)
}

/**
 * 按宽高比绘制图片，确保不变形
 * @param {Image} img - 图片对象
 * @param {number} x - 区域起始x坐标
 * @param {number} y - 区域起始y坐标
 * @param {number} maxW - 区域最大宽度
 * @param {number} maxH - 区域最大高度
 * @param {number} offsetY - Y轴偏移量（可选）
 */
function drawImageWithAspect(img, x, y, maxW, maxH, offsetY) {
  let drawW = maxW
  let drawH = drawW / IMAGE_ASPECT_RATIO

  if (drawH > maxH) {
    drawH = maxH
    drawW = drawH * IMAGE_ASPECT_RATIO
  }

  const drawX = x + (maxW - drawW) / 2
  const drawY = y + (maxH - drawH) / 2 + (offsetY || 0)

  ctx.drawImage(img, drawX, drawY, drawW, drawH)
}

/** 绘制地洞 */
function drawHole(hole) {
  if (imageLoaded.hole) {
    drawImageWithAspect(images.hole, hole.x, hole.y, hole.width, hole.height)
  } else {
    const gradient = ctx.createRadialGradient(
      hole.x + hole.width / 2,
      hole.y + hole.height / 2,
      0,
      hole.x + hole.width / 2,
      hole.y + hole.height / 2,
      hole.width / 2
    )
    gradient.addColorStop(0, '#2C1810')
    gradient.addColorStop(0.5, '#3D2817')
    gradient.addColorStop(1, '#5A4030')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(
      hole.x + hole.width / 2,
      hole.y + hole.height * 0.7,
      hole.width / 2,
      hole.height * 0.3,
      0, 0, Math.PI * 2
    )
    ctx.fill()
  }
}

/** 绘制地鼠 */
function drawMole(hole) {
  if (!hole.hasMole && !hole.showingImage && !hole.hitAnimation) return

  let image = images.mole
  if (hole.hitAnimation && imageLoaded.hitMole) {
    image = images.hitMole
  }

  drawImageWithAspect(image, hole.x, hole.y, hole.width, hole.height)
}

/** 绘制顶部UI信息栏 */
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
  ctx.fillText(`${gameState.gridSize}×${gameState.gridSize}网格 | 打地鼠揭示图片，猜猜是什么！`, windowWidth / 2, windowHeight * 0.11)
}

/** 绘制底部选项按钮 */
function drawOptions() {
  const optionHeight = windowHeight * 0.08
  const optionWidth = (windowWidth - 40) / 2
  const startY = windowHeight * 0.75

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, startY - 10, windowWidth, windowHeight * 0.25 + 10)

  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('猜猜这是什么？', windowWidth / 2, startY + 5)

  gameState.shuffledOptions.forEach((option, index) => {
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

/** 绘制开始界面 */
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
  ctx.fillText('激情猜猜猜', windowWidth / 2, windowHeight * 0.4)

  ctx.fillStyle = '#FFF'
  ctx.font = '20px Arial'
  ctx.fillText('点击开始游戏', windowWidth / 2, windowHeight * 0.55)

  ctx.font = '16px Arial'
  ctx.fillStyle = '#FFD700'
  ctx.fillText('打地鼠揭示图片，猜对通关！', windowWidth / 2, windowHeight * 0.65)
  ctx.fillText('共10个关卡等你挑战！', windowWidth / 2, windowHeight * 0.72)
}

/** 绘制通关成功界面 */
function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, windowWidth, windowHeight)

  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🎉 通关成功！', windowWidth / 2, windowHeight * 0.12)

  const level = gameState.currentLevelData
  const imgDisplayWidth = windowWidth * 0.5
  const imgDisplayHeight = imgDisplayWidth / IMAGE_ASPECT_RATIO
  const imgX = (windowWidth - imgDisplayWidth) / 2
  const imgY = windowHeight * 0.18

  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 4
  ctx.strokeRect(imgX - 5, imgY - 5, imgDisplayWidth + 10, imgDisplayHeight + 10)

  if (level && level.imageLoaded) {
    ctx.drawImage(level.image, imgX, imgY, imgDisplayWidth, imgDisplayHeight)
  }

  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`这是：${level.name}`, windowWidth / 2, imgY + imgDisplayHeight + windowHeight * 0.06)

  ctx.fillStyle = '#90EE90'
  ctx.font = '22px Arial'
  ctx.fillText(`第 ${gameState.currentLevel + 1} 关完成`, windowWidth / 2, imgY + imgDisplayHeight + windowHeight * 0.11)

  if (gameState.currentLevel < GAME_CONFIG.TOTAL_LEVELS - 1) {
    ctx.fillStyle = '#4CAF50'
    ctx.font = '20px Arial'
    ctx.fillText('点击进入下一关', windowWidth / 2, windowHeight * 0.88)
  } else {
    ctx.fillStyle = '#FF6B6B'
    ctx.font = 'bold 24px Arial'
    ctx.fillText('🏆 恭喜通关全部关卡！', windowWidth / 2, windowHeight * 0.82)
    ctx.fillStyle = '#90EE90'
    ctx.font = '20px Arial'
    ctx.fillText('点击重新开始', windowWidth / 2, windowHeight * 0.88)
  }
}

/** 绘制关卡失败界面 */
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

// ==================== 游戏逻辑函数 ====================

/** 随机显示地鼠 */
function showMole() {
  const availableHoles = gameState.holes.filter(h => !h.hasMole && !h.showingImage)
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

/**
 * 处理点击地鼠事件
 * @param {number} x - 点击x坐标
 * @param {number} y - 点击y坐标
 * @returns {boolean} 是否击中地鼠
 */
function hitMole(x, y) {
  for (const hole of gameState.holes) {
    if (!hole.hasMole) continue

    const moleX = hole.x + hole.width / 2
    const moleY = hole.y + hole.height * 0.5
    const distance = Math.sqrt((x - moleX) ** 2 + (y - moleY) ** 2)

    if (distance < hole.width * 0.5) {
      hole.hasMole = false
      hole.hitAnimation = true
      clearTimeout(hole.moleTimer)

      gameState.hitCount++

      setTimeout(() => {
        hole.hitAnimation = false
        hole.showingImage = true
        hole.showImageTime = Date.now()

        setTimeout(() => {
          hole.showingImage = false
        }, GAME_CONFIG.IMAGE_SHOW_TIME)
      }, 300)

      return true
    }
  }
  return false
}

/**
 * 检查选项点击
 * @param {number} x - 点击x坐标
 * @param {number} y - 点击y坐标
 * @returns {boolean} 是否点击了选项
 */
function checkOption(x, y) {
  const level = gameState.currentLevelData
  if (!level) return false

  const optionHeight = windowHeight * 0.08
  const optionWidth = (windowWidth - 40) / 2
  const startY = windowHeight * 0.75

  for (let index = 0; index < gameState.shuffledOptions.length; index++) {
    const row = Math.floor(index / 2)
    const col = index % 2
    const optX = 10 + col * (optionWidth + 20)
    const optY = startY + 25 + row * (optionHeight + 10)

    if (x >= optX && x <= optX + optionWidth && y >= optY && y <= optY + optionHeight) {
      if (gameState.shuffledOptions[index] === level.name) {
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

// ==================== 事件监听 ====================

/** 触摸事件处理 */
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
      // 全部通关，重新开始
      gameState.currentLevel = 0
      gameState.levelComplete = false
      gameState.usedLevels = []
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

// ==================== 游戏控制函数 ====================

/** 开始游戏 */
function startGame() {
  // 从未使用的图片中随机选择，确保每个关卡使用不同图片
  if (levels.length > 0) {
    // 如果已使用图片数量达到上限或所有图片都已使用，重置已使用列表
    if (gameState.usedLevels.length >= GAME_CONFIG.TOTAL_LEVELS ||
        gameState.usedLevels.length >= levels.length) {
      gameState.usedLevels = []
    }

    // 筛选未使用的图片
    const availableLevels = levels.filter(level =>
      !gameState.usedLevels.some(used => used.file === level.file)
    )

    if (availableLevels.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableLevels.length)
      gameState.currentLevelData = availableLevels[randomIndex]
      gameState.usedLevels.push(gameState.currentLevelData)
      gameState.shuffledOptions = shuffleArray(gameState.currentLevelData.options)
    }
  }

  gameState.timeLeft = GAME_CONFIG.GUESS_TIME
  gameState.isPlaying = true
  gameState.lastMoleTime = 0
  gameState.hitCount = 0
  gameState.gameOver = false
  gameState.levelComplete = false

  initHoles()

  gameState.holes.forEach(h => {
    h.hasMole = false
    h.showingImage = false
    h.hitAnimation = false
    clearTimeout(h.moleTimer)
  })
}

/** 更新游戏状态 */
function update() {
  if (!gameState.isPlaying) return

  const now = Date.now()
  if (now - gameState.lastMoleTime > GAME_CONFIG.MOLE_APPEAR_INTERVAL) {
    showMole()
    gameState.lastMoleTime = now
  }
}

/** 渲染游戏画面 */
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

  gameState.holes.forEach(hole => {
    if (hole.hitAnimation) {
      drawHole(hole)
      drawMole(hole)
    } else if (hole.showingImage) {
      drawImageFragment(hole)
    } else {
      drawHole(hole)
      drawMole(hole)
    }
  })

  drawUI()
  drawOptions()
}

// ==================== 游戏主循环 ====================

/** 上次时间记录 */
let lastTime = Date.now()

/** 游戏主循环 */
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
        gameState.holes.forEach(h => {
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
