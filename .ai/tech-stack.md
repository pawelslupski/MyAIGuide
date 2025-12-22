# Tech Stack – MyAIGuide

## Frontend
- **Vue 3.5** – framework SPA, reaktywność, komponenty
- **Vite** – szybki bundler i dev server
- **TypeScript 5** – statyczne typowanie
- **Vue Router** – routing po stronie klienta
- **Pinia** – zarządzanie stanem (kandydat planu w pamięci, liczniki generacji)
- **Tailwind CSS 3** – utility-first stylowanie (wersja 3 dla kompatybilności z shadcn-vue)
- **shadcn-vue** – gotowe, dostępne komponenty UI

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

## CI/CD i Hosting
- **GitHub Actions** – automatyzacja buildów, testów, deploymentu
- **DigitalOcean** – hosting aplikacji (App Platform lub Droplet)

AI - Komunikacja z modelami przez usługę Openrouter.ai:
- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

CI/CD i Hosting:
- Github Actions do tworzenia pipeline’ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker