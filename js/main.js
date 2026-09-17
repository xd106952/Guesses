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

// ==================== 开放数据域（好友排行榜） ====================

/** 开放数据上下文，用于与好友排行榜数据域通信 */
const openDataContext = wx.getOpenDataContext()
/** 开放数据域共享画布，渲染好友排行榜内容 */
const sharedCanvas = openDataContext.canvas

/** sharedCanvas 分辨率与排行榜列表绘制区域对应；宽高等只能在主域设置（开放数据域限制） */
sharedCanvas.width = Math.floor(windowWidth * 0.9)
sharedCanvas.height = Math.floor(windowHeight * 0.73)

// ==================== 游戏配置 ====================

/**
 * 游戏全局配置
 * @property {number} GUESS_TIME - 每关猜图时间（秒）
 * @property {number} MOLE_SHOW_TIME_MIN - 地鼠显示最短时间（毫秒）
 * @property {number} MOLE_SHOW_TIME_MAX - 地鼠显示最长时间（毫秒）
 * @property {number} MOLE_APPEAR_INTERVAL - 地鼠出现间隔（毫秒）
 * @property {number} IMAGE_SHOW_TIME - 图片片段显示时间（毫秒）
 * @property {number} TOTAL_LEVELS - 总关卡数
 * @property {number} MAX_LIVES - 玩家初始红心（生命值）数量
 */
const GAME_CONFIG = {
  GUESS_TIME: 30,
  MOLE_SHOW_TIME_MIN: 1200,
  MOLE_SHOW_TIME_MAX: 2000,
  MOLE_APPEAR_INTERVAL: 600,
  IMAGE_SHOW_TIME: 2000,
  TOTAL_LEVELS: 10,
  MAX_LIVES: 3
}

/** 图片宽高比，初始值为1，图片加载后根据实际尺寸计算 */
let IMAGE_ASPECT_RATIO = 1

/** 游戏界面整体垂直偏移量（像素），使游戏内容下移 */
const GAME_OFFSET_Y = 20

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

// ==================== 积分体系 ====================

/**
 * 难度等级积分配置表
 * 每关积分 = (基础分 + (关卡限时 - 过关用时) × 时间系数) × 难度系数
 * @property {string} name - 难度级别名称
 * @property {number} baseScore - 关卡基础分
 * @property {number} timeMultiplier - 时间系数（分/秒）
 * @property {number} levelMultiplier - 难度系数
 */
const SCORE_CONFIG = [
  { name: '新手入门', baseScore: 10, timeMultiplier: 5,  levelMultiplier: 1.0 },
  { name: '进阶挑战', baseScore: 15, timeMultiplier: 10, levelMultiplier: 1.2 },
  { name: '高手对决', baseScore: 20, timeMultiplier: 15, levelMultiplier: 1.4 },
  { name: '宗师试炼', baseScore: 25, timeMultiplier: 20, levelMultiplier: 1.6 },
  { name: '极限巅峰', baseScore: 30, timeMultiplier: 25, levelMultiplier: 1.8 }
]

/**
 * 根据关卡索引获取积分配置
 * 1-2关：新手入门，3-4关：进阶挑战，5-6关：高手对决，7-8关：宗师试炼，9-10关：极限巅峰
 * @param {number} levelIndex - 关卡索引（0-based）
 * @returns {Object} 对应难度的积分配置
 */
function getScoreConfig(levelIndex) {
  if (levelIndex < 2) return SCORE_CONFIG[0]
  if (levelIndex < 4) return SCORE_CONFIG[1]
  if (levelIndex < 6) return SCORE_CONFIG[2]
  if (levelIndex < 8) return SCORE_CONFIG[3]
  return SCORE_CONFIG[4]
}

/**
 * 计算指定关卡的积分
 * 公式：每关积分 = (关卡基础分 + (关卡限时 - 过关用时) × 时间系数) × 难度系数
 * @param {number} levelIndex - 关卡索引（0-based）
 * @param {number} usedTime - 过关用时（秒）
 * @returns {number} 该关卡积分（四舍五入取整）
 */
function calcLevelScore(levelIndex, usedTime) {
  const config = getScoreConfig(levelIndex)
  const timeBonus = (GAME_CONFIG.GUESS_TIME - usedTime) * config.timeMultiplier
  return Math.round((config.baseScore + timeBonus) * config.levelMultiplier)
}

/**
 * 获取当前时间对应的周标识（ISO周，周一为每周起点）
 * 用于积分按周清零：每周一零点后周标识变化，积分重新累计
 * @returns {string} 周标识，格式如 "2026W38"
 */
