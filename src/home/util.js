
// 获取随机数
/**
 *
 * @param {*} min
 * @param {*} max
 * @param {*} decimal 保留小数个数
 * @returns
 */
export const getRandom = (min, max, decimal = 1) => {
  const value = Math.random() * (max - min) + min
  return value.toFixed(decimal)
}

/**
 * 防抖
 * @param {*} fn 执行方法
 * @param {*} wait 等待时长
 * @param {*} immediately 是否立马执行fn, 否则延迟到最后执行
 */
export const debounce = (fn, wait, immediate) => {
  let timer = null

  return function () {
    const that = this
    const args = arguments

    if (immediate) {
      if (timer) return
      fn.apply(that, args)
      timer = setTimeout(() => {
        clearTimeout(timer)
        timer = null
      }, wait)

      return
    }

    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    timer = setTimeout(function () {
      fn.apply(that, args)
    }, wait)
  }
}
// 随机生成十六进制颜色
export const randomHexColor = () => {
  return '#' + ('00000' + (Math.random() * 0x1000000 << 0).toString(16)).substr(-6)
}

export const LOCK_BODY_KEY = 'scroll-lock'
const INTERNAL_LOCK_KEY = 'data-scroll-lock'

export const isLocked = !!document.body.getAttribute(LOCK_BODY_KEY)

export const unLockScroll = () => {
  console.log('unLockScroll==')
  const str = document.body.getAttribute(INTERNAL_LOCK_KEY)
  if (!str) return

  try {
    const { height, pos, top, left, right, scrollY } = JSON.parse(str)
    document.documentElement.style.height = height

    const bodyStyle = document.body.style
    bodyStyle.position = pos
    bodyStyle.top = top
    bodyStyle.left = left
    bodyStyle.right = right
    window.scrollTo(0, scrollY)
    setTimeout(() => {
      document.body.removeAttribute(LOCK_BODY_KEY)
      document.body.removeAttribute(INTERNAL_LOCK_KEY)
    }, 30)
  } catch (e) {}
}

export const lockScroll = () => {
  console.log('lockScroll==')
  if (isLocked) return unLockScroll

  const htmlStyle = document.documentElement.style
  const bodyStyle = document.body.style
  const scrollY = window.scrollY

  const height = htmlStyle.height
  const pos = bodyStyle.position
  const top = bodyStyle.top
  const left = bodyStyle.left
  const right = bodyStyle.right

  bodyStyle.position = 'fixed'
  bodyStyle.top = -scrollY + 'px'
  bodyStyle.left = '0'
  bodyStyle.right = '0'
  htmlStyle.height = '100%'
  document.body.setAttribute(LOCK_BODY_KEY, scrollY + '')
  document.body.setAttribute(INTERNAL_LOCK_KEY, JSON.stringify({
    height, pos, top, left, right, scrollY
  }))
  return unLockScroll
}
