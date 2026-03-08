# Plan Testów – MyAIGuide

## 1. Wprowadzenie i cele testowania

MyAIGuide to jednostronicowa aplikacja webowa (SPA) umożliwiająca szybkie tworzenie planów podróży na podstawie notatek i preferencji użytkownika z wykorzystaniem AI (OpenRouter.ai). Aplikacja jest zbudowana w oparciu o Vue 3 + TypeScript na frontendzie oraz Supabase (PostgreSQL, Auth, Edge Functions) na backendzie.

### Cele testowania

- Weryfikacja poprawności przepływów autentykacji (rejestracja, logowanie, reset hasła)
- Weryfikacja kompletności i poprawności operacji CRUD na wycieczkach
- Weryfikacja logiki generowania planów AI wraz z kontrolą limitu (quota)
- Weryfikacja izolacji danych między użytkownikami (RLS)
- Weryfikacja poprawności walidacji danych wejściowych (Zod schemas)
- Weryfikacja ochrony tras nawigacyjnych (route guards)

---

## 2. Zakres testów

### W zakresie

| Obszar                     | Opis                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| Autentykacja               | Logowanie, rejestracja, reset hasła, ochrona tras                          |
| Zarządzanie wycieczkami    | Tworzenie, edycja, usuwanie, listowanie z paginacją                        |
| Generowanie planów AI      | Wywołanie Edge Function, walidacja odpowiedzi, obsługa błędów              |
| Kontrola limitów (quota)   | Limit 10 generacji / 24 h, reset, wyświetlanie licznika                    |
| Profil użytkownika         | Edycja preferencji domyślnych, flagi (dzieci, zwierzęta, mobilność, dieta) |
| Walidacja formularzy       | Schematy Zod: auth, trip, plan, profile                                    |
| Zarządzanie stanem (Pinia) | auth.store, trip.store, plan.store, profile.store, quota.store             |
| Edge Functions             | `generate-plan` (OpenRouter), `api` (mock REST)                            |
| Bezpieczeństwo             | RLS PostgreSQL, brak wycieku danych między sesjami                         |

### Poza zakresem

- Testy wydajności infrastruktury Supabase
- Testy modeli AI (OpenRouter.ai – zewnętrzny serwis)
- Testy kompatybilności z przeglądarkami starszymi niż ostatnie 2 wersje major

---

## 3. Typy testów

### 3.1 Testy jednostkowe (Unit Tests)

**Narzędzie:** Vitest (skonfigurowany: `vitest.config.ts`, setup: `src/test/setup.ts`)
**Zakres:** wyłącznie czyste funkcje bez I/O i wywołań sieciowych
**Pokrycie:**

- `src/lib/services/generation.service.ts` – `detectLanguage` (pusty string, mieszany tekst EN+PL, truncacja do 1000 znaków), `buildAIPrompt` (warianty profilu i preferencji, fallbacki, constraint kategorii, num*days; profil z `dietaryPreferencesDescription`), `validatePlanResponse` ✅ \_zaimplementowane w `generation.service.spec.ts`*
- `src/lib/validation/trip.schemas.ts` – `validateCreateTripCommand`: walidacja title, destination (max 50), num*days (1–30), num_people (1–20), speed/type/budget enums, what array, note_body (max 10 000) ✅ \_zaimplementowane w `trip.schemas.spec.ts`*
- `src/lib/services/trip.service.ts` – `createTrip`: zwracanie TripDTO ze statusem CREATED/DRAFT, insercja pól, obsługa błędu DB ✅ _zaimplementowane w `trip.service.spec.ts`_
- `src/lib/errors/api.error.ts` – fabryki błędów (`createQuotaExceededError`, `toApiError`, `isApiError`, itp.), `ApiError.toResponse()`
- `src/lib/validation/` – schematy Zod: `loginSchema`, `registerSchema`, `resetPasswordSchema`, `tripIdSchema`, `getTripsQuerySchema`, `PlanJsonSchema`, `ActivitySchema`, `SavePlanCommandSchema`
- `src/lib/utils.ts` – funkcje pomocnicze
- `src/composables/useTheme.ts` – przełączanie motywu, persystencja w localStorage

### 3.2 Testy integracyjne (Integration Tests)

**Narzędzie:** Vitest + @pinia/testing + msw (Mock Service Worker)
**Pokrycie:**

