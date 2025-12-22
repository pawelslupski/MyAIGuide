# Dokument wymagań produktu (PRD) – MyAIGuide

## 1. Przegląd produktu
MyAIGuide to webowa aplikacja SPA do szybkiego tworzenia planów wycieczek na podstawie prostych notatek i preferencji podróżniczych użytkownika.  
1 notatka = 1 wycieczka = 1 plan w formacie JSON, który użytkownik może przejrzeć, poprawić i zapisać.

## 2. Problem użytkownika
Planowanie wyjazdów wymaga zbierania informacji z wielu źródeł, ich selekcji i ułożenia w harmonogram dopasowany do ograniczeń (dzieci, dieta, budżet, mobilność, liczba osób). Użytkownicy często kończą na luźnych notatkach i linkach, bez konkretnego planu.  
MyAIGuide redukuje ten wysiłek, pozwalając:
- przechowywać pomysły na wyjazdy jako proste notatki,
- ustawić globalny profil i preferencje per wycieczka,
- jednym kliknięciem generować dzienne plany zgodne z kontekstem notatki.

## 3. Wymagania funkcjonalne

### 3.1 System kont i bezpieczeństwo
- Rejestracja/logowanie z wykorzystaniem e‑maila i hasła.
- Dostęp do notatek, profilu i planów wyłącznie po zalogowaniu.
- Izolacja danych per konto.
- Trwałe usunięcie konta usuwa też wszystkie notatki i plany.

### 3.2 Profil globalny użytkownika
- Cztery przełączniki cech: „Podróż z dziećmi”, „Podróż ze zwierzętami”, „Mam ograniczenia mobilności”, „Mam preferencje żywieniowe”.
- Domyślne preferencje stylu podróży: Co? / Jak szybko? / Jaki typ? / Budżet.
- Wskaźnik kompletności profilu (np. baner „profil kompletny/niekompletny”).

### 3.3 Moduł notatek / wycieczek
- CRUD notatek, każda notatka reprezentuje jedną wycieczkę.
- Dashboard listy wycieczek posortowanej malejąco po dacie ostatniej modyfikacji.
- Widok wycieczki z dwoma pionowymi panelami: [Notatka] u góry, [Plan] pod spodem.

### 3.4 Preferencje per wycieczka
- Konfiguracja pól:
  - Co? (multi‑choice): Przyroda, Kultura/Muzea, Plaża/Relaks, City Break, Foodie.
  - Jak szybko? (single‑choice): Slow/Chill, Balans, Intensywnie.
  - Jaki typ? (single‑choice): Baza wypadowa, Roadtrip.
  - Budżet (single‑choice): €, €€, €€€.
- Domyślne wartości kopiowane z profilu z możliwością nadpisania.

### 3.5 Generowanie planu z AI
- Plan generowany na podstawie: jednej notatki, profilu globalnego i preferencji wycieczki.
- Struktura wyniku (JSON) zawiera m.in.: Day, TimeOfDay (Rano/Popołudnie/Wieczór), LocationName, Description, CategoryTag.
- Język planu = język notatki (automatyczne wykrywanie).
- Walidacja długości notatki:
  - minimalnie 1000 znaków,
  - maksymalnie 10 000 znaków.
- Dzienny limit generowania planów: 10 generacji na użytkownika w ruchomym oknie 24h z widocznym licznikiem.

### 3.6 Widok review, edycja i zapis planu
- Wygenerowany plan trafia najpierw jako tymczasowy kandydat (tylko w pamięci aplikacji).
- Użytkownik może edytować pola kandydata (np. opis, aktywności).
- Akcja „Zapisz plan” utrwala kandydata w bazie i wiąże go 1:1 z notatką.
- Ponowne wygenerowanie planu nadpisuje wcześniej zapisany plan.
- Odświeżenie strony / zamknięcie przeglądarki usuwa niezapisanego kandydata.

### 3.7 Obsługa błędów i stany brzegowe
- W przypadku błędu generowania (timeout, błąd API) wyświetlany jest jasny komunikat i przycisk ponowienia.
- Brak automatycznego retry w MVP.
- Po przekroczeniu limitu generacji przycisk generowania jest zablokowany z komunikatem o limicie.

