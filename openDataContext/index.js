/**
 * 好友排行榜 - 开放数据域
 *
 * 独立于主域运行，拥有独立的作用域，无法访问主域代码和数据。
 * 职责：
 * 1. 接收主域消息（展示排行榜 / 上报成绩）
 * 2. 通过 wx.getFriendCloudStorage 拉取好友的通关成绩
 * 3. 将好友排行榜绘制到 sharedCanvas，由主域 drawImage 展示
 */

/** 开放数据域共享画布 */
const sharedCanvas = wx.getSharedCanvas()
/** 共享画布绘图上下文 */
const context = sharedCanvas.getContext('2d')

/**
 * 成绩存储键名前缀
 * 完整键名为 前缀 + 周标识（如 totalScore_2026W38），
 * 每周一零点后周标识变化，自动启用新键从零开始积分，
 * 等效于每周清零。积分数据通过 setUserCloudStorage 存储在微信服务器。
 */
const SCORE_KEY_PREFIX = 'totalScore_'

/**
 * 获取当前时间对应的周标识（ISO周，周一为每周起点）
 * 例如 2026-09-17（周四）返回 "2026W38"
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

/** 当前周的积分存储键名，每周一零点自动切换为新键（等效清零） */
const SCORE_KEY = SCORE_KEY_PREFIX + getWeekKey()

/** 好友数据列表（按成绩降序排列） */
let friendData = []

/** 头像图片缓存，key 为头像 URL */
const avatarCache = {}

// 注意：sharedCanvas 的宽高只能在主域设置（开放数据域中设置无效），
// 开放数据域绘制时直接读取主域已设置好的 sharedCanvas.width/height

/**
 * 异步加载好友头像
 * 加载完成后缓存图片并触发列表重绘
 * @param {Object} user - 好友数据对象
 */
function loadAvatar(user) {
  if (avatarCache[user.avatarUrl]) {
    user.avatarImg = avatarCache[user.avatarUrl]
    return
  }
  if (user.avatarLoading) return
  user.avatarLoading = true

  const img = wx.createImage()
  img.onload = function() {
    avatarCache[user.avatarUrl] = img
    user.avatarImg = img
    renderList()
  }
  img.onerror = function() {
    user.avatarLoading = false
  }
  img.src = user.avatarUrl
}

/**
 * 绘制好友排行榜列表到 sharedCanvas
 */
function renderList() {
  const W = sharedCanvas.width
  const H = sharedCanvas.height

  context.clearRect(0, 0, W, H)
  context.textBaseline = 'middle'

  // 列表背景
  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.fillRect(0, 0, W, H)

  if (friendData.length === 0) {
    context.fillStyle = '#CCCCCC'
    context.font = '16px Arial'
    context.textAlign = 'center'
    context.fillText('暂无成绩，先通关一关试试吧', W / 2, H / 2)
    return
  }

  const rowH = Math.min(70, Math.floor(H / 8))
  const count = Math.min(friendData.length, Math.floor((H - 20) / rowH))

  for (let i = 0; i < count; i++) {
    const user = friendData[i]
    const rowY = 10 + i * rowH
    const centerY = rowY + rowH / 2

    // 前三名高亮行背景
    if (i < 3) {
      context.fillStyle = 'rgba(255, 215, 0, 0.15)'
      context.fillRect(4, rowY, W - 8, rowH)
    }

    // 排名（前三名金色）
    context.fillStyle = i < 3 ? '#FFD700' : '#CCCCCC'
    context.font = 'bold 18px Arial'
    context.textAlign = 'left'
    context.fillText(String(i + 1), 14, centerY)

    // 头像
    if (user.avatarUrl) {
      loadAvatar(user)
    }
    if (user.avatarImg) {
      context.save()
      context.beginPath()
      context.arc(64, centerY, 18, 0, Math.PI * 2)
      context.clip()
      context.drawImage(user.avatarImg, 46, centerY - 18, 36, 36)
      context.restore()
    } else {
      // 头像加载中的占位圆
      context.fillStyle = 'rgba(255, 255, 255, 0.2)'
      context.beginPath()
      context.arc(64, centerY, 18, 0, Math.PI * 2)
      context.fill()
    }

    // 昵称（超长截断，自己加标记并金色高亮）
    context.fillStyle = user.isSelf ? '#FFD700' : '#FFFFFF'
    context.font = user.isSelf ? 'bold 16px Arial' : '16px Arial'
    context.textAlign = 'left'
    let nickname = user.nickname.length > 8 ? user.nickname.slice(0, 8) + '…' : user.nickname
    if (user.isSelf) nickname += '（我）'
    context.fillText(nickname, 92, centerY)

    // 成绩
    context.fillStyle = '#90EE90'
    context.font = 'bold 16px Arial'
    context.textAlign = 'right'
    context.fillText('积分 ' + user.score, W - 14, centerY)
  }
}

