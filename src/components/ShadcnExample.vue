<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="flex flex-col gap-4 p-8">
    <h2 class="text-2xl font-bold">shadcn-vue Button Examples</h2>

    <div class="flex flex-wrap gap-4">
      <Button>Default Button</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>

    <div class="flex flex-wrap gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">🚀</Button>
    </div>
  </div>
</template>