- **Serwisy async** – `checkGenerationQuota` (okno 24h, reset, osiągnięcie limitu), `recordGenerationAttempt` (statusy: `success` / `api_error` / `validation_error`)
- **auth.store** – `initialize`, `login`, `register`, `logout`, `resetAllStores` (weryfikacja braku wycieku danych między sesjami)
- **trip.store** – `fetchTrips`, `createTrip`, `fetchTrip`, `updateTripNote`, `updateTripPreferences`, `deleteTripById`, paginacja
- **plan.store** – `generatePlan` (pełny przepływ z quota check + AI call), `savePlanToTrip`, `discardCandidate`, `updateCandidatePlan`, `fetchGenerationQuota` (wywołanie Edge Function `get-generation-quota`), `fetchTripGenerations`, ochrona przed double-submit (`isGenerating`)
- **quota.store** – `fetchQuota` (wywołuje `checkGenerationQuota` bezpośrednio z DB), `incrementUsed`, `isQuotaExceeded`, `remainingGenerations`
- **profile.store** – `fetchProfile`, `updateProfile`, `defaultPreferences`, brak profilu przy próbie generowania
- **router** – navigation guards (`requiresAuth`, `guestOnly`), walidacja parametru `tripId`

### 3.3 Testy komponentów Vue (Component Tests)

**Narzędzie:** Vitest + @vue/test-utils + @pinia/testing

| Komponent                | Co testować                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TripHeader.vue`         | Inline editing tytułu (emit `update:title`), wyświetlanie badge statusu (CREATED/DRAFT/CONFIRMED), relatywny timestamp, slot `actions`                                                                                                                                                     |
| `TripEditor.vue`         | Renderowanie z danymi, emitowanie zdarzeń zapisu, walidacja długości notatki (> 10 000 znaków), wyświetlanie flag profilu (read-only), badge „From profile" dla preferencji                                                                                                                |
| `PlanPanel.vue`          | Accordion (collapse/expand dni), inline edycja `locationName`/`description`, przyciski zapisz/odrzuć z dialogiem potwierdzenia odrzucenia, stan ładowania (`isGenerating`, `isSaving`), progress bar kwoty (kolor primary, `aria-live`), alert „Generation Limit Reached" przy quota=10/10 |
| `TripCard.vue`           | Renderowanie statusu (CREATED/DRAFT/CONFIRMED), akcja usunięcia z dialogiem potwierdzenia                                                                                                                                                                                                  |
| `UserProfilePanel.vue`   | Toggling flag (hasKids, hasPets, mobilność, dieta), edge case diety (blokada zapisu przy pustym opisie), zapis preferencji domyślnych, skeleton przy ładowaniu                                                                                                                             |
| `TripListPagination.vue` | Emitowanie zdarzeń zmiany strony, wyłączenie przycisków na granicy paginacji                                                                                                                                                                                                               |

### 3.4 Testy End-to-End (E2E Tests)

**Narzędzie:** Playwright
**Środowisko:** Dedykowany projekt Supabase w chmurze (E2E) + aplikacja Vite dev server (`npm run dev`)

**Strategia organizacji kodu (Page Object Model):**

```
e2e/
  pages/       ← Page Objects (LoginPage, DashboardPage, TripPage, ProfilePage)
  fixtures/    ← Playwright fixtures (authenticatedUser, seededTrip, quotaExhausted)
  tests/       ← Faktyczne scenariusze testowe