/**
 * 将好友数据解析为统一的用户列表
 * @param {Array} data - 云存储接口返回的用户数据
 * @returns {Array} 解析后的用户列表
 */
function parseUsers(data) {
  return data.map(function(u) {
    let score = 0
    if (u.KVDataList && u.KVDataList.length) {
      score = parseInt(u.KVDataList[0].value, 10) || 0
    }
    return {
      nickname: u.nickname || '玩家',
      avatarUrl: u.avatarUrl,
      score: score,
      isSelf: false
    }
  })
}

/**
 * 将玩家自己的成绩加入排行榜
 * getFriendCloudStorage 只返回玩过游戏的好友且不包含玩家自己，
 * 需通过 getUserCloudStorage + getUserInfo 单独获取自己的数据合并显示
 */
function addSelfToList() {
  wx.getUserCloudStorage({
    keyList: [SCORE_KEY],
    success: function(res) {
      let score = 0
      if (res.KVDataList && res.KVDataList.length) {
        score = parseInt(res.KVDataList[0].value, 10) || 0
      }
      // 自己还没有任何积分记录时不显示
      if (score <= 0) {
        sortAndRender()
        return
      }

      // 获取自己的昵称和头像
      wx.getUserInfo({
        openIdList: ['selfOpenId'],
        lang: 'zh_CN',
        success: function(infoRes) {
          const self = infoRes.data && infoRes.data[0]
          friendData.push({
            nickname: (self && self.nickName) || '我',
            avatarUrl: (self && self.avatarUrl) || '',
            score: score,
            isSelf: true
          })
          sortAndRender()
        },
        fail: function() {
          friendData.push({
            nickname: '我',
            avatarUrl: '',
            score: score,
            isSelf: true
          })
          sortAndRender()
        }
      })
    },
    fail: function() {
      sortAndRender()
    }
  })
}

/** 按积分降序排序并渲染列表 */
function sortAndRender() {
  friendData.sort(function(a, b) { return b.score - a.score })
  renderList()
}

/**
 * 拉取好友本周的累计总积分并排序渲染
 * keyList 只包含当前周键名，上周积分自动不再计入
 */
function fetchFriends() {
  wx.getFriendCloudStorage({
    keyList: [SCORE_KEY],
    success: function(res) {
      friendData = parseUsers(res.data)
      addSelfToList()
    },
    fail: function() {
      friendData = []
      addSelfToList()
    }
  })
}

/**
 * 保存用户本周累计总积分到微信服务器（只保留本周最高值）
 * @param {number} score - 本轮累计总积分
 */
function saveScore(score) {
  /** 写入云存储 */
  function writeScore() {
    wx.setUserCloudStorage({
      KVDataList: [{ key: SCORE_KEY, value: String(score) }],
      success: function() {
        fetchFriends()
      },
      fail: function(err) {
        console.error('setUserCloudStorage 失败', err)
      }
    })
  }

  wx.getUserCloudStorage({
    keyList: [SCORE_KEY],
    success: function(res) {
      let oldScore = 0
      if (res.KVDataList && res.KVDataList.length) {
        oldScore = parseInt(res.KVDataList[0].value, 10) || 0
      }
      // 非最高积分不更新
      if (score <= oldScore) return
      writeScore()
    },
    fail: function() {
      // key 不存在（首次上报）等情况下读取失败，直接写入
      writeScore()
    }
  })
}

// 监听主域消息
wx.onMessage(function(data) {
  if (data.type === 'showRanking') {
    fetchFriends()
  } else if (data.type === 'updateScore') {
    saveScore(data.score)
  }
})