## 4. Granice produktu
- W zakresie MVP:
  - indywidualne planowanie wycieczek (1 notatka = 1 plan),
  - profil użytkownika i preferencje per wycieczka,
  - integracja z modelem AI generującym ustrukturyzowany plan.
- Poza zakresem MVP:
  - współdzielenie planów między użytkownikami,
  - zaawansowane planowanie logistyki (rezerwacje, dokładne godziny, optymalizacja tras),
  - obsługa multimediów (zdjęcia),
  - wersjonowanie wielu planów dla jednej notatki,
  - automatyczne retry i streaming odpowiedzi modelu,
  - aplikacje mobilne (MVP = webowe SPA).

## 5. Historyjki użytkowników

### US-001 Rejestracja nowego użytkownika
ID: US-001  
Opis: Jako nowy użytkownik chcę założyć konto, aby zacząć planować wycieczki.  
Kryteria akceptacji:
- Formularz z polami e‑mail i hasło; e‑mail jest unikalnym identyfikatorem.
- Po poprawnej rejestracji konto jest utworzone, użytkownik zalogowany i przekierowany na dashboard.
- Błędne dane wyświetlają czytelne komunikaty.

### US-002 Logowanie, wylogowanie i wymuszenie logowania
ID: US-002  
Opis: Jako zarejestrowany użytkownik chcę bezpiecznie logować się i wylogowywać, a zasoby aplikacji mają być chronione.  
Kryteria akceptacji:
- Próba wejścia na strony notatek/profilu/planów bez zalogowania przekierowuje do logowania.
- Po zalogowaniu użytkownik widzi swój dashboard; po wylogowaniu traci dostęp do chronionych zasobów.

### US-003 Izolacja danych między kontami
ID: US-003  
Opis: Jako użytkownik chcę mieć pewność, że nikt nie widzi moich danych.  
Kryteria akceptacji:
- Użytkownik widzi wyłącznie swoje notatki, profil i plany.
- Próba dostępu do zasobów innego użytkownika kończy się błędem autoryzacji.

### US-004 Usunięcie konta i danych
ID: US-004  
Opis: Jako użytkownik chcę trwale usunąć konto wraz z danymi.  
Kryteria akceptacji:
- Dostępna akcja „Usuń konto” z jasnym ostrzeżeniem.
- Po potwierdzeniu usuwane są konto, notatki i plany; ponowne logowanie jest niemożliwe.

### US-005 Konfiguracja profilu globalnego
ID: US-005  
Opis: Jako użytkownik chcę ustawić informacje o dzieciach, diecie, mobilności i zwierzętach.  
Kryteria akceptacji:
- Ekran profilu zawiera przełączniki opisane odpowiednimi etykietami.
- Zmiany zapisują się i wpływają na kolejne generowane plany.

### US-006 Domyślne preferencje stylu podróży
ID: US-006  
Opis: Jako użytkownik chcę ustawić domyślne preferencje stylu podróży.  
Kryteria akceptacji:
- W profilu dostępne są domyślne wartości dla pól Co?, Jak szybko?, Jaki typ?, Budżet.
- Nowe wycieczki startują z tymi wartościami, z możliwością edycji.

### US-007 Wskaźnik kompletności profilu
ID: US-007  
Opis: Jako użytkownik chcę widzieć, czy mój profil jest kompletny.  
Kryteria akceptacji:
- System wskazuje stan profilu (kompletny/niekompletny).
- Po uzupełnieniu wszystkich wymaganych pól stan zmienia się na „kompletny”.

### US-008 Utworzenie nowej wycieczki i notatki
ID: US-008  
Opis: Jako użytkownik chcę utworzyć wycieczkę z nazwą i notatką.  
Kryteria akceptacji:
- Możliwość dodania wycieczki z nazwą i treścią notatki (może być początkowo pusta).
- Nowa wycieczka pojawia się na liście; data ostatniej modyfikacji jest ustawiona.

### US-009 Edycja i usuwanie notatki
ID: US-009  
Opis: Jako użytkownik chcę edytować i usuwać notatki.  
Kryteria akceptacji:
- Możliwość zmiany nazwy wycieczki i treści notatki; data modyfikacji jest aktualizowana.
- Usunięcie wycieczki usuwa ją z listy wraz z ewentualnym planem po potwierdzeniu.

