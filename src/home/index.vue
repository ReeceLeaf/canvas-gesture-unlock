<template>
  <div class="home">
    <Background />
    <div class="starMap" ref="starMap">
      <canvas
        id="starMap"
        ref="canvas"
        class="canvasBox"
        :width="width"
        :height="height"
        :style="{ width, height }"
        @touchstart="touchStart"
        @touchmove="touchMove"
        @touchend="touchEnd"
        @mousedown="touchStart"
        @mousemove="touchMove"
        @mouseup="touchEnd"
        @mouseout="touchEnd"
        @mouseenter="touchStart"
      ></canvas>
      <div class="starsList">
        <div v-for="n in starXNum" :key="n" class="starColBox" :style="{ marginBottom: `${spaceY}px` }">
          <div v-for="j in starYNum" :key="j" class="starRow" :style="{ marginRight: `${spaceX}px` }">
            <div :class="['starIcon', showStar(n, j) && 'show']" :style="{ width: `${starX}px`, height: `${starX}px` }">
              <div :class="['starCenter', isSelectedStar(n, j) && `animate-${getRandom(0, 2, 0)}`]"></div>
            </div>
          </div>
        </div>
      </div>
      <canvas id="judgeCanvas" :width="width" :height="height" class="judgeCanvas" :style="{ width, height }"></canvas>
    </div>
  </div>
</template>

<script>
import { debounce, getRandom, lockScroll } from './util'
import Background from './components/background.vue'

