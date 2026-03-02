import { db } from '../src/lib/db'
import { recipeLinks } from '../src/lib/db/schema'

const icelandicRecipes = [
  {
    title: 'Kjötsúpa',
    description:
      'Traditional Icelandic meat soup with lamb, potatoes, carrots, and cabbage. A hearty comfort food perfect for cold evenings.',
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
    title: 'Pylsur',
    description:
      'Icelandic hot dogs - the famous street food. Mustard, ketchup, raw onion, crispy fried onion, and remoulade.',
    url: '',
    tags: JSON.stringify([
      'hotdog',
      'streetfood',
      'quick',
      'comfort',
      'dinner',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Plokkfiskur',
    description:
      'Traditional Icelandic fish stew with cod or haddock, potatoes, onion, and butter. Served with dark rye bread.',
    url: '',
    tags: JSON.stringify([
      'fish',
      'seafood',
      'traditional',
      'comfort',
      'dinner',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Hangikjöt',
    description:
      'Smoked lamb - a traditional Icelandic delicacy. Often served at Christmas with peas, potatoes, and brown sauce.',
    url: '',
    tags: JSON.stringify([
      'lamb',
      'smoked',
      'traditional',
      'christmas',
      'dinner',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Harðfiskur',
    description:
      'Dried fish (usually cod or haddock) served with butter. A traditional Icelandic staple and snack.',
    url: '',
    tags: JSON.stringify([
      'fish',
      'dried',
      'traditional',
      'snack',
      'appetizer',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Rúgbrauð',
    description:
      'Traditional Icelandic dark rye bread, often baked in geothermal springs. Sweet and dense, served with butter.',
    url: '',
    tags: JSON.stringify(['bread', 'traditional', 'sides', 'christmas']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kleinur',
    description:
      'Traditional Icelandic twisted donuts. A classic pastry often enjoyed with coffee or as a snack.',
    url: '',
    tags: JSON.stringify([
      'dessert',
      'pastry',
      'traditional',
      'snack',
      'christmas',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Skyr',
    description:
      'Icelandic yogurt - thick, creamy, and high in protein. Served with berries, honey, or granola.',
    url: '',
    tags: JSON.stringify(['breakfast', 'dairy', 'healthy', 'dessert', 'snack']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Lambasulta',
    description:
      'Lamb head cheese - a traditional Icelandic dish. Served sliced with potatoes and pickled beets.',
    url: '',
    tags: JSON.stringify(['lamb', 'traditional', 'offal', 'dinner']),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Hrútspungar',
    description:
      "Pickled ram's testicles - a traditional Icelandic delicacy. Usually served as a starter with bread.",
    url: '',
    tags: JSON.stringify(['lamb', 'traditional', 'offal', 'appetizer']),
    stars: 2,
    curated: 1,
  },
  {
    title: 'Fiskekaker',
    description:
      'Icelandic fish cakes made with cod or haddock, potatoes, and herbs. Pan-fried and served with vegetables.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'traditional', 'dinner']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Steikur',
    description:
      'Icelandic steak - typically lamb or beef, simply prepared with salt and pepper. Served with potatoes and gravy.',
    url: '',
    tags: JSON.stringify(['lamb', 'beef', 'roast', 'dinner', 'sunday']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kjötbagar',
    description:
      'Icelandic meat pastries - ground lamb wrapped in dough and baked. A popular comfort food.',
    url: '',
    tags: JSON.stringify(['lamb', 'pastry', 'comfort', 'dinner', 'baked']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Svið',
    description:
      "Singed sheep's head - a traditional Icelandic dish. Served with potatoes and pickled cabbage.",
    url: '',
    tags: JSON.stringify(['lamb', 'traditional', 'offal', 'dinner']),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Línar súpa',
    description:
      'Creamy potato leek soup. Simple, comforting, and perfect for cold days.',
    url: '',
    tags: JSON.stringify(['soup', 'vegetarian', 'comfort', 'dinner', 'winter']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Blue Soup',
    description:
      'Traditional Icelandic bilberry soup. Made with wild blueberries, served hot or cold with cream.',
    url: '',
    tags: JSON.stringify([
      'dessert',
      'soup',
      'traditional',
      'berries',
      'summer',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Vínarterta',
    description:
      'Icelandic layer cake with chocolate filling and whipped cream. A birthday favorite.',
    url: '',
    tags: JSON.stringify(['dessert', 'cake', 'birthday', 'chocolate']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Kanilsnúðar',
    description:
      'Cinnamon rolls Icelandic style - soft, fluffy, and covered in icing. A beloved bakery treat.',
    url: '',
    tags: JSON.stringify(['dessert', 'pastry', 'baking', 'snack', 'coffee']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Sausages & beans',
    description:
      'Icelandic style baked beans with sausages. A classic comfort dinner, often served with rye bread.',
    url: '',
    tags: JSON.stringify(['comfort', 'dinner', 'quick', 'pork']),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Gnocchi með rósmarín',
    description:
      'Homemade potato gnocchi with rosemary butter. A simple but satisfying Italian-Icelandic fusion.',
    url: '',
    tags: JSON.stringify([
      'pasta',
      'potato',
      'comfort',
      'dinner',
      'vegetarian',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'F元宵',
    description:
      "Lamb and potato stew - Iceland's answer to Irish stew. Slow-cooked and incredibly comforting.",
    url: '',
    tags: JSON.stringify([
      'lamb',
      'stew',
      'traditional',
      'comfort',
      'dinner',
      'winter',
    ]),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Grjónagrautur',
    description:
      'Rice porridge - a traditional Icelandic breakfast. Served with sugar, cinnamon, and milk.',
    url: '',
    tags: JSON.stringify(['breakfast', 'porridge', 'traditional', 'comfort']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Hirsegrautur',
    description:
      'Millet porridge - a healthy traditional Icelandic breakfast grain.',
    url: '',
    tags: JSON.stringify(['breakfast', 'porridge', 'traditional', 'healthy']),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Skúffukaka',
    description:
      'Icelandic chocolate traybake - gooey chocolate cake with coconut. A popular bake sale treat.',
    url: '',
    tags: JSON.stringify(['dessert', 'cake', 'baking', 'chocolate']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Eplakaka',
    description:
      'Icelandic apple cake - spiced apple cake topped with cinnamon sugar. Served warm with cream.',
    url: '',
    tags: JSON.stringify(['dessert', 'cake', 'baking', 'apple', 'autumn']),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Pönnukökur',
    description:
      'Icelandic thin pancakes. Served with sugar, berries, or whipped cream. A family favorite.',
    url: '',
    tags: JSON.stringify(['dessert', 'pancakes', 'traditional', 'breakfast']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Saltkjöt & baunir',
    description:
      'Salt-cured lamb with peas and potatoes. A traditional Sunday dinner.',
    url: '',
    tags: JSON.stringify([
      'lamb',
      'traditional',
      'sunday',
      'dinner',
      'christmas',
    ]),
    stars: 4,
    curated: 1,
  },
  {
    title: 'Kálakókur',
    description:
      'Cabbage cakes - traditional Icelandic vegetarian dish with cabbage, potatoes, and herbs.',
    url: '',
    tags: JSON.stringify(['vegetarian', 'traditional', 'vegetables', 'dinner']),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Brennivín & sild',
    description:
      'Cured herring with brennivín (Icelandic spirit). Traditional shot or appetizer.',
    url: '',
    tags: JSON.stringify([
      'fish',
      'appetizer',
      'traditional',
      'christmas',
      'alcohol',
    ]),
    stars: 3,
    curated: 1,
  },
  {
    title: 'Lax með kartöflum',
    description:
      'Pan-seared salmon with potatoes. Simple, healthy, and delicious Icelandic home cooking.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'healthy', 'dinner', 'quick']),
    stars: 5,
    curated: 1,
  },
  {
    title: 'Fiskur í grænmetisósa',
    description:
      'Fish in vegetable sauce - cod or haddock baked with tomatoes, peppers, and onions.',
    url: '',
    tags: JSON.stringify(['fish', 'seafood', 'baked', 'dinner', 'healthy']),
    stars: 4,
    curated: 1,
  },
]

async function seed() {
  console.log('Seeding Icelandic recipes...')

  for (const recipe of icelandicRecipes) {
    await db.insert(recipeLinks).values({
      id: crypto.randomUUID(),
      userId: 'system-curated',
      ...recipe,
      createdAt: new Date(),
    })
  }

  console.log(`Seeded ${icelandicRecipes.length} Icelandic recipes`)
}

seed()