function getWeekKey() {
  const now = new Date()
  // 取本地日期（去掉时分秒）
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // (getDay()+6)%7：周一=0 ... 周日=6
  const day = (date.getDay() + 6) % 7
  // 将日期移到本周四（ISO周以周四所在年份和周数为准）
  date.setDate(date.getDate() - day + 3)
  const year = date.getFullYear()

  // 找到该年份的第一个周四（ISO第1周的定义）
  const firstThursday = new Date(year, 0, 4)
  const firstDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3)

  // 计算当前是第几周
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000))
  return String(year) + 'W' + String(week)
}

// ==================== 图片区域定义 ====================

/**
 * 图片显示区域
 * 根据图片宽高比计算，确保图片不变形
 */
const imageArea = {
  x: windowWidth * 0.05,
  y: windowHeight * 0.15 + GAME_OFFSET_Y,
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

/**
 * 判断两个数组元素顺序是否完全相同
 * @param {Array} a - 数组1
 * @param {Array} b - 数组2
 * @returns {boolean} 顺序是否相同
 */
function isSameOrder(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** 个人最好成绩的本地存储键名 */
const BEST_SCORE_KEY = 'bestScore'

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
 * @property {boolean} showRanking - 是否显示好友排行榜界面
 * @property {number} totalScore - 本轮累计总积分（用于好友排行榜）
 * @property {number} lastLevelScore - 上一关获得的积分
 * @property {string} scoreWeek - 当前积分所属周标识，跨周时积分清零
 * @property {number} lives - 剩余红心（生命值）数量
 * @property {boolean} gameFinished - 三个红心耗尽，游戏结束
 * @property {boolean} isNewRecord - 本轮是否刷新个人最好成绩
 * @property {number} bestScore - 个人最好成绩（本地存储持久化）
 * @property {Array} lastShuffledOptions - 上一次显示的选项顺序，用于保证每次顺序不同
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
  showRanking: false,
  totalScore: 0,
  lastLevelScore: 0,
  scoreWeek: getWeekKey(),
  lives: GAME_CONFIG.MAX_LIVES,
  gameFinished: false,
  isNewRecord: false,
  bestScore: wx.getStorageSync(BEST_SCORE_KEY) || 0,
  lastShuffledOptions: [],
  gridSize: 3,
  holes: []
}

// ==================== 排行榜界面区域定义 ====================

/** 开始界面"好友排行榜"按钮区域 */
const rankingBtnArea = {
  x: windowWidth * 0.25,
  y: windowHeight * 0.78,
  width: windowWidth * 0.5,
  height: windowHeight * 0.07
}

/** 排行榜界面"返回"按钮区域 */
const backBtnArea = {
  x: windowWidth * 0.25,
  y: windowHeight * 0.86,
  width: windowWidth * 0.5,
  height: windowHeight * 0.07
}

/** 排行榜列表绘制区域（与开放数据域 sharedCanvas 尺寸对应） */
const rankingListArea = {
  x: windowWidth * 0.05,
  y: windowHeight * 0.1,
  width: windowWidth * 0.9,
  height: windowHeight * 0.73
}

/** 游戏结束界面"返回游戏"按钮区域 */
const gameoverBtnArea = {
  x: windowWidth * 0.25,
  y: windowHeight * 0.7,
  width: windowWidth * 0.5,
  height: windowHeight * 0.08
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
  imageArea.y = windowHeight * 0.15 + GAME_OFFSET_Y

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

/** 绘制顶部UI信息栏（整体随 GAME_OFFSET_Y 下移，黑色区域加厚避免断层） */
function drawUI() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, windowWidth, windowHeight * 0.15 + GAME_OFFSET_Y)

  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`关卡: ${gameState.currentLevel + 1}/${GAME_CONFIG.TOTAL_LEVELS}`, 20, windowHeight * 0.06 + GAME_OFFSET_Y)

  ctx.textAlign = 'center'
  ctx.fillText(`剩余时间: ${gameState.timeLeft}s`, windowWidth / 2, windowHeight * 0.06 + GAME_OFFSET_Y)

  // 右侧显示红心生命值（实心=剩余，空心=已失去）
  ctx.fillStyle = '#FF6B6B'
  ctx.textAlign = 'right'
  ctx.fillText(
    '❤'.repeat(Math.max(gameState.lives, 0)) + '♡'.repeat(GAME_CONFIG.MAX_LIVES - Math.max(gameState.lives, 0)),
    windowWidth - 20,
    windowHeight * 0.06 + GAME_OFFSET_Y
  )

  // 第二行：击中次数 + 网格提示
  ctx.fillStyle = '#90EE90'
  ctx.font = '16px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`击中: ${gameState.hitCount}`, 20, windowHeight * 0.11 + GAME_OFFSET_Y)
  ctx.textAlign = 'center'
  ctx.fillText(`${gameState.gridSize}×${gameState.gridSize}网格 | 打地鼠揭示图片，猜猜是什么！`, windowWidth / 2, windowHeight * 0.11 + GAME_OFFSET_Y)
}