```

**Strategia mockowania Edge Function (Playwright route interception):**

```typescript
await page.route('**/functions/v1/generate-plan', (route) =>
  route.fulfill({ json: mockPlanResponse })
)
```

**Izolacja danych między testami:**

- Login realizowany przez `request` fixture (API, nie UI) – szybsze ~70% i reuse sesji między testami
- Każdy test tworzy własne dane przez Supabase API w `beforeEach`
- `afterEach` lub dedykowane konto testowe czyszczone per suite zapewniają idempotentność

Scenariusze opisane w sekcji 4.

### 3.5 Testy Edge Functions

**Narzędzie:** Deno test runner (natywny dla Supabase Edge Functions)
**Pokrycie:**

- `generate-plan/index.ts` – walidacja wejścia (`prompt`, `language`, `tripId`), obsługa odpowiedzi OpenRouter, timeout (60 s), błędy CORS, quota check server-side
- `get-generation-quota/index.ts` – obliczanie `used`/`remaining`/`reset_at` z ruchomym oknem 24h, guard sesji
- `api/index.ts` – routing endpointów, obsługa 404, CORS preflight

---

## 4. Scenariusze testowe

### 4.1 Autentykacja

| ID      | Scenariusz                     | Warunki wstępne      | Kroki                                  | Oczekiwany wynik                                  |
| ------- | ------------------------------ | -------------------- | -------------------------------------- | ------------------------------------------------- |
| AUTH-01 | Pomyślne logowanie             | Konto istnieje       | Wpisz poprawny email + hasło → Zaloguj | Przekierowanie na `/`, sesja aktywna w auth.store |
| AUTH-02 | Błędne hasło                   | Konto istnieje       | Wpisz błędne hasło → Zaloguj           | Komunikat błędu, brak przekierowania              |
| AUTH-03 | Logowanie z pustym formularzem | –                    | Kliknij Zaloguj bez danych             | Błędy walidacji Zod pod polami                    |
| AUTH-04 | Rejestracja nowego konta       | Email nie istnieje   | Wypełnij formularz → Zarejestruj       | Konto utworzone, automatyczne logowanie           |
| AUTH-05 | Rejestracja – hasła niezgodne  | –                    | Wpisz różne hasła                      | Błąd `confirmPassword` z Zod                      |
| AUTH-06 | Wylogowanie                    | Zalogowany           | Kliknij Wyloguj                        | Przekierowanie na `/login`, stores wyczyszczone   |
| AUTH-07 | Reset hasła (forgot password)  | Konto istnieje       | Podaj email → Wyślij                   | Komunikat o wysłaniu emaila                       |
| AUTH-08 | Ochrona trasy – niezalogowany  | Brak sesji           | Wejdź bezpośrednio na `/`              | Przekierowanie na `/login?redirect=/`             |
| AUTH-09 | guestOnly – zalogowany         | Sesja aktywna        | Wejdź na `/login`                      | Przekierowanie na `/`                             |
| AUTH-10 | Sesja po odświeżeniu strony    | Sesja w localStorage | Odśwież stronę                         | Użytkownik pozostaje zalogowany                   |

### 4.2 Zarządzanie wycieczkami

| ID      | Scenariusz                       | Kroki                           | Oczekiwany wynik                                |
| ------- | -------------------------------- | ------------------------------- | ----------------------------------------------- |
| TRIP-01 | Tworzenie wycieczki              | Dashboard → Nowa wycieczka      | Wycieczka pojawia się na liście, status CREATED |
| TRIP-02 | Edycja tytułu                    | TripView → zmień tytuł → zapisz | Tytuł zaktualizowany w DB i store               |
| TRIP-03 | Edycja notatki                   | TripView → wpisz notatkę        | Notatka zapisana, status zmienia się na DRAFT   |
| TRIP-04 | Edycja preferencji               | Zmień speed/type/budget/what    | Preferencje zaktualizowane, status DRAFT        |
| TRIP-05 | Notatka > 10 000 znaków          | Wklej tekst > 10 000 znaków     | Błąd walidacji, zapis zablokowany               |
| TRIP-06 | Usunięcie wycieczki              | Lista → usuń → potwierdź        | Wycieczka znika z listy                         |
| TRIP-07 | Paginacja listy                  | > 20 wycieczek                  | Przyciski Następna/Poprzednia, poprawna strona  |
| TRIP-08 | Nieprawidłowy tripId w URL       | Wejdź na `/trips/abc`           | Przekierowanie na 404                           |
| TRIP-09 | Brak dostępu do cudzej wycieczki | Zalogowany jako inny user       | Błąd 403 / przekierowanie (RLS)                 |

### 4.3 Generowanie planów AI

| ID     | Scenariusz                  | Kroki                                 | Oczekiwany wynik                                                              |
| ------ | --------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| GEN-01 | Pomyślne generowanie planu  | Wycieczka z destynacją → Generuj plan | Kandydat planu pojawia się w PlanPanel, quota zmniejszona o 1                 |
| GEN-02 | Brak destynacji             | Wycieczka bez destination → Generuj   | Błąd VALIDATION_ERROR, generowanie zablokowane                                |
| GEN-03 | Przekroczony limit (10/24h) | 10 generacji w ostatnich 24h          | Błąd QUOTA_EXCEEDED z datą resetu                                             |
| GEN-04 | Zapisanie kandydata planu   | Po GEN-01 → Zapisz plan               | plan_json i plan_language zapisane w DB, kandydat usunięty                    |
| GEN-05 | Odrzucenie kandydata planu  | Po GEN-01 → Odrzuć                    | planCandidate wyczyszczony, trip.plan_json bez zmian                          |
| GEN-06 | Błąd AI service             | Mock zwraca błąd                      | Status `api_error` w plan_generations, błąd widoczny w UI                     |
| GEN-07 | Wykrywanie języka PL        | Notatka zawiera polskie znaki         | language = 'pl', plan generowany po polsku                                    |
| GEN-08 | Wykrywanie języka EN        | Notatka w angielskim                  | language = 'en'                                                               |
| GEN-09 | Reset quota po 24h          | Pierwsza generacja > 24h temu         | Quota zresetowana, generowanie możliwe                                        |
| GEN-10 | Ochrona przed double-submit | Kliknij „Generuj" dwukrotnie szybko   | Przycisk disabled podczas `isGenerating`, tylko jedno wywołanie Edge Function |

### 4.4 Profil użytkownika

> **Uwaga architektoniczna:** Brak dedykowanej trasy `/profile`. Panel profilu globalnego (`UserProfilePanel`) osadzony jest bezpośrednio w górnej części `DashboardView` (per PRD §3.2 / US-005).

| ID     | Scenariusz                          | Kroki                                                         | Oczekiwany wynik                                          |
| ------ | ----------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| PRF-01 | Wyświetlenie profilu                | Otwórz Dashboard (`/`) → panel „Your Travel Profile" na górze | Dane profilu załadowane z DB                              |
| PRF-02 | Aktualizacja preferencji domyślnych | Zmień speed/type/budget/what → auto-save (natychmiast)        | Zaktualizowane w DB, defaultPreferences getter odświeżony |
| PRF-03 | Flagi podróżnika                    | Zaznacz hasKids, hasPets                                      | Wartości zapisane, używane przy generowaniu promptu       |
| PRF-04 | Fallback preferencji w planie       | Trip bez preferencji                                          | Używane preferencje z profilu podczas generowania         |
| PRF-05 | Preferencje dietetyczne – edge case | Włącz flagę „Dietary preferences" → opuść pole bez opisu      | Toast błędu, flaga cofana do OFF; DB nie zmienione        |

### 4.5 Walidacja schematów Zod (testy jednostkowe)

| ID          | Schema                                            | Przypadek testowy                                                                                                                     |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ZOD-01      | `loginSchema`                                     | Pusty email → błąd; niepoprawny format → błąd; poprawny → OK                                                                          |
| ZOD-02      | `registerSchema`                                  | Niezgodne hasła → błąd `confirmPassword`; < 6 znaków → błąd                                                                           |
| ZOD-03      | `tripIdSchema`                                    | `"abc"` → błąd; `0` → błąd; `-1` → błąd; `1` → OK; `"5"` → coerce do 5                                                                |
| ZOD-04      | `ActivitySchema`                                  | Brak `timeOfDay` → błąd; `categoryTag` spoza enum → błąd                                                                              |
| ZOD-05      | `PlanJsonSchema`                                  | Pusta tablica `days` → błąd; brak aktywności w dniu → błąd                                                                            |
| ZOD-06      | `SavePlanCommandSchema`                           | Niepoprawny kod języka (np. `"123"`) → błąd                                                                                           |
| ZOD-07      | `getTripsQuerySchema`                             | `page=0` → błąd; `limit=101` → błąd; `status="INVALID"` → błąd; wartości domyślne `page=1`, `limit=20`                                |
| CTRIP-01–06 | `validateCreateTripCommand` (happy path)          | Tylko title → OK; pełny payload → OK; nullable fields → OK; title 255 znaków → OK; num_days/num_people na granicy (1, 30, 20) → OK ✅ |
| CTRIP-07–09 | `validateCreateTripCommand` – title               | Brak title → błąd; pusty string → błąd; title > 255 znaków → błąd ✅                                                                  |
| CTRIP-10–11 | `validateCreateTripCommand` – destination         | > 50 znaków → błąd; dokładnie 50 znaków → OK ✅                                                                                       |
| CTRIP-12–16 | `validateCreateTripCommand` – num_days/num_people | 0 → błąd; 31 → błąd; 2.5 → błąd; 21 (people) → błąd ✅                                                                                |
| CTRIP-17–25 | `validateCreateTripCommand` – enums/what          | Nieprawidłowe speed/type/budget/what → błąd; wszystkie poprawne wartości → OK; pusta tablica what → OK ✅                             |
| CTRIP-26–27 | `validateCreateTripCommand` – note_body           | > 10 000 znaków → błąd; dokładnie 10 000 znaków → OK ✅                                                                               |

### 4.6 Testy jednostkowe `buildAIPrompt` (szczegółowe)

| ID        | Konfiguracja wejściowa                                                     | Co weryfikować w prompcie                                                 |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| PROMPT-01 | Profil z `hasKids=true, hasPets=true`                                      | Zawiera „traveling with kids", „traveling with pets" ✅                   |
| PROMPT-02 | Profil bez flag specjalnych                                                | Zawiera „No special requirements" ✅                                      |
| PROMPT-03 | Trip bez preferencji + profil z `default_speed='slow_chill'`               | Fallback speed `slow_chill` pojawia się w prompcie ✅                     |
| PROMPT-04 | `what = ['beach_relax', 'foodie']`                                         | Constraint „≥90% activities" i hard rule z kategorii obecne w prompcie ✅ |
| PROMPT-05 | `num_days = 5`                                                             | Zawiera „EXACTLY 5" ✅                                                    |
| PROMPT-06 | Pusta notatka (`note_body = ''`)                                           | Zawiera „No notes provided" ✅                                            |
| PROMPT-07 | `destination = undefined`                                                  | Zawiera „not specified" w sekcji Destination ✅                           |
| PROMPT-08 | Profil z `hasDietaryPreferences=true, dietaryPreferencesDescription='...'` | Zawiera „has dietary preferences" w sekcji Traveler Profile               |

### 4.7 Testy jednostkowe `detectLanguage` (szczegółowe)

| ID      | Wejście                                                      | Oczekiwany wynik                            |
| ------- | ------------------------------------------------------------ | ------------------------------------------- |
| LANG-01 | Pusty string `''`                                            | `'en'` (domyślny fallback) ✅               |
| LANG-02 | Tekst tylko z cyframi i znakami specjalnymi                  | `'en'` (domyślny fallback) ✅               |
| LANG-03 | Tekst zawierający polskie znaki (`ą`, `ę`, `ź`)              | `'pl'` ✅                                   |
| LANG-04 | Tekst angielski bez polskich znaków                          | `'en'` ✅                                   |
| LANG-05 | String > 1000 znaków z polskim znakiem tylko po pozycji 1000 | `'en'` (truncacja do 1000 znaków działa) ✅ |

### 4.8 Testy jednostkowe `createTrip` (trip.service)

| ID       | Scenariusz                                             | Oczekiwany wynik                                               |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| CTSVC-01 | Minimalny insert (tylko title)                         | TripDTO ze statusem `CREATED`, `plan_json` = null ✅           |
| CTSVC-02 | Insert z preferencjami (speed, type, budget, what)     | TripDTO ze statusem `DRAFT`, pola zmapowane ✅                 |
| CTSVC-03 | Insert ze wszystkimi polami – weryfikacja danych do DB | `supabaseClient.from().insert` wywołany z właściwymi polami ✅ |
| CTSVC-04 | Supabase zwraca obiekt błędu                           | Rzuca `ApiError` z kodem `INTERNAL_ERROR` ✅                   |
| CTSVC-05 | Supabase zwraca `null` bez błędu                       | Rzuca `ApiError` z kodem `INTERNAL_ERROR` ✅                   |

---

## 5. Środowisko testowe

### 5.1 Środowisko lokalne – unit + integration

```
Node.js >= 20
Supabase CLI (local) – supabase start
Zmienne środowiskowe: .env.local (VITE_SUPABASE_URL=http://127.0.0.1:54321, VITE_SUPABASE_ANON_KEY)
Vitest uruchamiany bez Vite dev server (środowisko jsdom/node)
```

> Testy jednostkowe i integracyjne działają wyłącznie przeciwko lokalnemu Supabase.
> Nie wymagają połączenia z chmurą ani uruchomionej aplikacji.

### 5.2 Środowisko E2E – dedykowany projekt chmurowy

```
Playwright – headless Chromium (CI), headed (lokalne debugowanie)
Supabase Cloud – dedykowany projekt E2E (odizolowany od produkcji i developmentu)
Vite dev server – npm run dev (wskazujący na projekt E2E przez .env.test)
Zmienne środowiskowe: .env.test (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY – wyłącznie do seed/cleanup w fixtures)
Konto testowe: TEST_USER_EMAIL / TEST_USER_PASSWORD (GitHub Secrets – nigdy plain text w repozytorium)
Mock Edge Function: Playwright route interception – zob. strategię w sekcji 3.4
```

> Projekt chmurowy E2E posiada własne migracje, seed i konto testowe.
> Dane czyszczone per-suite przez Supabase Admin API (`service_role` key) w `afterEach`/`afterAll`.

### 5.3 Środowisko CI (GitHub Actions)

```
ubuntu-latest
Job 1 (unit + integration): supabase/setup-cli + supabase start → npm ci → npm run test
Job 2 (E2E): npm ci → npm run build → npx playwright test
  (bez supabase/setup-cli – E2E korzysta z projektu chmurowego przez GitHub Secrets)
```

---

## 6. Narzędzia do testowania

| Warstwa                     | Narzędzie                     | Uzasadnienie                                                        |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Unit + Integration (Vue/TS) | **Vitest**                    | Natywna integracja z Vite, szybkie uruchamianie, obsługa ES modules |
| Komponenty Vue              | **@vue/test-utils**           | Oficjalna biblioteka testów komponentów Vue 3                       |
| Store Pinia                 | **@pinia/testing**            | Dedykowane narzędzie do testowania stores Pinia                     |
| Mocki HTTP / Supabase       | **msw** (Mock Service Worker) | Przechwytywanie requestów na poziomie sieci                         |
| E2E                         | **Playwright**                | Obsługa SPA, async navigation, network interception                 |
| Edge Functions              | **Deno test runner**          | Natywne środowisko uruchomieniowe Edge Functions                    |
| Walidacja typów             | **vue-tsc**                   | `npm run build` jako smoke test kompilacji                          |
| Pokrycie kodu               | **@vitest/coverage-v8**       | Raport pokrycia z progu minimalnego                                 |
| Testy dostępności           | **@axe-core/playwright**      | Skan WCAG 2.1 AA integrowany jako asercja w testach E2E             |

**Stan infrastruktury testowej:** Vitest jest skonfigurowany (`vitest.config.ts`); plik setup (`src/test/setup.ts`) zawiera globalne mocki Supabase. Istniejące pliki spec: `generation.service.spec.ts` (LANG, PROMPT, validatePlanResponse), `trip.schemas.spec.ts` (CTRIP), `trip.service.spec.ts` (CTSVC). Brak dotychczas testów integracyjnych stores, komponentów Vue i E2E — wymagają dalszego wdrożenia.

---

## 7. Harmonogram testów

| Faza                                      | Zakres                                                                                                                                           | Szacowany czas           | Zależy od | Status          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | --------- | --------------- |
| **F1** – Konfiguracja środowiska          | Instalacja Vitest, @vue/test-utils, Playwright, msw, @axe-core/playwright; konfiguracja CI; scaffold POM                                         | 2–3 dni                  | –         | ✅ Ukończone    |
| **F2** – Testy jednostkowe                | Schematy Zod (ZOD-01–07, CTRIP-01–27), serwisy (PROMPT-01–07, LANG-01–05, CTSVC-01–05), api.error                                                | 3–4 dni                  | F1        | 🔄 Częściowo    |
| **F3** – Testy komponentów + integracyjne | 5 stores Pinia (auth, trip, plan, quota, profile), router guards, komponenty Vue (TripHeader, TripEditor, PlanPanel, TripCard, UserProfilePanel) | 4–5 dni                  | F1        | ⬜ Do zrobienia |
| **F4** – Testy E2E (przepływy krytyczne)  | AUTH + TRIP + GEN scenariusze (priorytety HIGH), seed fixtures, skany a11y                                                                       | 5–6 dni                  | F1, F2    | ⬜ Do zrobienia |
| **F5** – Testy Edge Functions             | generate-plan + get-generation-quota (Deno test runner)                                                                                          | 2–3 dni                  | F1        | ⬜ Do zrobienia |
| **F6** – Stabilizacja CI i bufor          | Naprawa flaky testów E2E, progi pokrycia, dokumentacja CI pipeline                                                                               | 3–4 dni                  | F2–F5     | ⬜ Do zrobienia |
| **Łącznie (z buforem ~15%)**              |                                                                                                                                                  | **~15–20 dni roboczych** |           |                 |

---

## 8. Kryteria akceptacji testów

### Kryteria wejścia (start testowania)

- Aplikacja buduje się bez błędów TypeScript (`npm run build`)
- Lint przechodzi bez ostrzeżeń (`npm run lint`)
- Supabase lokalne uruchamia się z migracjami (`supabase db reset`)

### Kryteria wyjścia (release)

| Metryka                                        | Próg                                 |
| ---------------------------------------------- | ------------------------------------ |
| Pokrycie linii kodu (unit + integration)       | ≥ 80% dla `src/lib/` i `src/stores/` |
| Testy jednostkowe                              | 100% PASS                            |
| Testy integracyjne                             | 100% PASS                            |
| Testy E2E (scenariusze HIGH priority)          | 100% PASS                            |
| Brak otwartych błędów krytycznych (Severity 1) | 0                                    |
| Brak otwartych błędów wysokich (Severity 2)    | 0                                    |

### Priorytety scenariuszy

- **HIGH (blokujące release):** AUTH-01–10, TRIP-01, TRIP-06, TRIP-09, GEN-01–06, GEN-10
- **MEDIUM:** TRIP-02–05, TRIP-07–08, GEN-07–09, PRF-01–04, PROMPT-01–07
- **LOW:** Testy wizualne (screenshot regression)

> **Uwaga:** Testy jednostkowe (ZOD-01–07, LANG-01–05, PROMPT-01–07) nie podlegają priorytetyzacji release — uruchamiane są przy każdym commicie jako pierwsza linia obrony (fail-fast) i ich nieprzejście zawsze blokuje merge, niezależnie od priorytetu scenariuszy E2E.

---

## 9. Role i odpowiedzialności

| Rola                              | Odpowiedzialność                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Inżynier QA**                   | Tworzenie i utrzymanie planu testów, pisanie scenariuszy E2E (Playwright), raportowanie błędów           |
| **Programista Frontend**          | Pisanie testów jednostkowych i integracyjnych (Vitest) dla własnego kodu, naprawianie zgłoszonych błędów |
| **Programista Backend/Fullstack** | Testy Edge Functions (Deno), weryfikacja RLS, seed danych testowych                                      |
| **Tech Lead**                     | Przegląd i akceptacja planu testów, definiowanie progów pokrycia, przegląd PR zawierających testy        |

---

## 10. Procedury raportowania błędów

### Format zgłoszenia błędu

```markdown
**ID:** BUG-XXX
**Tytuł:** Krótki, jednoznaczny opis
**Środowisko:** Local / CI / Staging
**Severity:** 1-Krytyczny | 2-Wysoki | 3-Średni | 4-Niski
**Priorytet:** P1 | P2 | P3 | P4

**Kroki reprodukcji:**

1. ...
2. ...

**Wynik aktualny:** ...
**Wynik oczekiwany:** ...
**Logi / Screenshoty:** [załącz]
**Powiązany scenariusz:** [np. GEN-03]
```

### Definicje Severity

| Poziom             | Opis                                                                        | Czas reakcji    |
| ------------------ | --------------------------------------------------------------------------- | --------------- |
| **S1 – Krytyczny** | Aplikacja nie uruchamia się; utrata danych; naruszenie bezpieczeństwa (RLS) | Natychmiast     |
| **S2 – Wysoki**    | Kluczowy przepływ (logowanie, generowanie planu) nie działa                 | 24 h            |
| **S3 – Średni**    | Funkcjonalność działa z obejściem; błąd walidacji                           | 72 h            |
| **S4 – Niski**     | Kosmetyczny; edge case; treść komunikatu                                    | Następny sprint |

### Cykl życia błędu

```
Nowy → W analizie → Do naprawy → W naprawie → Do weryfikacji → Zamknięty
                                                              ↘ Ponownie otwarty
```

### Narzędzia raportowania

- Zgłoszenia błędów: GitHub Issues z etykietami `bug`, `severity:X`, `priority:PX`
- Śledzenie postępu testów: GitHub Projects (kanban)
- Raporty pokrycia: Publikowane jako artefakty CI (GitHub Actions)
- Raporty Playwright: HTML report jako artefakt CI po każdym uruchomieniu
