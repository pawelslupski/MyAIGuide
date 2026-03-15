# Tech Stack – MyAIGuide

## Frontend

- **Vue 3.5** – framework SPA, reaktywność, komponenty
- **Vite** – szybki bundler i dev server
- **TypeScript 5** – statyczne typowanie
- **Vue Router** – routing po stronie klienta
- **Pinia** – zarządzanie stanem (kandydat planu w pamięci, liczniki generacji)
- **Tailwind CSS 3** – utility-first stylowanie (wersja 3 dla kompatybilności z shadcn-vue)
- **shadcn-vue** – gotowe, dostępne komponenty UI
- **vue-i18n 9** – internacjonalizacja UI (EN/PL), tryb Composition API, persystencja locale w localStorage

## Backend i baza danych

- **Supabase** jako kompleksowe rozwiązanie backendowe:
  - PostgreSQL – relacyjna baza danych
  - Row Level Security (RLS) – izolacja danych per użytkownik
  - Supabase Auth – rejestracja, logowanie, zarządzanie sesjami
  - Edge Functions – server-side logic, bezpieczne wywołania API AI

## Integracja z AI

- **OpenRouter.ai** – unified API do modeli AI (GPT-4, Claude, itp.)
  - Wywołania przez Supabase Edge Functions (klucze API server-side)
  - Elastyczność wyboru modelu bez vendor lock-in

## Testowanie

### Testy jednostkowe i integracyjne

- **Vitest** – framework testów jednostkowych i integracyjnych, natywna integracja z Vite
- **@vue/test-utils** – oficjalna biblioteka testów komponentów Vue 3
- **@pinia/testing** – dedykowane narzędzie do testowania stores Pinia
- **msw** (Mock Service Worker) – przechwytywanie requestów HTTP na poziomie sieci (mock Supabase client)
- **@vitest/coverage-v8** – raportowanie pokrycia kodu (próg ≥ 80% dla `src/lib/` i `src/stores/`)

### Testy End-to-End

- **Playwright** – testy E2E, obsługa SPA, async navigation, network interception
- **@axe-core/playwright** – automatyczne skany dostępności WCAG 2.1 AA zintegrowane z testami E2E

### Testy Edge Functions

- **Deno test runner** – natywne środowisko uruchomieniowe testów dla Supabase Edge Functions

## CI/CD i Hosting

- **GitHub Actions** – automatyzacja buildów, testów, deploymentu
- **Cloudflare Pages** – jako hosting aplikacji

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie
  zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

CI/CD i Hosting:

- Github Actions do tworzenia pipeline’ów CI/CD
- Cloudflare Pages do hostowania aplikacji
