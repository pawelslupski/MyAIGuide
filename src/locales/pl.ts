import type { MessageSchema } from './en'

const pl: MessageSchema = {
  brand: {
    name: 'MyAIGuide',
    tagline: 'Planowanie podróży z AI'
  },
  nav: {
    logOut: 'Wyloguj'
  },
  lang: {
    switchTo: 'Zmień język',
    en: 'EN',
    pl: 'PL'
  },
  theme: {
    switchToDark: 'Włącz tryb ciemny',
    switchToLight: 'Włącz tryb jasny'
  },
  auth: {
    validation: {
      emailRequired: 'Email jest wymagany',
      emailInvalid: 'Podaj poprawny adres email',
      passwordRequired: 'Hasło jest wymagane',
      passwordTooShort: 'Hasło musi mieć co najmniej 6 znaków',
      confirmPasswordRequired: 'Potwierdź hasło',
      passwordsMismatch: 'Hasła nie są identyczne'
    },
    emailLabel: 'Email',
    emailPlaceholder: "ty{'@'}przykład.pl",
    passwordLabel: 'Hasło',
    confirmPasswordLabel: 'Potwierdź hasło',
    newPasswordLabel: 'Nowe hasło',
    confirmNewPasswordLabel: 'Potwierdź nowe hasło',
    login: {
      title: 'Zaloguj się',
      submitting: 'Logowanie...',
      submit: 'Zaloguj się',
      forgotPassword: 'Nie pamiętasz hasła?',
      noAccount: 'Nie masz konta?',
      register: 'Zarejestruj się'
    },
    register: {
      title: 'Utwórz konto',
      submitting: 'Tworzenie konta...',
      submit: 'Utwórz konto',
      hasAccount: 'Masz już konto?',
      logIn: 'Zaloguj się',
      emailConfirmationNotice:
        'Konto zostanie poprawnie utworzone dopiero po potwierdzeniu wiadomości na skrzynce email właściciela.'
    },
    forgotPassword: {
      title: 'Zresetuj hasło',
      description: 'Podaj swój adres email, a wyślemy Ci link do resetowania hasła.',
      submitting: 'Wysyłanie...',
      submit: 'Wyślij link resetujący',
      successMessage:
        'Jeśli konto z tym adresem email istnieje, wysłaliśmy link resetujący. Sprawdź skrzynkę pocztową.',
      backToLogin: 'Powrót do logowania'
    },
    resetPassword: {
      title: 'Ustaw nowe hasło',
      description: 'Wybierz silne hasło do swojego konta.',
      submitting: 'Aktualizowanie...',
      submit: 'Zaktualizuj hasło',
      successMessage: 'Twoje hasło zostało pomyślnie zaktualizowane.',
      goToLogin: 'Przejdź do logowania',
      requestNewLink: 'Poproś o nowy link resetujący'
    },
    errors: {
      invalidCredentials: 'Nieprawidłowy email lub hasło. Spróbuj ponownie.',
      tooManyAttempts: 'Zbyt wiele prób logowania. Poczekaj chwilę i spróbuj ponownie.',
      networkError: 'Nie można się połączyć. Sprawdź połączenie internetowe.',
      generic: 'Wystąpił błąd. Spróbuj ponownie.',
      emailExists: 'Konto z tym adresem email już istnieje.',
      weakPassword: 'Hasło musi mieć co najmniej 6 znaków.',
      accountCreationFailed: 'Nie udało się utworzyć konta. Spróbuj ponownie.',
      emailRateLimit:
        'Rejestracja jest chwilowo niedostępna z powodu dużego ruchu. Spróbuj ponownie za około godzinę.',
      expiredLink: 'Ten link resetujący wygasł lub jest nieprawidłowy. Poproś o nowy.',
      passwordUpdateFailed: 'Nie udało się zaktualizować hasła. Spróbuj ponownie.'
    }
  },
  errors: {
    notFound: {
      code: '404',
      message: 'Nie znaleziono strony',
      goHome: 'Strona główna'
    },
    maintenance: {
      title: 'Wkrótce dostępne',
      message: 'Ta funkcja nie jest dostępna w bieżącym środowisku.',
      goHome: 'Strona główna'
    }
  },
  dashboard: {
    title: 'Moje podróże',
    newTrip: 'Nowa podróż',
    creatingTrip: 'Tworzenie…',
    createFirstTrip: 'Utwórz swoją pierwszą podróż',
    noTrips: 'Nie masz jeszcze żadnych podróży.',
    loadFailed: 'Nie udało się załadować podróży',
    loadFailedDesc: 'Nie udało się załadować Twoich podróży',
    tryAgain: 'Spróbuj ponownie',
    profileUnavailable: 'Profil niedostępny',
    profileUnavailableDesc: 'Nie udało się załadować profilu. Odśwież stronę.',
    deleteDialog: {
      title: 'Usunąć podróż?',
      description:
        'Tej czynności nie można cofnąć. Podróż i wszystkie jej dane zostaną trwale usunięte.',
      cancel: 'Anuluj',
      confirm: 'Usuń',
      deleting: 'Usuwanie…'
    },
    toast: {
      deleted: 'Podróż usunięta',
      deletedDesc: 'Podróż została trwale usunięta.',
      deleteFailed: 'Błąd',
      deleteFailedDesc: 'Nie udało się usunąć podróży. Spróbuj ponownie.',
      createFailedDesc: 'Nie udało się utworzyć podróży. Spróbuj ponownie.'
    }
  },
  tripCard: {
    status: {
      CREATED: 'Nowa',
      DRAFT: 'W toku',
      CONFIRMED: 'Zaplanowana'
    },
    noNotes: 'Brak notatek',
    deleteAriaLabel: 'Usuń podróż',
    updatedAt: 'Zaktualizowano {date}'
  },
  relativeTime: {
    today: 'Dzisiaj',
    yesterday: 'Wczoraj',
    daysAgo: '{n} dni temu',
    weekAgo: '{n} tydzień temu',
    weeksAgo: '{n} tygodnie temu',
    justNow: 'przed chwilą',
    minutesAgo: '{n} min temu',
    hoursAgo: '{n}g temu',
    daysAgoShort: '{n}d temu'
  },
  tripHeader: {
    titlePlaceholder: 'Wprowadź tytuł podróży',
    saving: 'Zapisywanie…',
    updatedAt: 'Zaktualizowano {time}',
    backToDashboard: 'Wróć na stronę główną'
  },
  tripView: {
    loading: 'Ładowanie podróży...',
    loadFailed: 'Nie udało się załadować podróży',
    loadFailedDesc: 'Spróbuj ponownie później',
    notFoundTitle: 'Nie znaleziono podróży',
    notFoundDesc: 'Szukana podróż nie istnieje.',
    saveFailedTitle: 'Nie udało się zapisać podróży',
    featureDisabled: 'Generowanie planu nie jest dostępne w bieżącym środowisku.',
    leaveDialog: {
      title: 'Wyjść bez zapisywania?',
      description: 'Masz niezapisane zmiany. Jeśli wyjdziesz teraz, zostaną utracone.',
      titleGenerating: 'Generowanie w toku',
      descriptionGenerating:
        'Trwa generowanie planu. Opuszczenie strony teraz przerwie ten proces i żaden plan nie zostanie zapisany.',
      stay: 'Zostań',
      leave: 'Wyjdź',
      leaveGenerating: 'Wyjdź mimo to'
    }
  },
  tripEditor: {
    destinationLabel: 'Cel podróży',
    destinationPlaceholder: 'np. Paryż, Francja',
    preferencesTitle: 'Preferencje podróży',
    preferencesDesc: 'Dostosuj preferencje podróży lub użyj domyślnych z profilu',
    durationLabel: 'Czas trwania (dni)',
    durationPlaceholder: 'np. 7',
    peopleLabel: 'Liczba osób',
    peoplePlaceholder: 'np. 2',
    interestsLabel: 'Co Cię interesuje?',
    fromProfile: 'Z profilu',
    fromProfileTooltip: 'Ta wartość jest dziedziczona z preferencji profilu',
    travelSpeedLabel: 'Tempo podróży',
    tripTypeLabel: 'Rodzaj podróży',
    budgetLabel: 'Budżet',
    travelerProfileLabel: 'Profil podróżnika (z ustawień profilu)',
    noFlags: 'Brak specjalnych oznaczeń podróżnika',
    dietaryNote: 'Dieta: {description}',
    notesTitle: 'Notatki',
    notesDesc:
      'Dodaj szczegóły, które pozwolą doprecyzować plan — miejsca które chcesz zwiedzić, rzeczy do unikania, ograniczenia czasowe w konkretnych dniach, potrzeby specjalne i inne.',
    notesPlaceholder:
      'np. W 2. dniu mogę wychodzić tylko do 15:00. Chcę zobaczyć stare miasto. Unikaj zatłoczonych atrakcji turystycznych jeśli to możliwe...',
    noteOverLimit: 'Przekroczono limit {limit} znaków',
    noteApproachingLimit: 'Zbliżasz się do limitu znaków',
    noteLanguageMismatch:
      'Język notatki nie zgadza się z wybranym językiem interfejsu. Plan zostanie wygenerowany w języku interfejsu.',
    what: {
      nature: 'Natura i outdoors',
      beach_relax: 'Plaża i relaks',
      culture_museums: 'Kultura i muzea',
      city_break: 'Wypad do miasta',
      foodie: 'Kuchnia i smaki'
    },
    speed: {
      slow_chill: { label: 'Spokojnie', desc: 'Relaksujące tempo z dużą ilością czasu wolnego' },
      balance: { label: 'Zrównoważony', desc: 'Mix aktywności i relaksu' },
      intensive: { label: 'Intensywny', desc: 'Napięty grafik z wieloma aktywnościami' }
    },
    type: {
      base: { label: 'Stacjonarny', desc: 'Pobyt w jednym miejscu' },
      base_with_trips: {
        label: 'Stacjonarny z wycieczkami',
        desc: 'Pobyt z wycieczkami jednodniowymi'
      },
      roadtrip: { label: 'Road trip', desc: 'Podróż przez wiele miejsc' }
    },
    budget: {
      budget: { label: 'Ekonomiczny', desc: 'Przystępne cenowo opcje' },
      moderate: { label: 'Umiarkowany', desc: 'Równowaga komfortu i kosztów' },
      luxury: { label: 'Luksusowy', desc: 'Ekskluzywne doświadczenia' }
    },
    travelerFlags: {
      has_kids: 'Podróż z dziećmi',
      has_pets: 'Podróż ze zwierzętami',
      has_mobility_issues: 'Ograniczenia ruchowe',
      has_dietary_preferences: 'Preferencje dietetyczne'
    }
  },
  plan: {
    title: 'Plan podróży',
    description: 'Itinerarium generowane przez AI',
    quotaUsed: '{used} / {limit} wykorzystane',
    resetsIn: 'Odnowienie za {time}',
    quotaExceededTitle: 'Osiągnięto limit generowania',
    quotaExceededDesc:
      'Wykorzystałeś wszystkie {limit} generowania. Wszystkie sloty odnowią się za {time}.',
    generationFailedTitle: 'Błąd generowania',
    saveFailedTitle: 'Błąd zapisywania',
    errors: {
      aiApiError: 'Nie udało się wygenerować planu. Spróbuj ponownie.',
      destinationRequired: 'Cel podróży jest wymagany przed wygenerowaniem planu.',
      noteTooLong: 'Notatki nie mogą przekraczać 10 000 znaków.',
      generic: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
    },
    noPlanText:
      'Nie wygenerowano jeszcze planu. Kliknij poniżej, aby utworzyć spersonalizowane itinerarium.',
    beforeGenerating: 'Przed generowaniem:',
    addDestination: 'Dodaj cel podróży (wymagane)',
    generating: 'Generowanie...',
    generate: 'Generuj plan',
    unsavedTitle: 'Niezapisany plan',
    unsavedDesc:
      'Masz wygenerowany plan, który nie został zapisany. Zostanie utracony po opuszczeniu strony.',
    saving: 'Zapisywanie...',
    save: 'Zapisz plan',
    discard: 'Odrzuć',
    savedTitle: 'Plan zapisany',
    savedUpdatedAt: 'Ostatnio zaktualizowano {time}',
    regenerating: 'Generowanie...',
    regenerate: 'Wygeneruj ponownie',
    generatingSpinner: 'Generowanie planu…',
    patienceTitle: 'Uzbrój się w cierpliwość',
    patienceDesc:
      'Trwa generowanie planu. Może to potrwać nawet minutę, w zależności od złożoności podróży.',
    featureDisabled: 'Generowanie planu nie jest dostępne w bieżącym środowisku.',
    locationPlaceholder: 'Nazwa miejsca',
    descriptionPlaceholder: 'Opis aktywności',
    day: 'Dzień {n}',
    activities: '{count} aktywność | {count} aktywności | {count} aktywności',
    timeOfDay: {
      morning: 'poranek',
      afternoon: 'południe',
      evening: 'wieczór'
    },
    resetLessThanHour: 'mniej niż godzina',
    resetOneHour: '1 godzina',
    resetHours: '{n} godziny',
    toast: {
      saved: 'Plan zapisany',
      savedDesc: 'Twoje itinerarium zostało potwierdzone.'
    }
  },
  profile: {
    title: 'Twój profil podróżnika',
    reset: 'Resetuj',
    save: 'Zapisz',
    saving: 'Zapisywanie…',
    loadFailedTitle: 'Nie udało się załadować profilu',
    aboutYou: 'O Tobie',
    travelStyle: 'Domyślny styl podróży',
    interests: 'Zainteresowania',
    pace: 'Tempo',
    tripType: 'Rodzaj podróży',
    budget: 'Budżet',
    dietaryPreferencesLabel: 'Preferencje dietetyczne',
    dietaryPlaceholder:
      'Opisz swoje preferencje dietetyczne (np. wegetarianin, bez glutenu, alergia na orzechy)…',
    dietaryRequired: 'Opisz swoje preferencje dietetyczne przed zapisaniem.',
    toast: {
      saved: 'Profil zapisany',
      savedDesc: 'Twój profil podróżnika został zaktualizowany.',
      saveFailed: 'Błąd zapisywania',
      saveFailedDesc: 'Nie udało się zaktualizować profilu. Spróbuj ponownie.'
    },
    what: {
      nature: 'Natura',
      culture_museums: 'Kultura i muzea',
      beach_relax: 'Plaża i relaks',
      city_break: 'Wypad do miasta',
      foodie: 'Kuchnia'
    },
    speed: {
      slow_chill: 'Spokojnie',
      balance: 'Zrównoważony',
      intensive: 'Intensywny'
    },
    type: {
      base: 'Stacjonarny',
      base_with_trips: 'Stacjonarny + wycieczki',
      roadtrip: 'Road Trip'
    },
    budgetOptions: {
      budget: 'Ekonomiczny',
      moderate: 'Umiarkowany',
      luxury: 'Luksusowy'
    },
    flags: {
      has_kids: 'Podróż z dziećmi',
      has_pets: 'Podróż ze zwierzętami',
      has_mobility_issues: 'Ograniczenia ruchowe'
    }
  },
  pagination: {
    previous: 'Poprzednia',
    next: 'Następna',
    pageOf: 'Strona {current} z {total}'
  }
}

export default pl
