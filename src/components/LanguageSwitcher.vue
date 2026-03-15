<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { saveLocale, type SupportedLocale } from '@/plugins/i18n'

const { locale } = useI18n()

function setLocale(lang: SupportedLocale) {
  locale.value = lang
  saveLocale(lang)
}
</script>

<template>
  <div class="flex items-center">
    <Button
      variant="ghost"
      size="sm"
      :class="locale === 'en' ? 'font-bold' : 'font-normal text-muted-foreground'"
      @click="setLocale('en')"
    >
      EN
    </Button>
    <span class="text-muted-foreground">/</span>
    <Button
      variant="ghost"
      size="sm"
      :class="locale === 'pl' ? 'font-bold' : 'font-normal text-muted-foreground'"
      @click="setLocale('pl')"
    >
      PL
    </Button>
  </div>
</template>
