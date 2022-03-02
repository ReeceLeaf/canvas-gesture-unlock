<template>
  <div id="app">
    <Home />
  </div>
</template>

<script>
import Home from './home/index.vue'

export default {
  name: 'App',
  components: {
    Home
  }
}
</script>

<style lang="scss">
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border-radius: none;
}
</style>
