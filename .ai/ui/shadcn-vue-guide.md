# shadcn-vue Configuration Guide

## ✅ Setup Complete

shadcn-vue has been successfully configured in your MyAIGuide project!

## 📦 Installed Dependencies

### Production Dependencies

- `radix-vue` (v1.9.17) - Unstyled, accessible components
- `reka-ui` (v2.7.0) - UI primitives
- `class-variance-authority` (v0.7.1) - CVA for component variants
- `clsx` (v2.1.1) - Conditional class names
- `tailwind-merge` (v3.4.0) - Merge Tailwind classes
- `lucide-vue-next` (v0.562.0) - Icon library
- `tailwindcss-animate` (v1.0.7) - Animation utilities

### Dev Dependencies

- `shadcn-vue` (v2.4.3) - CLI tool for adding components

## 🎨 Configuration

### Style

- **Theme**: New York (Recommended)
- **Base Color**: Neutral
- **CSS Variables**: Enabled
- **Icon Library**: Lucide

### File Structure

```
src/
├── components/
│   └── ui/              # shadcn-vue components go here
│       └── button/
│           ├── Button.vue
│           └── index.ts
├── lib/
│   └── utils.ts         # cn() utility function
└── style.css            # Global styles with CSS variables
```

## 🚀 Usage

### Adding New Components

Use the shadcn-vue CLI to add components:

```bash
# Add a single component
npx shadcn-vue@latest add button

# Add multiple components
npx shadcn-vue@latest add card dialog alert

# See all available components
npx shadcn-vue@latest add
```

### Using Components in Your App

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Welcome to MyAIGuide</CardTitle>
    </CardHeader>
    <CardContent>
      <Button @click="handleClick">Get Started</Button>
    </CardContent>
  </Card>
</template>
```

### Using the cn() Utility

The `cn()` function merges Tailwind classes intelligently:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils'

const buttonClass = cn('px-4 py-2', 'bg-blue-500 hover:bg-blue-600', isActive && 'bg-green-500')
</script>
```

## 🎯 Example Component

See `src/components/ShadcnExample.vue` for a working example with different button variants.

## 📚 Available Components

Visit [shadcn-vue.com](https://www.shadcn-vue.com/docs/components/accordion.html) to browse all available components:

- Accordion
- Alert
- Avatar
- Badge
- Button
- Card
- Checkbox
- Dialog
- Input
- Select
- Tabs
- Toast
- And many more...

## 🎨 Theming

### CSS Variables

All theme colors are defined in `src/style.css` using CSS variables. You can customize them:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... more variables */
}
```

### Dark Mode

Dark mode is configured and ready to use. Toggle it by adding the `dark` class to the root element:

```vue
<script setup lang="ts">
import { ref } from 'vue'

const isDark = ref(false)

function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark')
}
</script>
```

## 🔧 Customization

### Tailwind Configuration

The `tailwind.config.js` has been updated with:

- Custom color palette using CSS variables
- Border radius utilities
- Accordion animations
- Container configuration

### Component Customization

All components are copied to your project, so you can:

1. Modify them directly in `src/components/ui/`
2. Add new variants
3. Customize styles
4. Extend functionality

## 📖 Next Steps

1. Browse available components at [shadcn-vue.com](https://www.shadcn-vue.com)
2. Add components you need using `npx shadcn-vue@latest add [component]`
3. Import and use them in your views
4. Customize as needed for your MyAIGuide app

## 🆘 Troubleshooting

If you encounter issues:

1. Make sure all dependencies are installed: `npm install`
2. Check that `components.json` exists in the project root
3. Verify the `@/` alias is working in your imports
4. Run `npm run lint` to check for any TypeScript errors

Happy coding! 🎉
