const en = {
  brand: {
    name: 'MyAIGuide',
    tagline: 'AI-powered trip planning'
  },
  nav: {
    logOut: 'Log out'
  },
  lang: {
    switchTo: 'Switch language',
    en: 'EN',
    pl: 'PL'
  },
  theme: {
    switchToDark: 'Switch to dark mode',
    switchToLight: 'Switch to light mode'
  },
  auth: {
    emailLabel: 'Email',
    emailPlaceholder: "you{'@'}example.com",
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm password',
    newPasswordLabel: 'New password',
    confirmNewPasswordLabel: 'Confirm new password',
    login: {
      title: 'Log in',
      submitting: 'Logging in...',
      submit: 'Log in',
      forgotPassword: 'Forgot password?',
      noAccount: "Don't have an account?",
      register: 'Register'
    },
    register: {
      title: 'Create account',
      submitting: 'Creating account...',
      submit: 'Create account',
      hasAccount: 'Already have an account?',
      logIn: 'Log in'
    },
    forgotPassword: {
      title: 'Reset your password',
      description: "Enter your email address and we'll send you a link to reset your password.",
      submitting: 'Sending...',
      submit: 'Send reset link',
      successMessage:
        "If an account with that email exists, we've sent a password reset link. Check your inbox.",
      backToLogin: 'Back to login'
    },
    resetPassword: {
      title: 'Set new password',
      description: 'Choose a strong password for your account.',
      submitting: 'Updating...',
      submit: 'Update password',
      successMessage: 'Your password has been updated successfully.',
      goToLogin: 'Go to login',
      requestNewLink: 'Request a new reset link'
    },
    errors: {
      invalidCredentials: 'Invalid email or password. Please try again.',
      tooManyAttempts: 'Too many login attempts. Please wait a moment and try again.',
      networkError: 'Unable to connect. Please check your internet connection.',
      generic: 'An error occurred. Please try again.',
      emailExists: 'An account with this email already exists.',
      weakPassword: 'Password must be at least 6 characters.',
      accountCreationFailed: 'Could not create account. Please try again.',
      expiredLink: 'This reset link has expired or is invalid. Please request a new one.',
      passwordUpdateFailed: 'Could not update password. Please try again.'
    }
  },
  errors: {
    notFound: {
      code: '404',
      message: 'Page not found',
      goHome: 'Go Home'
    },
    maintenance: {
      title: 'Coming Soon',
      message: 'This feature is not available in the current environment.',
      goHome: 'Go Home'
    }
  },
  dashboard: {
    title: 'My Trips',
    newTrip: 'New Trip',
    creatingTrip: 'Creating…',
    createFirstTrip: 'Create your first trip',
    noTrips: "You don't have any trips yet.",
    loadFailed: 'Failed to load trips',
    loadFailedDesc: 'Failed to load your trips',
    tryAgain: 'Try again',
    profileUnavailable: 'Profile unavailable',
    profileUnavailableDesc: 'Could not load your profile. Please refresh.',
    deleteDialog: {
      title: 'Delete trip?',
      description:
        'This action cannot be undone. The trip and all its data will be permanently removed.',
      cancel: 'Cancel',
      confirm: 'Delete',
      deleting: 'Deleting…'
    },
    toast: {
      deleted: 'Trip deleted',
      deletedDesc: 'The trip has been permanently removed.',
      deleteFailed: 'Error',
      deleteFailedDesc: 'Failed to delete trip. Please try again.',
      createFailedDesc: 'Failed to create trip. Please try again.'
    }
  },
  tripCard: {
    status: {
      CREATED: 'New',
      DRAFT: 'In Progress',
      CONFIRMED: 'Planned'
    },
    noNotes: 'No notes yet',
    deleteAriaLabel: 'Delete trip',
    updatedAt: 'Updated {date}'
  },
  relativeTime: {
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: '{n} days ago',
    weekAgo: '{n} week ago',
    weeksAgo: '{n} weeks ago',
    justNow: 'just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgoShort: '{n}d ago'
  },
  tripHeader: {
    titlePlaceholder: 'Enter trip title',
    saving: 'Saving…',
    updatedAt: 'Updated {time}'
  },
  tripView: {
    loading: 'Loading trip...',
    loadFailed: 'Failed to load trip',
    loadFailedDesc: 'Please try again later',
    notFoundTitle: 'Trip not found',
    notFoundDesc: 'The trip you are looking for does not exist.',
    saveFailedTitle: 'Failed to save trip',
    featureDisabled: 'Plan generation is not available in the current environment.',
    leaveDialog: {
      title: 'Leave without saving?',
      description: 'You have unsaved changes. If you leave now, they will be lost.',
      stay: 'Stay',
      leave: 'Leave'
    }
  },
  tripEditor: {
    destinationLabel: 'Destination',
    destinationPlaceholder: 'e.g. Paris, France',
    preferencesTitle: 'Trip Preferences',
    preferencesDesc: 'Customize your trip preferences or use defaults from your profile',
    durationLabel: 'Trip Duration (days)',
    durationPlaceholder: 'e.g. 7',
    peopleLabel: 'Number of People',
    peoplePlaceholder: 'e.g. 2',
    interestsLabel: 'What interests you?',
    fromProfile: 'From profile',
    fromProfileTooltip: 'This value is inherited from your profile preferences',
    travelSpeedLabel: 'Travel Speed',
    tripTypeLabel: 'Trip Type',
    budgetLabel: 'Budget',
    travelerProfileLabel: 'Traveler profile (from your profile settings)',
    noFlags: 'No special traveler flags set',
    dietaryNote: 'Dietary: {description}',
    notesTitle: 'Trip Notes',
    notesDesc: 'Describe your trip plans, preferences, and any special requirements',
    notesPlaceholder: 'Write your trip notes here... (optional)',
    noteOverLimit: 'Maximum {limit} characters exceeded',
    noteApproachingLimit: 'Approaching character limit',
    noteLanguageMismatch:
      'Note language does not match the selected UI language. The plan will be generated in the UI language.',
    what: {
      nature: 'Nature & Outdoors',
      beach_relax: 'Beach & Relaxation',
      culture_museums: 'Culture & Museums',
      city_break: 'City Break',
      foodie: 'Foodie Experience'
    },
    speed: {
      slow_chill: { label: 'Slow & Chill', desc: 'Relaxed pace with plenty of downtime' },
      balance: { label: 'Balanced', desc: 'Mix of activities and relaxation' },
      intensive: { label: 'Intensive', desc: 'Packed schedule with many activities' }
    },
    type: {
      base: { label: 'Base', desc: 'Stay in one location' },
      base_with_trips: {
        label: 'Base with optional trips',
        desc: 'Stay in one location with day trips'
      },
      roadtrip: { label: 'Road trip', desc: 'Travel between multiple locations' }
    },
    budget: {
      budget: { label: 'Budget', desc: 'Cost-effective options' },
      moderate: { label: 'Moderate', desc: 'Balanced comfort and cost' },
      luxury: { label: 'Luxury', desc: 'Premium experiences' }
    },
    travelerFlags: {
      has_kids: 'Traveling with kids',
      has_pets: 'Traveling with pets',
      has_mobility_issues: 'Mobility considerations',
      has_dietary_preferences: 'Dietary preferences'
    }
  },
  plan: {
    title: 'Travel Plan',
    description: 'AI-generated day-by-day itinerary',
    quotaUsed: '{used} / {limit} used',
    resetsIn: 'Resets in {time}',
    quotaExceededTitle: 'Generation Limit Reached',
    quotaExceededDesc: "You've used all {limit} generations. Quota resets in {time}.",
    generationFailedTitle: 'Generation Failed',
    saveFailedTitle: 'Save Failed',
    noPlanText: 'No plan generated yet. Click below to create your personalized travel itinerary.',
    beforeGenerating: 'Before generating:',
    addDestination: 'Add a destination (required)',
    generating: 'Generating...',
    generate: 'Generate Plan',
    unsavedTitle: 'Unsaved Plan',
    unsavedDesc:
      "You have a generated plan that hasn't been saved. It will be lost if you leave this page.",
    saving: 'Saving...',
    save: 'Save Plan',
    discard: 'Discard',
    savedTitle: 'Plan saved',
    savedUpdatedAt: 'Last updated {time}',
    regenerating: 'Generating...',
    regenerate: 'Regenerate',
    generatingSpinner: 'Generating your plan…',
    featureDisabled: 'Plan generation is not available in the current environment.',
    locationPlaceholder: 'Location name',
    descriptionPlaceholder: 'Activity description',
    day: 'Day {n}',
    activities: '{count} activity | {count} activities',
    timeOfDay: {
      morning: 'morning',
      afternoon: 'afternoon',
      evening: 'evening'
    },
    resetLessThanHour: 'less than 1 hour',
    resetOneHour: '1 hour',
    resetHours: '{n} hours',
    toast: {
      saved: 'Plan saved',
      savedDesc: 'Your itinerary has been confirmed.'
    }
  },
  profile: {
    title: 'Your Travel Profile',
    reset: 'Reset',
    save: 'Save',
    saving: 'Saving…',
    loadFailedTitle: 'Could not load profile',
    aboutYou: 'About you',
    travelStyle: 'Default travel style',
    interests: 'Interests',
    pace: 'Pace',
    tripType: 'Trip type',
    budget: 'Budget',
    dietaryPreferencesLabel: 'Dietary preferences',
    dietaryPlaceholder:
      'Describe your dietary preferences (e.g. vegetarian, gluten-free, nut allergy)…',
    dietaryRequired: 'Please describe your dietary preferences before saving.',
    toast: {
      saved: 'Profile saved',
      savedDesc: 'Your travel profile has been updated.',
      saveFailed: 'Save failed',
      saveFailedDesc: 'Could not update profile. Please try again.'
    },
    what: {
      nature: 'Nature',
      culture_museums: 'Culture & Museums',
      beach_relax: 'Beach & Relax',
      city_break: 'City Break',
      foodie: 'Foodie'
    },
    speed: {
      slow_chill: 'Slow & Chill',
      balance: 'Balanced',
      intensive: 'Intensive'
    },
    type: {
      base: 'Base',
      base_with_trips: 'Base + Day Trips',
      roadtrip: 'Road Trip'
    },
    budgetOptions: {
      budget: 'Budget',
      moderate: 'Moderate',
      luxury: 'Luxury'
    },
    flags: {
      has_kids: 'Traveling with kids',
      has_pets: 'Traveling with pets',
      has_mobility_issues: 'Mobility considerations'
    }
  },
  pagination: {
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {current} of {total}'
  }
}

export default en
export type MessageSchema = typeof en