export default {
  name: 'Home',
  components: {
    Background
  },
  props: {
  },
  data () {
    return {
      starXNum: 5,
      starYNum: 5,
      minLength: 5,
      maxLength: 5 * 5,
      canvas: null,
      circleSizeRatio: 0.1, // 圆圈直径/画布比例
      circleHollowRatio: 0.5, // 圆圈内部镂空直径/圆圈半径
      circleLineWidthRatio: 0.1, // 圆圈边框线宽/圆圈半径
      lineWidthRatio: 1, //  画笔线宽/圆圈内部镂空半径
      color: 'RoyalBlue', // 线条颜色
      numRow: 3, // 行数
      numColumn: 5, // 列数
      pointPos: [], // 圆圈的坐标数组(x,y)
      points: [], // 已经选中的圈编号(i)
      // isDownOnPoint: false, // 起始按下是否在某个圆圈的范围
      lineWidth: 1,
      doublePI: 2 * Math.PI,
      lineBlurWidth: 13,
      ctx: null,
      starLen: 0,
      reconnectStart: false,
      pointIndexArr: [],
      canvasRect: {
        x: 0,
        y: 0
      },
      unlock: null,
      judgeCtx: null // canvas测试两点之间连线没有触摸到的点，不做展示
    }
  },
  computed: {
    canUnlock () {
      return this.pointsLen >= 5 && this.pointsLen <= 10
    },
    width () {
      return 286
    },
    height () {
      return 286
    },
    starX () {
      return 19
    },
    spaceX () { // 星星横向间距
      return (this.width - this.starX * this.starXNum) / 4
    },
    spaceY () { // 星星竖向间距
      return (this.height - this.starX * this.starYNum) / 4
    },
    pointsLen () {
      return this.points.length
    }
  },
  mounted () {
    this.$nextTick(() => {
      this.init()
    })
  },
  methods: {
    getRandom,
    init () {
      this.setData()
      this.draw()
    },

    initStarPos () { // 初始化星星位置
      const arr = this.pointIndexArr = this.initPointShowArr()
      const pointPos = []
      /**
       * 星星中点x位置: 星星/2 + 前几颗(星星的尺寸 + 横向间距）
       * 星星中点y位置: 星星/2 + 前几颗(星星的尺寸 + 竖向间距）
       */
      arr.forEach(item => {
        let x = 0
        let y = 0
        x = this.starX / 2 + (this.starX + this.spaceX) * (item % this.starXNum)
        y = this.starX / 2 + (this.starX + this.spaceY) * Math.floor(item / this.starXNum)

        pointPos.push({ x, y, index: item })
      })
      this.pointPos = [...pointPos]
    },

    setData () {
      this.initStarPos()
      this.lineWidth = 2
      this.lineBlurWidth = 6
      this.canvas = document.getElementById('starMap')
      if (!this.canvas) return console.error('starMap: this.canvas is null')
      this.ctx = this.canvas.getContext('2d')
      this.ctx.strokeStyle = '#c9b8ff'
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'bevel'

      const judgeCanvas = document.getElementById('judgeCanvas')
      this.judgeCtx = judgeCanvas.getContext('2d')
    },
    draw (x, y) {
      if (!this.canvas) return
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

      if (this.pointsLen === 0) return
      this.rearrangePoints(x, y)

      console.log('3')
      this.drawLine(x, y)
    },
    /**
       * 两点连线中有手指未触摸到的点，但是在线上的情况，
       * 1. 判断是否有多余的点
       * 2. 判断方向
       *  a.竖线： x1 = x2
       *   - 从上到下： y1 < y2
       *   - 从下到上： y1 > y2
       *  b.横线：y1 = y2
       *   - 从左到右：x1 < x2
       *   - 从右到左：x1 > x2
       *  c.斜线(\)
       *   - 从上到下：x1 < x2  y1 < y2
       *   - 从下到上：x1 > x2  y1 > y2
       *  d.斜线(/)
       *   - 从上到下：x1 > x2  y1 < y2
       *   - 从下到上：x1 < x2 y1 > y2
       * 3. 给点数组重新排序
       * 4. 与points合并
       * 5. 长度超出最大限制个则从末尾抛出
       * 6. 清空画布重新绘制
       */
    rearrangePoints () { // 根据最后两个点之间连线，如果有多出的点进行重排，否则不处理
      if (this.pointsLen === 1) return
      const endPrevPos = this.getPointPos(this.pointsLen - 2)
      const endPos = this.getPointPos(this.pointsLen - 1)

      const x1 = endPrevPos.x
      const y1 = endPrevPos.y
      const x2 = endPos.x
      const y2 = endPos.y

      this.judgeCtx.beginPath()
      this.judgeCtx.moveTo(x1, y1) // 开始位置
      this.judgeCtx.lineTo(x2, y2) // 画到此处

      const extraArr = []
      const realArr = []
      this.pointPos.forEach((item, i) => {
        if (this.judgeCtx.isPointInStroke(item.x, item.y)) realArr.push(i)
        if (this.judgeCtx.isPointInStroke(item.x, item.y) && !this.points.includes(i)) {
          extraArr.push(i)
        }
      })

      if (!extraArr.length) return
      const extraPosArr = extraArr.map(item => {
        return { ...this.pointPos[item], i: item }
      })

      const getExtraSortMap = new Map([
        [[0, -1], (a, b) => a.y - b.y],
        [[0, 1], (a, b) => b.y - a.y],
        [[-1, 0], (a, b) => a.x - b.x],
        [[1, 0], (a, b) => b.x - a.x],
        [[-1, -1], (a, b) => (a.x - b.x) && (a.y - b.y)],
        [[1, 1], (a, b) => (b.x - a.x) && (b.y - a.y)],
        [[1, -1], (a, b) => (b.x - a.x) && (a.y - b.y)],
        [[-1, 1], (a, b) => (a.x - b.x) && (b.y - a.y)]
      ])

      const extraSortArr = extraPosArr.sort(getExtraSortMap.get([this.getEqualVal(x1, x2), this.getEqualVal(y1, y2)]))

      this.points.splice(this.pointsLen - 1, 0, ...(extraSortArr.map(item => item.i)))
      this.pointsLen > this.maxLength && this.points.splice(this.maxLength, this.pointsLen - this.maxLength)
    },

    getEqualVal (a, b) {
      return a - b === 0 ? 0 : a - b > 0 ? 1 : -1
    },

    getPointPos (i) {
      return this.pointPos[this.points[i]]
    },
    drawLine (x, y) {
      this.ctx.lineWidth = this.lineWidth
      const startPos = this.getPointPos(0)
      const endPos = this.getPointPos(this.pointsLen - 1)

      for (let i = 1; i < this.pointsLen; i++) {
        const movePos = i === 1 ? startPos : this.getPointPos(i - 1)
        this.drawradientLine(movePos.x, movePos.y, this.getPointPos(i).x, this.getPointPos(i).y, true)
      }

      if (x !== undefined && y !== undefined) {
        this.drawradientLine(endPos.x, endPos.y, x, y, false)
      } else {
        this.ctx.stroke()
      }
    },

    drawradientLine (x1, y1, x2, y2, closePath) { // 渐变线条
      if (!this.ctx) return
      this.ctx.beginPath() // 开始路径，如果没有这个和结束路径包围，所有线条都是最后那根线条的样式了
      this.ctx.moveTo(x1, y1) // 开始位置
      this.ctx.lineTo(x2, y2) // 画到此处

      const grd = this.ctx.createLinearGradient(x1, y1, x2, y2) // 线性渐变的起止坐标
      grd.addColorStop(0, '#c9b8ff')
      grd.addColorStop(1, '#aa4fff')
      this.ctx.strokeStyle = grd

      this.ctx.shadowBlur = this.lineBlurWidth
      this.ctx.shadowColor = '#5a00ff'

      closePath && this.ctx.closePath() // 结束路径，应与开始路径呼应(会不会导致内存泄露跟实现有关系)
      this.ctx.stroke()
    },

    indexOfPoint (x, y) {
      if (this.pointPos.length === 0) throw new Error('未找到星星坐标')
      // 为了减少计算量，将星星当初正方形计算
      for (let i = 0; i < this.pointPos.length; i++) {
        if ((Math.abs(x - this.pointPos[i].x) < this.starX / 1.5) && (Math.abs(y - this.pointPos[i].y) < this.starX / 1.5)) {
          return i
        }
      }

      return -1
    },

    getEventPos (event) {
      const x = event.clientX || event.touches[0].clientX
      const y = event.clientY || event.touches[0].clientY
      return [x - this.canvasRect.x, y - this.canvasRect.y]
    },
    pushToPoints (index) {
      if (index === -1 || this.points.includes(index)) return false

      this.points.push(index)

      return true
    },
    /**
     * 重连时只能从最后一个开始或第一个开始
    */
    touchStart (e) {
      console.log('touchStart', e)
      if (this.checkLimit()) return
      this.lockScroll()
      const rect = this.$refs.canvas.getBoundingClientRect() // 此处获取canvas位置，防止页面滚动时位置发生变化
      this.canvasRect = { x: rect.left, y: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }
      const [x, y] = this.getEventPos(e)

      const index = this.indexOfPoint(x, y)
      if (this.pointsLen) {
        this.reconnectStart = true
      } else {
        this.pushToPoints(index)
      }
    },
    touchMove (e) {
      console.log('touchMove', e)
      if (this.checkBeyondCanvas(e)) return // 防止touchmove移出canvas区域后不松手，滚动后页面位置改变在canvas外其他位置触发连接
      if (this.checkLimit()) return
      this.lockScroll() // 手指活动过程中禁止页面滚动
      const [x, y] = this.getEventPos(e)

      const idx = this.indexOfPoint(x, y)
      if (this.reconnectStart && (idx === this.points[this.pointsLen - 1] || idx !== this.points[0])) {
        this.reconnectStart = false

        idx === this.points[0] && this.points.reverse()
      }
      this.pushToPoints(idx)

      this.draw(x, y)
    },

    touchEnd (e) {
      console.log('touchEnd', e)
      this.connectEnd()
    },
    checkBeyondCanvas (e) { // 校验手指是否超出canvas区域
      const x = e.clientX || e.touches[0].clientX
      const y = e.clientY || e.touches[0].clientY
      const { left, top, right, bottom } = this.canvasRect
      const outDistance = 40
      if (x < left - outDistance || x > right + outDistance || y < top - outDistance || y > bottom + outDistance) {
        this.connectEnd()
        return true
      }
      return false
    },
    checkLimit () {
      if (this.pointsLen >= this.maxLength) { // 这里设置星星可链接的最大数量
        !this.reconnectStart && this.showToast(`最多连接${this.maxLength}个点哦～`)
        this.connectEnd()
        return true
      }
      return false
    },
    connectEnd () {
      this.unlockScroll()
      if (this.pointsLen === 1) {
        this.points = []
      }
      this.draw()

      if (this.pointsLen > 1 && this.pointsLen < this.minLength && !this.reconnectStart) {
        this.showToast(`至少连接${this.minLength}颗星星哦～`)
      }
    },
    initPointShowArr () {
      const result = []
      const originArr = []
      const arrLen = getRandom(25, this.starXNum * this.starYNum, 0) // 初始化时随机显示星星最大最小数量 getRandom(21, 25, 0)
      // const arrLen = getRandom(10, 15, 0)
      const starOriginLen = this.starXNum * this.starYNum
      for (let i = 0; i < starOriginLen; i++) {
        originArr.push(i)
      }

      for (let i = 0; i < arrLen; i++) {
        const random = Math.floor(Math.random() * originArr.length)
        if (result.includes(originArr[random])) {
          continue
        }
        result.push(originArr[random])
        originArr.splice(random, 1)
      }
      result.sort((a, b) => a - b)
      return result
    },
    showStar (n, j) {
      return this.pointIndexArr.includes((j - 1) + (n - 1) * 5)
    },
    isSelectedStar (n, j) {
      return this.points.includes((j - 1) + (n - 1) * 5)
    },
    lockScroll () {
      if (this.unlock) return
      this.unlock = lockScroll()
    },
    unlockScroll () {
      if (this.unlock) {
        this.unlock()
        this.unlock = null
      }
    },
    showToast: debounce(function (msg) {
      console.log(msg)
    }, 5000, true)
  }
}
</script>

<style scoped lang="scss">
@import './index.scss'
</style>