### US-010 Przegląd listy wycieczek
ID: US-010  
Opis: Jako użytkownik chcę widzieć listę wycieczek posortowaną wg ostatnich zmian.  
Kryteria akceptacji:
- Dashboard wyświetla listę wycieczek posortowaną malejąco po dacie ostatniej modyfikacji.
- Kliknięcie pozycji otwiera widok szczegółów z panelami [Notatka] i [Plan].

### US-011 Preferencje per wycieczka
ID: US-011  
Opis: Jako użytkownik chcę ustawić preferencje stylu podróży dla konkretnej wycieczki.  
Kryteria akceptacji:
- W widoku wycieczki można wybrać wartości pól Co?, Jak szybko?, Jaki typ?, Budżet; domyślne pochodzą z profilu.
- Zapisane preferencje są wykorzystywane przy kolejnych generacjach planu.

### US-012 Walidacja treści notatki
ID: US-012  
Opis: Jako użytkownik chcę, aby system pilnował minimalnej i maksymalnej długości notatki.  
Kryteria akceptacji:
- Przycisk „Generuj plan” jest nieaktywny, dopóki notatka ma mniej niż 1000 znaków; tooltip informuje o wymaganym minimum.
- Długość notatki nie może przekroczyć 10 000 znaków; po przekroczeniu użytkownik widzi komunikat i licznik znaków, a przycisk „Generuj plan” jest nieaktywny, dopóki długość nie będzie ≤ 10 000.

### US-013 Generowanie planu z limitem i licznikiem
ID: US-013  
Opis: Jako użytkownik chcę wygenerować plan i wiedzieć, ile generacji zostało mi na dziś.  
Kryteria akceptacji:
- Po kliknięciu „Generuj plan” przy poprawnych danych wysyłane jest żądanie do AI, wyświetlany jest stan ładowania, a następnie kandydat planu.
- System pokazuje licznik generacji „X/10 w ciągu ostatnich 24 godzin”, blokuje kolejne generacje po 10/10 i pokazuje komunikat o limicie; licznik aktualizuje się, gdy najstarsze generacje wypadną z okna 24h.

### US-014 Przegląd i edycja kandydata planu
ID: US-014  
Opis: Jako użytkownik chcę przejrzeć i ewentualnie poprawić wygenerowany plan przed zapisem.  
Kryteria akceptacji:
- Kandydat planu prezentowany jest w strukturze dni (Dzień 1, Dzień 2, …) z podziałem na Rano/Popołudnie/Wieczór i polami: nazwa miejsca, opis, tag kategorii.
- Użytkownik może edytować pola (np. Description) przed zapisem.

### US-015 Zapis zaakceptowanego planu i ponowne otwarcie
ID: US-015  
Opis: Jako użytkownik chcę zapisać finalny plan i wracać do niego później.  
Kryteria akceptacji:
- Wyraźna akcja „Zapisz plan” utrwala aktualnego kandydata jako plan powiązany 1:1 z notatką.
- Po ponownym otwarciu wycieczki zapisany plan jest widoczny w panelu [Plan]; brak planu jest jasno komunikowany.

### US-016 Ponowne generowanie i obsługa błędów
ID: US-016  
Opis: Jako użytkownik chcę ponownie wygenerować plan oraz rozumieć, co dzieje się w przypadku błędów.  
Kryteria akceptacji:
- Kolejne kliknięcie „Generuj plan” tworzy nowego kandydata; zapis nadpisuje poprzedni plan.
- W przypadku błędu generowania użytkownik widzi komunikat i może ręcznie ponowić próbę.
- Niezapisany kandydat nie jest przechowywany między odświeżeniami strony ani zamknięciem przeglądarki.

### US-017 Język planu zgodny z notatką
ID: US-017  
Opis: Jako użytkownik chcę, aby plan był w języku notatki.  
Kryteria akceptacji:
- System generuje plan w języku notatki (np. PL/EN), co potwierdzają testowe notatki w różnych językach.
- W przypadku mieszanych treści wybierany jest dominujący język; brak ręcznego przełącznika języka w MVP.

## 6. Metryki sukcesu
- ≥ 90% aktywnych użytkowników ma kompletny profil globalny (wymagane pola + ewentualne domyślne preferencje).
- ≥ 75% aktywnych użytkowników generuje i zapisuje co najmniej 3 plany rocznie (liczone tylko plany po akcji „Zapisz plan”).
