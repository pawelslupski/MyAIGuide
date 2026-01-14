<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-4xl font-bold text-blue-600">{{ msg }}</h1>

    <div class="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-8 shadow-xl">
      <button
        type="button"
        class="rounded-lg bg-white px-6 py-3 font-semibold text-purple-600 shadow-md transition-colors duration-200 hover:bg-gray-100"
        @click="count++"
      >
        count is {{ count }}
      </button>
      <p class="mt-4 text-white">
        Edit
        <code class="rounded bg-black/20 px-2 py-1">components/HelloWorld.vue</code> to test HMR
      </p>
    </div>

    <div class="space-y-4 text-gray-700">
      <p class="flex items-center gap-2">
        Check out
        <a
          href="https://vuejs.org/guide/quick-start.html#local"
          target="_blank"
          class="font-medium text-blue-500 underline hover:text-blue-700"
        >
          create-vue </a
        >, the official Vue + Vite starter
      </p>
      <p>
        Learn more about IDE Support for Vue in the
        <a
          href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
          target="_blank"
          class="font-medium text-blue-500 underline hover:text-blue-700"
        >
          Vue Docs Scaling up Guide </a
        >.
      </p>
      <p class="text-sm text-gray-500">Click on the Vite and Vue logos to learn more</p>
    </div>

    <!-- Tailwind Test Section -->
    <div class="mt-8 rounded-lg border-2 border-green-500 bg-green-50 p-6">
      <h2 class="mb-4 text-2xl font-bold text-green-700">✅ Tailwind CSS Test</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded bg-red-100 p-4">Red Box</div>
        <div class="rounded bg-yellow-100 p-4">Yellow Box</div>
        <div class="rounded bg-blue-100 p-4">Blue Box</div>
      </div>
      <p class="mt-4 text-sm text-green-600">
        If you see styled boxes above, Tailwind is working! 🎉
      </p>
    </div>
  </div>
</template>
