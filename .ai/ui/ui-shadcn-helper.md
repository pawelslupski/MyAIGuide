# shadcn-vue Components

Ten projekt wykorzystuje **shadcn-vue** dla komponentów interfejsu użytkownika. Są to pięknie zaprojektowane, dostępne komponenty oparte na Vue 3 i Composition API, które można dostosować do swojej aplikacji.

## Odszukiwanie zainstalowanych komponentów

Komponenty są dostępne w folderze `src/components/ui`, zgodnie z aliasami z pliku `components.json`

Każdy komponent znajduje się w osobnym podfolderze, np.:

- `src/components/ui/button/Button.vue`
- `src/components/ui/card/Card.vue`

## Wykorzystanie komponentu

Zaimportuj komponent zgodnie ze skonfigurowanym aliasem `@/` w składni Vue 3 Composition API:

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
</script>
```

Przykładowe wykorzystanie komponentów w template:

```vue
<template>
  <div>
    <Button variant="outline">Click me</Button>

    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
      <CardFooter>
        <p>Card Footer</p>
      </CardFooter>
    </Card>
  </div>
</template>
```

## Instalowanie dodatkowych komponentów

Wiele innych komponentów jest dostępnych, ale nie są one obecnie zainstalowane. Pełną listę można znaleźć na stronie https://www.shadcn-vue.com/docs/components/accordion.html

Aby zainstalować nowy komponent, wykorzystaj shadcn-vue CLI:

```bash
npx shadcn-vue@latest add [component-name]
```

Przykładowo, aby dodać komponent accordion:

```bash
npx shadcn-vue@latest add accordion
```

Aby dodać wiele komponentów jednocześnie:

```bash
npx shadcn-vue@latest add card dialog alert
```

**Ważne:** Używaj `npx shadcn-vue@latest` do dodawania komponentów

Niektóre popularne komponenty dostępne w shadcn-vue:

- **Accordion** - rozwijane sekcje
- **Alert** - komunikaty i powiadomienia
- **Alert Dialog** - modalne okna dialogowe
- **Avatar** - awatary użytkowników
- **Badge** - etykiety i znaczniki
- **Button** - przyciski (już zainstalowany)
- **Card** - karty z zawartością
- **Checkbox** - pola wyboru
- **Dialog** - okna dialogowe
- **Input** - pola tekstowe
- **Select** - listy rozwijane
- **Separator** - separatory
- **Skeleton** - placeholdery ładowania
- **Switch** - przełączniki
- **Table** - tabele danych
- **Tabs** - zakładki
- **Textarea** - wieloliniowe pola tekstowe
- **Toast** - powiadomienia toast
- **Tooltip** - podpowiedzi

Pełna lista: https://www.shadcn-vue.com/docs/components/accordion.html

## Konfiguracja i stylowanie

### Wariant stylu

Ten projekt wykorzystuje wariant stylu **"new-york"** z kolorem bazowym **"neutral"** i zmiennymi CSS do tworzenia motywów, zgodnie z konfiguracją w `components.json`.

### Zmienne CSS

Wszystkie kolory motywu są zdefiniowane w `src/style.css` za pomocą zmiennych CSS:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  /* ... więcej zmiennych */
}
```

### Biblioteka ikon

Projekt używa **lucide-vue-next** jako biblioteki ikon. Importuj ikony w następujący sposób:

```vue
<script setup lang="ts">
import { ChevronRight, User, Settings } from 'lucide-vue-next'
</script>

<template>
  <Button>
    <User class="mr-2 h-4 w-4" />
    Profil
  </Button>
</template>
```

## Utility funkcja cn()

Projekt zawiera funkcję pomocniczą `cn()` w `src/lib/utils.ts` do inteligentnego łączenia klas Tailwind:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils'

const isActive = ref(true)

const buttonClass = cn(
  'px-4 py-2',
  'bg-blue-500 hover:bg-blue-600',
  isActive.value && 'bg-green-500'
)
</script>
```

## Warianty komponentów

Komponenty shadcn-vue używają **class-variance-authority (CVA)** do definiowania wariantów. Przykład z Button:

```vue
<template>
  <Button variant="default">Default</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="destructive">Destructive</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="link">Link</Button>

  <Button size="sm">Small</Button>
  <Button size="default">Default</Button>
  <Button size="lg">Large</Button>
  <Button size="icon">🚀</Button>