/** 绘制底部选项按钮 */
function drawOptions() {
  const optionHeight = windowHeight * 0.08
  const optionWidth = (windowWidth - 40) / 2
  const startY = windowHeight * 0.75 + GAME_OFFSET_Y

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
  ctx.fillText('共10个关卡，3颗红心生命值！', windowWidth / 2, windowHeight * 0.72)

  // 历史最佳成绩
  if (gameState.bestScore > 0) {
    ctx.fillStyle = '#90EE90'
    ctx.fillText(`🏆 历史最佳: ${gameState.bestScore} 分`, windowWidth / 2, windowHeight * 0.755)
  }

  // 好友排行榜按钮
  const rankingBtnGradient = ctx.createLinearGradient(
    rankingBtnArea.x, rankingBtnArea.y,
    rankingBtnArea.x, rankingBtnArea.y + rankingBtnArea.height
  )
  rankingBtnGradient.addColorStop(0, '#FFA500')
  rankingBtnGradient.addColorStop(1, '#FF8C00')
  ctx.fillStyle = rankingBtnGradient
  ctx.fillRect(rankingBtnArea.x, rankingBtnArea.y, rankingBtnArea.width, rankingBtnArea.height)

  ctx.strokeStyle = '#CC7000'
  ctx.lineWidth = 2
  ctx.strokeRect(rankingBtnArea.x, rankingBtnArea.y, rankingBtnArea.width, rankingBtnArea.height)

  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('好友排行榜', windowWidth / 2, rankingBtnArea.y + rankingBtnArea.height / 2 + 7)
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

  // 显示本关得分和累计总积分
  const scoreConfig = getScoreConfig(gameState.currentLevel)
  ctx.fillStyle = '#FFD700'
  ctx.font = '18px Arial'
  ctx.fillText(
    `本关得分: ${gameState.lastLevelScore}（${scoreConfig.name}）  总积分: ${gameState.totalScore}`,
    windowWidth / 2,
    imgY + imgDisplayHeight + windowHeight * 0.16
  )

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

  // 剩余红心生命值
  ctx.fillStyle = '#FF6B6B'
  ctx.font = '28px Arial'
  ctx.fillText('剩余生命: ' + '❤'.repeat(Math.max(gameState.lives, 0)), windowWidth / 2, windowHeight * 0.52)

  ctx.fillStyle = '#90EE90'
  ctx.font = '20px Arial'
  ctx.fillText('点击重新挑战本关', windowWidth / 2, windowHeight * 0.6)
}

/** 绘制游戏结束界面（三个红心全部耗尽） */
function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
  ctx.fillRect(0, 0, windowWidth, windowHeight)

  ctx.fillStyle = '#FF6B6B'
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('💀 Game Over！', windowWidth / 2, windowHeight * 0.3)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '18px Arial'
  ctx.fillText('三个红心已耗尽', windowWidth / 2, windowHeight * 0.38)

  // 最终得分
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 28px Arial'
  ctx.fillText(`最终得分: ${gameState.totalScore}`, windowWidth / 2, windowHeight * 0.5)

  // 个人最好成绩（新纪录时高亮提示）
  if (gameState.isNewRecord) {
    ctx.fillStyle = '#90EE90'
    ctx.font = 'bold 22px Arial'
    ctx.fillText(`🏆 新纪录！个人最好成绩: ${gameState.bestScore}`, windowWidth / 2, windowHeight * 0.58)
  } else {
    ctx.fillStyle = '#90EE90'
    ctx.font = '22px Arial'
    ctx.fillText(`个人最好成绩: ${gameState.bestScore}`, windowWidth / 2, windowHeight * 0.58)
  }

  // "返回游戏"按钮（点击回到游戏初始界面）
  const gameoverBtnGradient = ctx.createLinearGradient(
    gameoverBtnArea.x, gameoverBtnArea.y,
    gameoverBtnArea.x, gameoverBtnArea.y + gameoverBtnArea.height
  )
  gameoverBtnGradient.addColorStop(0, '#4CAF50')
  gameoverBtnGradient.addColorStop(1, '#45a049')
  ctx.fillStyle = gameoverBtnGradient
  ctx.fillRect(gameoverBtnArea.x, gameoverBtnArea.y, gameoverBtnArea.width, gameoverBtnArea.height)

  ctx.strokeStyle = '#2E7D32'
  ctx.lineWidth = 2
  ctx.strokeRect(gameoverBtnArea.x, gameoverBtnArea.y, gameoverBtnArea.width, gameoverBtnArea.height)

  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 20px Arial'
  ctx.fillText('返回游戏', windowWidth / 2, gameoverBtnArea.y + gameoverBtnArea.height / 2 + 7)
}

