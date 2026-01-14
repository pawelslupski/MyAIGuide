import type { MockPlanParams, MockPlanResponse, PlanJson } from '@/types'

/**
 * Mock AI Service for Phase 1 Development
 * Simulates AI plan generation without API costs
 * Returns predefined plan templates based on trip preferences
 */

// Mock plan templates for different preference combinations
const PLAN_TEMPLATES: Record<string, PlanJson> = {
  nature: {
    days: [
      {
        day: 1,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Mountain Trail',
            description: 'Scenic hiking trail with panoramic views',
            categoryTag: 'nature'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Forest Reserve',
            description: 'Explore ancient forest paths and wildlife',
            categoryTag: 'nature'
          }
        ]
      },
      {
        day: 2,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'National Park',
            description: 'Guided nature walk and bird watching',
            categoryTag: 'nature'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Lake District',
            description: 'Kayaking and lakeside relaxation',
            categoryTag: 'nature'
          }
        ]
      }
    ]
  },
  culture_museums: {
    days: [
      {
        day: 1,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Wawel Castle',
            description: 'Visit the historic royal castle and cathedral',
            categoryTag: 'culture_museums'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'National Museum',
            description: 'Explore art collections and historical exhibits',
            categoryTag: 'culture_museums'
          }
        ]
      },
      {
        day: 2,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Old Town Square',
            description: 'Walking tour of medieval architecture',
            categoryTag: 'culture_museums'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Contemporary Art Gallery',
            description: 'Modern art exhibitions and installations',
            categoryTag: 'culture_museums'
          }
        ]
      }
    ]
  },
  beach_relax: {
    days: [
      {
        day: 1,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Sandy Beach',
            description: 'Relaxing morning by the ocean',
            categoryTag: 'beach_relax'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Beachside Spa',
            description: 'Massage and wellness treatments',
            categoryTag: 'beach_relax'
          }
        ]
      },
      {
        day: 2,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Coastal Walk',
            description: 'Leisurely stroll along the coastline',
            categoryTag: 'beach_relax'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Beach Club',
            description: 'Sunset cocktails and live music',
            categoryTag: 'beach_relax'
          }
        ]
      }
    ]
  },
  city_break: {
    days: [
      {
        day: 1,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Kazimierz District',
            description: 'Explore the historic Jewish quarter with cafes and galleries',
            categoryTag: 'city_break'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Shopping District',
            description: 'Browse boutiques and local markets',
            categoryTag: 'city_break'
          }
        ]
      }
    ]
  },
  foodie: {
    days: [
      {
        day: 1,
        activities: [
          {
            timeOfDay: 'morning',
            locationName: 'Local Food Market',
            description: 'Taste regional specialties and fresh produce',
            categoryTag: 'foodie'
          },
          {
            timeOfDay: 'afternoon',
            locationName: 'Cooking Class',
            description: 'Learn to prepare traditional dishes',
            categoryTag: 'foodie'
          }
        ]
      }
    ]
  }
}

/**
 * Generate a mock travel plan based on preferences
 * Simulates AI API call with realistic delay
 */
export async function generateMockPlan(params: MockPlanParams): Promise<MockPlanResponse> {
  // Simulate API latency (2-5 seconds)
  const delay = 2000 + Math.random() * 3000
  await new Promise((resolve) => setTimeout(resolve, delay))

  // Select template based on first preference, fallback to city_break
  const primaryPreference = params.tripPreferences.what[0] || 'city_break'
  const template = PLAN_TEMPLATES[primaryPreference] || PLAN_TEMPLATES.city_break

  if (!template) {
    throw new Error('Failed to generate mock plan: no template found')
  }

  return {
    plan: template,
    model_used: 'mock-ai-v1'
  }
}