</template>
```

## Dostosowywanie komponentów

Wszystkie komponenty są kopiowane do projektu, więc możesz:

1. Modyfikować je bezpośrednio w `src/components/ui/`
2. Dodawać nowe warianty w definicjach CVA
3. Dostosowywać style
4. Rozszerzać funkcjonalność

## Przykład użycia

Zobacz `src/components/ShadcnExample.vue` dla działającego przykładu z różnymi wariantami przycisków.

## Wsparcie TypeScript

Wszystkie komponenty mają pełne wsparcie TypeScript z typowanymi props i emits:

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { ButtonVariants } from '@/components/ui/button'

// Props są w pełni typowane
const variant: ButtonVariants['variant'] = 'outline'
</script>
```

## Podstawowe komponenty (reka-ui i radix-vue)

shadcn-vue jest zbudowany na bazie **reka-ui** i **radix-vue**, które dostarczają niestyilizowane, dostępne komponenty bazowe. Komponenty shadcn-vue dodają do nich piękne style i warianty.

## Responsywność i dark mode

### Responsywność

Używaj wariantów responsywnych Tailwind:

```vue
<template>
  <Button class="w-full md:w-auto"> Responsywny przycisk </Button>
</template>
```

### Dark mode

Projekt posiada pełne wsparcie dla dark mode z automatycznym przełączaniem i persystencją w localStorage.

#### Użycie composable useTheme

```vue
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { themeMode, resolvedTheme, setTheme, toggleTheme } = useTheme()

// Przełącz między light/dark
function handleToggle() {
  toggleTheme()
}

// Ustaw konkretny motyw
function setLightMode() {
  setTheme('light')
}

function setDarkMode() {
  setTheme('dark')
}

// Użyj preferencji systemowych
function useSystemTheme() {
  setTheme('system')
}
</script>

<template>
  <div>
    <p>Aktualny motyw: {{ resolvedTheme }}</p>
    <p>Tryb użytkownika: {{ themeMode }}</p>
    <Button @click="toggleTheme">Przełącz motyw</Button>
  </div>
</template>
```

#### Komponent ThemeToggle

Gotowy komponent do przełączania motywu:

```vue
<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header class="flex items-center justify-between p-4">
    <h1>MyAIGuide</h1>
    <ThemeToggle />
  </header>
</template>
```

#### Używanie zmiennych CSS

Wszystkie komponenty shadcn-vue automatycznie dostosowują się do dark mode poprzez zmienne CSS:

```vue
<template>
  <!-- Automatycznie zmienia kolor w dark mode -->
  <div class="bg-background text-foreground">
    <Card class="bg-card text-card-foreground">
      <h2 class="text-primary">Tytuł</h2>
      <p class="text-muted-foreground">Opis</p>
    </Card>
  </div>
</template>
```

#### Wariant dark: dla niestandardowych stylów

Jeśli potrzebujesz specyficznych stylów dla dark mode, użyj wariantu `dark:`:

```vue
<template>
  <div class="border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <h1 class="text-gray-900 dark:text-gray-100">Tytuł</h1>
    <p class="text-gray-600 dark:text-gray-400">Tekst</p>
  </div>
</template>
```

#### Najlepsze praktyki dla dark mode

1. **Używaj zmiennych CSS** zamiast hardcodowanych kolorów:
   - ✅ `bg-background` zamiast `bg-white`
   - ✅ `text-foreground` zamiast `text-black`
   - ✅ `border-border` zamiast `border-gray-200`

2. **Testuj oba motywy** podczas developmentu

3. **Sprawdź kontrast** - upewnij się, że tekst jest czytelny w obu motywach (WCAG AA: 4.5:1)

4. **Używaj wariantu `dark:` oszczędnie** - większość przypadków obsługują zmienne CSS

5. **Inicjalizuj motyw w App.vue** - patrz sekcja "Inicjalizacja" poniżej

#### Inicjalizacja dark mode

W `App.vue` zainicjalizuj motyw przy montowaniu aplikacji:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme() // Wczytuje motyw z localStorage lub używa preferencji systemowych
})
</script>
```

## Najlepsze praktyki

1. **Zawsze używaj aliasu `@/`** do importowania komponentów
2. **Wykorzystuj warianty** zamiast nadpisywać style bezpośrednio
3. **Używaj funkcji `cn()`** do łączenia klas Tailwind
4. **Typuj props** używając TypeScript dla lepszej kontroli typów
5. **Sprawdź dokumentację** na https://www.shadcn-vue.com przed dodaniem nowego komponentu
6. **Testuj dostępność** - komponenty są dostępne out-of-the-box, ale upewnij się, że Twoje użycie również jest dostępne
7. **Używaj zmiennych CSS dla kolorów** - zapewnia automatyczne wsparcie dla dark mode
8. **Testuj w obu motywach** - light i dark mode powinny być równie czytelne i estetyczne