/** 绘制好友排行榜界面 */
function drawRanking() {
  // 半透明黑色背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)'
  ctx.fillRect(0, 0, windowWidth, windowHeight)

  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 28px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('好友排行榜', windowWidth / 2, windowHeight * 0.07)

  // 绘制开放数据域共享画布内容（好友列表）
  ctx.drawImage(
    sharedCanvas,
    rankingListArea.x, rankingListArea.y,
    rankingListArea.width, rankingListArea.height
  )

  // 返回按钮
  const backBtnGradient = ctx.createLinearGradient(
    backBtnArea.x, backBtnArea.y,
    backBtnArea.x, backBtnArea.y + backBtnArea.height
  )
  backBtnGradient.addColorStop(0, '#4CAF50')
  backBtnGradient.addColorStop(1, '#45a049')
  ctx.fillStyle = backBtnGradient
  ctx.fillRect(backBtnArea.x, backBtnArea.y, backBtnArea.width, backBtnArea.height)

  ctx.strokeStyle = '#2E7D32'
  ctx.lineWidth = 2
  ctx.strokeRect(backBtnArea.x, backBtnArea.y, backBtnArea.width, backBtnArea.height)

  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('返回', windowWidth / 2, backBtnArea.y + backBtnArea.height / 2 + 7)

  // 积分清零机制说明
  ctx.fillStyle = '#999999'
  ctx.font = '13px Arial'
  ctx.fillText('积分每周一 0:00 清零，重新累计排名', windowWidth / 2, backBtnArea.y + backBtnArea.height + 22)
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
  const startY = windowHeight * 0.75 + GAME_OFFSET_Y

  for (let index = 0; index < gameState.shuffledOptions.length; index++) {
    const row = Math.floor(index / 2)
    const col = index % 2
    const optX = 10 + col * (optionWidth + 20)
    const optY = startY + 25 + row * (optionHeight + 10)

    if (x >= optX && x <= optX + optionWidth && y >= optY && y <= optY + optionHeight) {
      if (gameState.shuffledOptions[index] === level.name) {
        gameState.levelComplete = true
        gameState.isPlaying = false

        // 通关成功：增加一个红心，最多3颗
        gameState.lives = Math.min(gameState.lives + 1, GAME_CONFIG.MAX_LIVES)

        // 每周一零点清零：跨周时积分从零重新累计
        const currentWeek = getWeekKey()
        if (currentWeek !== gameState.scoreWeek) {
          gameState.scoreWeek = currentWeek
          gameState.totalScore = 0
        }

        // 计算本关积分：(基础分 + (限时 - 过关用时) × 时间系数) × 难度系数
        const usedTime = GAME_CONFIG.GUESS_TIME - gameState.timeLeft
        gameState.lastLevelScore = calcLevelScore(gameState.currentLevel, usedTime)
        gameState.totalScore += gameState.lastLevelScore

        // 积分变化时实时更新个人最好成绩（本地存储）
        updateBestScore()

        // 上报本周累计总积分给开放数据域（存储在微信服务器），用于好友排行榜
        openDataContext.postMessage({
          type: 'updateScore',
          score: gameState.totalScore
        })
      } else {
        // 猜错：扣除一个红心，红心耗尽则游戏结束
        onLevelFail()
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

  // 排行榜界面：仅响应"返回"按钮
  if (gameState.showRanking) {
    if (touch.clientX >= backBtnArea.x && touch.clientX <= backBtnArea.x + backBtnArea.width &&
        touch.clientY >= backBtnArea.y && touch.clientY <= backBtnArea.y + backBtnArea.height) {
      gameState.showRanking = false
    }
    return
  }

  // 游戏结束界面（红心耗尽）：点击"返回游戏"按钮回到游戏初始界面
  if (gameState.gameFinished) {
    if (touch.clientX >= gameoverBtnArea.x && touch.clientX <= gameoverBtnArea.x + gameoverBtnArea.width &&
        touch.clientY >= gameoverBtnArea.y && touch.clientY <= gameoverBtnArea.y + gameoverBtnArea.height) {
      gameState.gameFinished = false
      gameState.currentLevel = 0
      gameState.usedLevels = []
      gameState.totalScore = 0
      gameState.lastLevelScore = 0
      gameState.lives = GAME_CONFIG.MAX_LIVES
      gameState.isNewRecord = false
      // 标记为非游戏中状态并停留在开始界面，等待玩家手动点击开始
      gameState.isPlaying = false
      gameState.gameOver = false
      gameState.levelComplete = false
    }
    return
  }

  if (!gameState.isPlaying && !gameState.levelComplete && !gameState.gameOver) {
    // 开始界面：点击"好友排行榜"按钮时切换到排行榜界面
    if (touch.clientX >= rankingBtnArea.x && touch.clientX <= rankingBtnArea.x + rankingBtnArea.width &&
        touch.clientY >= rankingBtnArea.y && touch.clientY <= rankingBtnArea.y + rankingBtnArea.height) {
      gameState.showRanking = true
      // 通知开放数据域刷新好友成绩
      openDataContext.postMessage({ type: 'showRanking' })
      return
    }
    startGame()
    return
  }

  if (gameState.levelComplete) {
    if (gameState.currentLevel < GAME_CONFIG.TOTAL_LEVELS - 1) {
      gameState.currentLevel++
      startGame()
    } else {
      // 全部通关，重新开始（积分、红心新一轮重新开始）
      gameState.currentLevel = 0
      gameState.levelComplete = false
      gameState.usedLevels = []
      gameState.totalScore = 0
      gameState.lastLevelScore = 0
      gameState.lives = GAME_CONFIG.MAX_LIVES
      gameState.isNewRecord = false
      startGame()
    }
    return
  }

  if (gameState.gameOver) {
    startGame()
    return
  }

  if (touch.clientY > windowHeight * 0.75 + GAME_OFFSET_Y) {
    checkOption(touch.clientX, touch.clientY)
  } else {
    hitMole(touch.clientX, touch.clientY)
  }
})

// ==================== 游戏控制函数 ====================

/**
 * 更新个人最好成绩（本地存储持久化，跨周保留）
 * 积分超过历史最高时刷新记录并标记新纪录
 */
function updateBestScore() {
  if (gameState.totalScore > gameState.bestScore) {
    gameState.bestScore = gameState.totalScore
    gameState.isNewRecord = true
    wx.setStorageSync(BEST_SCORE_KEY, gameState.bestScore)
  }
}

/**
 * 处理一次关卡失败（猜错图片或倒计时结束）
 * 扣除一个红心：红心未耗尽则进入失败界面重试本关，耗尽则游戏结束
 */
function onLevelFail() {
  gameState.lives--
  gameState.isPlaying = false

  // 清理当前关卡的地鼠状态
  gameState.holes.forEach(h => {
    clearTimeout(h.moleTimer)
    h.hasMole = false
  })

  if (gameState.lives <= 0) {
    // 三个红心全部消失，游戏结束
    gameState.gameFinished = true
    gameState.gameOver = false
    updateBestScore()
  } else {
    gameState.gameOver = true
  }
}

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

      // 随机打乱选项顺序，确保每次显示的顺序都与上一次不同
      let shuffled = shuffleArray(gameState.currentLevelData.options)
      let attempts = 0
      while (attempts < 10 && isSameOrder(shuffled, gameState.lastShuffledOptions)) {
        shuffled = shuffleArray(gameState.currentLevelData.options)
        attempts++
      }
      gameState.shuffledOptions = shuffled
      gameState.lastShuffledOptions = shuffled
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

  // 好友排行榜界面
  if (gameState.showRanking) {
    drawRanking()
    return
  }

  // 游戏结束界面（红心耗尽）
  if (gameState.gameFinished) {
    drawGameOver()
    return
  }

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
        // 倒计时结束：扣除一个红心，红心耗尽则游戏结束
        onLevelFail()
      }
    }
  }

  render()
  requestAnimationFrame(gameLoop)
}

gameLoop()
