-- Test data for MyAIGuide REST API
-- Creates minimal test data for endpoint testing

-- Insert test profile
INSERT INTO profiles (user_id, default_what, default_speed, default_budget)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  ARRAY['city_break', 'culture']::what_preference[],
  'moderate',
  'moderate'
) ON CONFLICT (user_id) DO NOTHING;

-- Insert test trip with nature preference (1000+ chars)
INSERT INTO trips (id, user_id, title, note_body, what, speed, budget)
VALUES (
  1,
  '00000000-0000-0000-0000-000000000000',
  'Mountain Adventure',
  'I want to explore the mountains and enjoy nature. Looking for hiking trails with beautiful views and fresh air. I love being outdoors and experiencing the wilderness. Would like to see waterfalls, forests, and maybe some wildlife. Planning to stay in a mountain cabin or lodge. Interested in photography and capturing scenic landscapes. Want to disconnect from technology and enjoy peace and quiet. Looking for moderate difficulty trails, nothing too extreme. Would like to visit during spring or summer when weather is nice. Interested in local mountain cuisine and traditional food. Maybe some evening campfires and stargazing. Want to learn about local flora and fauna. Interested in sustainable tourism and eco-friendly practices. Looking for authentic experiences away from tourist crowds. Would like to meet local guides who know the area well. Interested in mountain culture and traditions. Maybe visit some small mountain villages. Want to try local crafts and products. Looking for good spots for sunrise and sunset photography. Interested in geology and mountain formation. Would like to see glaciers or snow-capped peaks if possible. Planning to bring proper hiking gear and equipment. Want to be prepared for changing weather conditions. Looking for trails with good markings and safety measures.',
  ARRAY['nature', 'active']::what_preference[],
  'moderate',
  'moderate'
) ON CONFLICT (id) DO UPDATE SET
  note_body = EXCLUDED.note_body,
  what = EXCLUDED.what,
  speed = EXCLUDED.speed,
  budget = EXCLUDED.budget;

-- Insert test trip with city_break preference (1000+ chars)
INSERT INTO trips (id, user_id, title, note_body, what, speed, budget)
VALUES (
  2,
  '00000000-0000-0000-0000-000000000000',
  'City Exploration',
  'Planning a weekend city break to explore urban culture and history. Interested in visiting museums, art galleries, and historical landmarks. Love walking through old streets and discovering hidden gems. Want to try local cuisine and visit authentic restaurants, not tourist traps. Interested in street art and contemporary culture. Looking for good coffee shops and cozy cafes. Want to experience local nightlife but nothing too crazy. Interested in architecture and urban design. Would like to visit local markets and try street food. Want to learn about the city history and important events. Interested in visiting theaters or concert halls if there are good shows. Looking for neighborhoods with character and local atmosphere. Want to avoid overcrowded tourist areas. Interested in sustainable urban development and green spaces. Would like to use public transportation and walk as much as possible. Want to visit local bookstores and independent shops. Interested in meeting locals and hearing their stories. Looking for authentic experiences that show real city life. Want to find good viewpoints for city photography. Interested in visiting parks and gardens for relaxation. Would like to try local craft beer or wine. Looking for balance between main attractions and off-the-beaten-path places. Want to understand the city vibe and local culture. Interested in contemporary art and design. Looking for good spots to watch sunset over the city.',
  ARRAY['city_break', 'culture']::what_preference[],
  'slow',
  'moderate'
) ON CONFLICT (id) DO UPDATE SET
  note_body = EXCLUDED.note_body,
  what = EXCLUDED.what,
  speed = EXCLUDED.speed,
  budget = EXCLUDED.budget;

-- Insert test trip with beach preference (1000+ chars)
INSERT INTO trips (id, user_id, title, note_body, what, speed, budget)
VALUES (
  3,
  '00000000-0000-0000-0000-000000000000',
  'Beach Relaxation',
  'Need a relaxing beach vacation to unwind and recharge. Looking for beautiful sandy beaches with clear water. Want to spend time swimming, sunbathing, and reading books. Interested in water sports like snorkeling or kayaking. Would like to try fresh seafood and local beach cuisine. Looking for a peaceful location away from party crowds. Want to watch sunrises and sunsets over the ocean. Interested in coastal walks and exploring tide pools. Would like to visit local fishing villages and see traditional boats. Want to learn about marine life and ocean conservation. Interested in visiting lighthouses and coastal landmarks. Looking for good spots for beach photography. Want to collect seashells and enjoy simple beach pleasures. Interested in trying local ice cream and beach snacks. Would like to rent a beach umbrella and lounger. Want to feel sand between my toes and hear ocean waves. Looking for opportunities to see dolphins or sea turtles. Interested in coastal nature and bird watching. Want to visit beach markets and local craft shops. Looking for authentic beach experiences, not resort tourism. Would like to try sailing or boat trips if available. Interested in coastal geology and rock formations. Want to find quiet coves and hidden beaches. Looking for balance between activity and relaxation. Want to disconnect from work and enjoy slow pace. Interested in beach yoga or meditation. Looking for healthy food options and fresh juices.',
  ARRAY['beach', 'relax']::what_preference[],
  'slow',
  'budget'
) ON CONFLICT (id) DO UPDATE SET
  note_body = EXCLUDED.note_body,
  what = EXCLUDED.what,
  speed = EXCLUDED.speed,
  budget = EXCLUDED.budget;

-- Insert test trip with short note (should fail validation - less than 1000 chars)
INSERT INTO trips (id, user_id, title, note_body, what, speed, budget)
VALUES (
  4,
  '00000000-0000-0000-0000-000000000000',
  'Short Note Trip',
  'This is a short note that should fail validation because it does not meet the minimum length requirement of 1000 characters.',
  ARRAY['city_break']::what_preference[],
  'moderate',
  'moderate'
) ON CONFLICT (id) DO UPDATE SET
  note_body = EXCLUDED.note_body,
  what = EXCLUDED.what,
  speed = EXCLUDED.speed,
  budget = EXCLUDED.budget;

-- Insert test trip with no note (should fail validation)
INSERT INTO trips (id, user_id, title, note_body, what, speed, budget)
VALUES (
  5,
  '00000000-0000-0000-0000-000000000000',
  'No Note Trip',
  NULL,
  ARRAY['nature']::what_preference[],
  'moderate',
  'moderate'
) ON CONFLICT (id) DO UPDATE SET
  note_body = EXCLUDED.note_body,
  what = EXCLUDED.what,
  speed = EXCLUDED.speed,
  budget = EXCLUDED.budget;

