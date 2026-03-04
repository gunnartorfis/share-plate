import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { recipeLinks, users } from '../src/lib/db/schema'

const SYSTEM_USER_ID = 'system-curated'

const icelandicRecipes = [
  // Lamb (6)
  {
    title: 'Kjötsúpa',
    description:
      'Traditional Icelandic lamb soup with potatoes, carrots, cabbage, and fresh herbs. The ultimate comfort food.',
    url: '',
    tags: JSON.stringify([
      'lamb',
      'soup',
      'traditional',
      'comfort',
      'winter',
      'dinner',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Lambalæri í ofni',
    description:
      'Slow-roasted leg of lamb with garlic, rosemary, and root vegetables. Classic Icelandic Sunday roast.',
    url: '',
    tags: JSON.stringify(['lamb', 'roast', 'traditional', 'sunday', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Hægelduð lambarifjár',
    description:
      'Slow-cooked lamb ribs with herbs and vegetables. Fall-off-the-bone tender.',
    url: '',
    tags: JSON.stringify(['lamb', 'slow', 'comfort', 'dinner', 'traditional']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Lamba pottréttur',
    description:
      'Lamb pot roast with potatoes, onions, and carrots in a rich broth. One-pot comfort dinner.',
    url: '',
    tags: JSON.stringify(['lamb', 'roast', 'comfort', 'dinner', 'one-pot']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjöt í karrý',
    description:
      'Lamb curry with potatoes, onions, and aromatic spices. Served with rice.',
    url: '',
    tags: JSON.stringify(['lamb', 'curry', 'spiced', 'dinner', 'comfort']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjötbollur með sósu',
    description:
      'Icelandic lamb and beef meatballs in brown gravy. Served with potatoes and peas.',
    url: '',
    tags: JSON.stringify(['lamb', 'beef', 'comfort', 'dinner', 'family']),
    stars: 5,
    curated: 1,
  },
  // Fish/Seafood (7)
  {
    title: 'Plokkfiskur',
    description:
      'Traditional fish stew with cod or haddock, potatoes, onion, and butter. Served with dark rye bread.',
    url: '',
    tags: JSON.stringify([
      'fish',
      'seafood',
      'traditional',
      'comfort',
      'dinner',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Saltfiskur með kartöflum',
    description:
      'Salt cod simmered and served with boiled potatoes, onions, and butter. A true Icelandic classic.',
    url: '',
    tags: JSON.stringify([
      'fish',
      'seafood',
      'traditional',
      'dinner',
      'salt cod',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Ofnbakaður þorskur',
    description:
      'Oven-baked cod fillet with butter, herbs, and lemon. Served with potatoes and vegetables.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'baked', 'healthy', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Lax í ofni',
    description:
      'Baked salmon with mustard-dill glaze. Served with potatoes and green vegetables.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'salmon', 'healthy', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Humarsúpa',
    description:
      'Creamy langoustine bisque with cream, cognac, and fresh herbs. Icelandic seafood at its finest.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'soup', 'langoustine', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Fisksúpa',
    description:
      'Creamy Icelandic fish soup with cod, salmon, potatoes, and vegetables.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'soup', 'comfort', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Fiskur með hollandaise',
    description:
      'Pan-fried fish fillet with hollandaise sauce, potatoes, and steamed vegetables.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'dinner', 'sauce', 'elegant']),
    stars: 4,
    curated: 1,
  },
  // Chicken (7)
  {
    title: 'Kjúklingur í ofni',
    description:
      'Roast chicken with rosemary, garlic, potatoes, and root vegetables. Sunday classic.',
    url: '',
    tags: JSON.stringify(['chicken', 'roast', 'sunday', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Mexíkósk kjúklingasúpa',
    description:
      'Spiced chicken soup with corn, black beans, tomatoes, and jalapeño. Topped with sour cream.',
    url: '',
    tags: JSON.stringify(['chicken', 'soup', 'mexican', 'spiced', 'dinner']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjúklingur með sætum kartöflum',
    description:
      'Roasted chicken thighs with sweet potatoes and paprika. Easy sheet-pan dinner.',
    url: '',
    tags: JSON.stringify(['chicken', 'baked', 'healthy', 'dinner', 'quick']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Píta með kjúkling',
    description:
      'Grilled chicken strips in warm pita with tzatziki, lettuce, and tomatoes.',
    url: '',
    tags: JSON.stringify(['chicken', 'quick', 'dinner', 'wrap', 'weeknight']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Fajitas með kjúkling',
    description:
      'Sizzling chicken fajitas with peppers, onions, and warm tortillas. Family favourite.',
    url: '',
    tags: JSON.stringify(['chicken', 'mexican', 'dinner', 'family', 'quick']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjúklingapasta',
    description:
      'Creamy chicken pasta with sun-dried tomatoes and parmesan. Quick and satisfying.',
    url: '',
    tags: JSON.stringify(['chicken', 'pasta', 'dinner', 'quick', 'weeknight']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjúklinga-wok',
    description:
      'Chicken stir-fry with noodles, broccoli, peppers, and soy-ginger sauce.',
    url: '',
    tags: JSON.stringify(['chicken', 'asian', 'quick', 'dinner', 'healthy']),
    stars: 5,
    curated: 1,
  },
  // Beef/Pork (5)
  {
    title: 'Hamborgarar',
    description: 'Homemade beef burgers with fries. Classic family dinner.',
    url: '',
    tags: JSON.stringify(['beef', 'quick', 'dinner', 'family', 'grilling']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Nauta gúllaš',
    description:
      'Hungarian-style beef goulash with paprika, onions, and potatoes. Hearty winter stew.',
    url: '',
    tags: JSON.stringify(['beef', 'stew', 'comfort', 'dinner', 'winter']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Nauta-wok',
    description:
      'Beef stir-fry with broccoli, bell peppers, and oyster sauce. Served over rice.',
    url: '',
    tags: JSON.stringify(['beef', 'asian', 'quick', 'dinner', 'stir-fry']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Pylsur með kartöflum',
    description:
      'Icelandic-style sausages with boiled or mashed potatoes and mustard.',
    url: '',
    tags: JSON.stringify(['pork', 'quick', 'dinner', 'comfort', 'kids']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Svínakótilettur',
    description:
      'Pan-fried pork chops with caramelized apples, potatoes, and gravy.',
    url: '',
    tags: JSON.stringify(['pork', 'dinner', 'comfort', 'quick', 'weeknight']),
    stars: 4,
    curated: 1,
  },
  // International staples (5)
  {
    title: 'Pasta bolognese',
    description:
      'Spaghetti bolognese — classic comfort food. Ground beef in tomato sauce.',
    url: '',
    tags: JSON.stringify(['pasta', 'beef', 'comfort', 'dinner', 'quick']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Lasagna',
    description: 'Classic meat lasagna with béchamel. Family dinner favourite.',
    url: '',
    tags: JSON.stringify(['pasta', 'beef', 'comfort', 'dinner', 'baked']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Pizzur',
    description:
      'Homemade pizza with various toppings. Family dinner activity.',
    url: '',
    tags: JSON.stringify(['pizza', 'family', 'dinner', 'fun']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Tacos',
    description:
      'Ground beef tacos with tortillas, cheese, and fresh toppings.',
    url: '',
    tags: JSON.stringify(['beef', 'mexican', 'dinner', 'family', 'quick']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Pasta carbonara',
    description:
      'Spaghetti carbonara with bacon, egg, parmesan, and black pepper. Quick Italian classic.',
    url: '',
    tags: JSON.stringify(['pasta', 'pork', 'quick', 'dinner', 'italian']),
    stars: 5,
    curated: 1,
  },
  // Vegetarian (4)
  {
    title: 'Grænmetissúpa',
    description:
      'Hearty vegetable soup with seasonal root vegetables and fresh herbs. Light and healthy.',
    url: '',
    tags: JSON.stringify(['vegetarian', 'soup', 'healthy', 'dinner', 'winter']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Grænmetis lasagne',
    description:
      'Vegetarian lasagne with roasted vegetables, ricotta, and tomato sauce.',
    url: '',
    tags: JSON.stringify(['vegetarian', 'pasta', 'baked', 'dinner', 'comfort']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Pasta með grænmeti',
    description:
      'Pasta with roasted seasonal vegetables, olive oil, garlic, and parmesan.',
    url: '',
    tags: JSON.stringify(['vegetarian', 'pasta', 'healthy', 'dinner', 'quick']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Ostur og grænmetis pizzur',
    description:
      'Cheese and vegetable pizza with bell peppers, mushrooms, and olives.',
    url: '',
    tags: JSON.stringify(['vegetarian', 'pizza', 'dinner', 'family', 'quick']),
    stars: 4,
    curated: 1,
  },
]

async function seed() {
  // Ensure system user exists (FK requirement)
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      email: 'system@platepool.internal',
      name: 'System',
      passwordHash: 'n/a',
      createdAt: new Date(),
    })
    .onConflictDoNothing()

  console.log('Clearing existing curated recipes...')
  await db.delete(recipeLinks).where(eq(recipeLinks.curated, 1))

  console.log('Seeding Icelandic dinner recipes...')
  for (const recipe of icelandicRecipes) {
    await db.insert(recipeLinks).values({
      id: crypto.randomUUID(),
      userId: SYSTEM_USER_ID,
      ...recipe,
      createdAt: new Date(),
    })
  }

  console.log(`Seeded ${icelandicRecipes.length} Icelandic dinner recipes`)
}

seed()
