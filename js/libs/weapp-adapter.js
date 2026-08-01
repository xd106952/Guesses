var window = window || {}

if (!window.canvas) {
  window.canvas = {}
}

if (!window.WebGLRenderingContext) {
  window.WebGLRenderingContext = function() {}
}

if (!window.addEventListener) {
  window.addEventListener = function() {}
}

if (!window.removeEventListener) {
  window.removeEventListener = function() {}
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = function(callback) {
    return setTimeout(callback, 16)
  }
}

if (!wx.createOffscreenCanvas) {
  wx.createOffscreenCanvas = function(width, height) {
    const canvas = wx.createCanvas()
    canvas.width = width
    canvas.height = height
    return canvas
  }
}

if (!window.AudioContext) {
  window.AudioContext = function() {
    return {
      createGain: function() {
        return { gain: { value: 1 }, connect: function() {} }
      },
      createOscillator: function() {
        return {
          type: 'sine',
          frequency: { value: 440 },
          connect: function() {},
          start: function() {},
          stop: function() {}
        }
      },
      destination: {},
      start: function() {}
    }
  }
}
