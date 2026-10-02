import { CategoryDefinition } from '../types/game';

// Clean SVG illustration generator for reliable hermetic vector cards with glossy card finish
function createItemSvg(emoji: string, bg1: string, bg2: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
      <radialGradient id="gloss" cx="30%" cy="20%" r="60%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.32"/>
      </filter>
    </defs>
    <!-- Background Card -->
    <rect width="400" height="400" rx="40" fill="url(#grad)" />
    <!-- Gloss Overlay -->
    <rect width="400" height="400" rx="40" fill="url(#gloss)" />
    <!-- Subtle Pattern Circles -->
    <circle cx="80" cy="80" r="110" fill="#ffffff" opacity="0.08" />
    <circle cx="340" cy="340" r="130" fill="#ffffff" opacity="0.06" />
    <circle cx="200" cy="180" r="105" fill="#000000" opacity="0.1" filter="url(#shadow)" />
    <!-- Center Emoji Icon -->
    <text x="200" y="215" font-size="125" text-anchor="middle" dominant-baseline="central" filter="url(#shadow)">${emoji}</text>
    <!-- Card Label Footer Bar -->
    <rect x="40" y="315" width="320" height="54" rx="27" fill="#171717" opacity="0.85" filter="url(#shadow)" />
    <text x="200" y="347" font-family="'Cairo', system-ui, sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="1">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'food',
    nameAr: 'أكل ومأكولات',
    nameEn: 'Food & Meals',
    icon: '🍔',
    descriptionAr: 'بيتزا، برجر، سوشي، حلويات، وأطباق شهية',
    descriptionEn: 'Pizza, burger, sushi, sweets, and dishes',
    suggestedQuestionsAr: [
      'هل هي أكل؟',
      'هل تؤكل ساخنة؟',
      'هل هي وجبة سريعة (Fast Food)؟',
      'هل تحتوي على جبنة؟',
      'هل هي حلوة أو سكريات؟',
      'هل تحتوي على خبز؟',
      'هل هي فاكهة؟',
    ],
    suggestedQuestionsEn: [
      'Is it food?',
      'Is it eaten hot?',
      'Is it fast food?',
      'Does it contain cheese?',
      'Is it sweet or dessert?',
      'Does it contain bread?',
    ],
    presetItems: [
      { id: 'f-pizza', nameAr: 'بيتزا', nameEn: 'Pizza', category: 'food', imageUrl: createItemSvg('🍕', '#d97706', '#92400e', 'PIZZA · بيتزا') },
      { id: 'f-burger', nameAr: 'برجر', nameEn: 'Burger', category: 'food', imageUrl: createItemSvg('🍔', '#b45309', '#78350f', 'BURGER · برجر') },
      { id: 'f-sushi', nameAr: 'سوشي', nameEn: 'Sushi', category: 'food', imageUrl: createItemSvg('🍣', '#047857', '#065f46', 'SUSHI · سوشي') },
      { id: 'f-apple', nameAr: 'تفاحة', nameEn: 'Apple', category: 'food', imageUrl: createItemSvg('🍎', '#dc2626', '#991b1b', 'APPLE · تفاحة') },
      { id: 'f-cake', nameAr: 'كيك', nameEn: 'Cake', category: 'food', imageUrl: createItemSvg('🍰', '#db2777', '#9d174d', 'CAKE · كيك') },
      { id: 'f-donut', nameAr: 'دونات', nameEn: 'Donut', category: 'food', imageUrl: createItemSvg('🍩', '#e11d48', '#be123c', 'DONUT · دونات') },
      { id: 'f-pasta', nameAr: 'باستا', nameEn: 'Pasta', category: 'food', imageUrl: createItemSvg('🍝', '#ca8a04', '#a16207', 'PASTA · باستا') },
      { id: 'f-chicken', nameAr: 'فراخ مقلية', nameEn: 'Fried Chicken', category: 'food', imageUrl: createItemSvg('🍗', '#d97706', '#92400e', 'CHICKEN · فراخ') },
      { id: 'f-taco', nameAr: 'تاكو', nameEn: 'Taco', category: 'food', imageUrl: createItemSvg('🌮', '#f59e0b', '#d97706', 'TACO · تاكو') },
    ],
  },
  {
    id: 'animals',
    nameAr: 'حيوانات وكائنات',
    nameEn: 'Animals & Wildlife',
    icon: '🐾',
    descriptionAr: 'أسد، نمر، قطة، فيل، وكائنات حية',
    descriptionEn: 'Lion, tiger, cat, elephant, and creatures',
    suggestedQuestionsAr: [
      'هل هو كائن حي؟',
      'هل هو حيوان مفترس؟',
      'هل هو من الحيوانات الأليفة؟',
      'هل يعيش في الماء؟',
      'هل يمتلك 4 أرجل؟',
      'هل يطير؟',
      'هل حجمه أكبر من الإنسان؟',
    ],
    suggestedQuestionsEn: [
      'Is it alive?',
      'Is it a predator?',
      'Is it a domestic pet?',
      'Does it live in water?',
      'Does it have 4 legs?',
      'Can it fly?',
    ],
    presetItems: [
      { id: 'a-lion', nameAr: 'أسد', nameEn: 'Lion', category: 'animals', imageUrl: createItemSvg('🦁', '#b45309', '#78350f', 'LION · أسد') },
      { id: 'a-tiger', nameAr: 'نمر', nameEn: 'Tiger', category: 'animals', imageUrl: createItemSvg('🐯', '#ea580c', '#c2410c', 'TIGER · نمر') },
      { id: 'a-cat', nameAr: 'قطة', nameEn: 'Cat', category: 'animals', imageUrl: createItemSvg('🐱', '#5B4DFF', '#3730a3', 'CAT · قطة') },
      { id: 'a-dog', nameAr: 'كلب', nameEn: 'Dog', category: 'animals', imageUrl: createItemSvg('🐶', '#2563eb', '#1d4ed8', 'DOG · كلب') },
      { id: 'a-elephant', nameAr: 'فيل', nameEn: 'Elephant', category: 'animals', imageUrl: createItemSvg('🐘', '#475569', '#1e293b', 'ELEPHANT · فيل') },
      { id: 'a-giraffe', nameAr: 'زرافة', nameEn: 'Giraffe', category: 'animals', imageUrl: createItemSvg('🦒', '#d97706', '#92400e', 'GIRAFFE · زرافة') },
      { id: 'a-panda', nameAr: 'باندا', nameEn: 'Panda', category: 'animals', imageUrl: createItemSvg('🐼', '#334155', '#0f172a', 'PANDA · باندا') },
      { id: 'a-dolphin', nameAr: 'دلفين', nameEn: 'Dolphin', category: 'animals', imageUrl: createItemSvg('🐬', '#0284c7', '#0369a1', 'DOLPHIN · دلفين') },
    ],
  },
  {
    id: 'cars',
    nameAr: 'سيارات ومركبات',
    nameEn: 'Cars & Vehicles',
    icon: '🚗',
    descriptionAr: 'سيارات رياضية، طائرات، دراجات، ومواصلات',
    descriptionEn: 'Sports cars, planes, bikes, and transport',
    suggestedQuestionsAr: [
      'هل هي سيارة رياضية؟',
      'هل تطير في الجو؟',
      'هل لها عجلتان فقط؟',
      'هل تسير على قضبان أو ماء؟',
      'هل هي مركبة طوارئ؟',
    ],
    suggestedQuestionsEn: [
      'Is it a supercar?',
      'Does it fly?',
      'Does it have 2 wheels?',
      'Is it on rails or water?',
    ],
    presetItems: [
      { id: 'c-ferrari', nameAr: 'فيراري', nameEn: 'Ferrari', category: 'cars', imageUrl: createItemSvg('🏎️', '#dc2626', '#991b1b', 'FERRARI · فيراري') },
      { id: 'c-police', nameAr: 'سيارة شرطة', nameEn: 'Police Car', category: 'cars', imageUrl: createItemSvg('🚓', '#1d4ed8', '#1e3a8a', 'POLICE · شرطة') },
      { id: 'c-plane', nameAr: 'طائرة', nameEn: 'Airplane', category: 'cars', imageUrl: createItemSvg('✈️', '#0284c7', '#0369a1', 'AIRPLANE · طائرة') },
      { id: 'c-bike', nameAr: 'دراجة هوائية', nameEn: 'Bicycle', category: 'cars', imageUrl: createItemSvg('🚲', '#16a34a', '#15803d', 'BICYCLE · دراجة') },
      { id: 'c-moto', nameAr: 'دراجة نارية', nameEn: 'Motorcycle', category: 'cars', imageUrl: createItemSvg('🏍️', '#ea580c', '#c2410c', 'MOTOR · موتور') },
      { id: 'c-boat', nameAr: 'قارب سريع', nameEn: 'Boat', category: 'cars', imageUrl: createItemSvg('🚤', '#0891b2', '#0e7490', 'BOAT · قارب') },
    ],
  },
  {
    id: 'gaming',
    nameAr: 'ألعاب وفيديو جيمز',
    nameEn: 'Games & Gaming',
    icon: '🎮',
    descriptionAr: 'ماريو، ماين كرافت، أجهزة تحكم، وشخصيات',
    descriptionEn: 'Mario, Minecraft, controllers, and game icons',
    suggestedQuestionsAr: [
      'هل هي شخصية من ألعاب الفيديو؟',
      'هل تنتمي لشركة نينتندو؟',
      'هل تنتمي لماين كرافت؟',
      'هل هو جهاز أو يد تحكم؟',
    ],
    suggestedQuestionsEn: [
      'Is it a game character?',
      'Is it from Nintendo?',
      'Is it from Minecraft?',
      'Is it a game controller?',
    ],
    presetItems: [
      { id: 'g-controller', nameAr: 'يد تحكم', nameEn: 'Game Controller', category: 'gaming', imageUrl: createItemSvg('🎮', '#5B4DFF', '#3730a3', 'CONTROLLER · يد') },
      { id: 'g-mario', nameAr: 'ماريو', nameEn: 'Super Mario', category: 'gaming', imageUrl: createItemSvg('🍄', '#dc2626', '#991b1b', 'MARIO · ماريو') },
      { id: 'g-creeper', nameAr: 'كريبر ماين كرافت', nameEn: 'Minecraft Creeper', category: 'gaming', imageUrl: createItemSvg('🟩', '#15803d', '#14532d', 'CREEPER · كريبر') },
      { id: 'g-pikachu', nameAr: 'بيكاتشو', nameEn: 'Pikachu', category: 'gaming', imageUrl: createItemSvg('⚡', '#eab308', '#ca8a04', 'PIKACHU · بيكاتشو') },
      { id: 'g-arcade', nameAr: 'أركيد', nameEn: 'Arcade', category: 'gaming', imageUrl: createItemSvg('🕹️', '#FF4B82', '#9d174d', 'ARCADE · أركيد') },
    ],
  },
  {
    id: 'movies',
    nameAr: 'أفلام وشخصيات',
    nameEn: 'Movies & Characters',
    icon: '🎬',
    descriptionAr: 'سبايدرمان، باتمان، هاري بوتر، وشخصيات سينمائية',
    descriptionEn: 'Spider-Man, Batman, Harry Potter, and movie stars',
    suggestedQuestionsAr: [
      'هل هو بطل خارق (Superhero)؟',
      'هل يرتدي قناعاً؟',
      'هل ينتمي لعالم مارفل أو دي سي؟',
      'هل هو شخصية سحرية؟',
    ],
    suggestedQuestionsEn: [
      'Is it a superhero?',
      'Does it wear a mask?',
      'Is it Marvel or DC?',
      'Is it magical?',
    ],
    presetItems: [
      { id: 'm-spiderman', nameAr: 'سبايدرمان', nameEn: 'Spider-Man', category: 'movies', imageUrl: createItemSvg('🕷️', '#dc2626', '#1d4ed8', 'SPIDERMAN · بطل') },
      { id: 'm-batman', nameAr: 'باتمان', nameEn: 'Batman', category: 'movies', imageUrl: createItemSvg('🦇', '#171717', '#334155', 'BATMAN · باتمان') },
      { id: 'm-wizard', nameAr: 'هاري بوتر', nameEn: 'Harry Potter', category: 'movies', imageUrl: createItemSvg('🧙‍♂️', '#ca8a04', '#78350f', 'WIZARD · ساحر') },
      { id: 'm-clapper', nameAr: 'كاميرا سينما', nameEn: 'Clapperboard', category: 'movies', imageUrl: createItemSvg('🎬', '#171717', '#475569', 'CINEMA · سينما') },
    ],
  },
  {
    id: 'tech',
    nameAr: 'تكنولوجيا وأجهزة',
    nameEn: 'Technology & Devices',
    icon: '📱',
    descriptionAr: 'هواتف، لابتوبات، سماعات، وروبوتات',
    descriptionEn: 'Phones, laptops, headphones, and robots',
    suggestedQuestionsAr: [
      'هل يمكن حمله في الجيب؟',
      'هل يحتوي على شاشة لمس؟',
      'هل يوضع على الأذن أو الرأس؟',
      'هل هو روبوت؟',
    ],
    suggestedQuestionsEn: [
      'Can it fit in a pocket?',
      'Does it have a touchscreen?',
      'Is it worn on ears?',
      'Is it a robot?',
    ],
    presetItems: [
      { id: 't-phone', nameAr: 'هاتف ذكي', nameEn: 'Smartphone', category: 'tech', imageUrl: createItemSvg('📱', '#0284c7', '#0369a1', 'PHONE · هاتف') },
      { id: 't-laptop', nameAr: 'لابتوب', nameEn: 'Laptop', category: 'tech', imageUrl: createItemSvg('💻', '#475569', '#1e293b', 'LAPTOP · لابتوب') },
      { id: 't-headphones', nameAr: 'سماعات رأس', nameEn: 'Headphones', category: 'tech', imageUrl: createItemSvg('🎧', '#5B4DFF', '#3730a3', 'HEADPHONES · سماعة') },
      { id: 't-robot', nameAr: 'روبوت', nameEn: 'Robot', category: 'tech', imageUrl: createItemSvg('🤖', '#4338ca', '#312e81', 'ROBOT · روبوت') },
    ],
  },
  {
    id: 'objects',
    nameAr: 'أدوات وأشياء يومية',
    nameEn: 'Everyday Objects',
    icon: '🏠',
    descriptionAr: 'نظارة، مظلة، ساعة، جيتار، وأشياء مألوفة',
    descriptionEn: 'Glasses, umbrella, clock, guitar, and items',
    suggestedQuestionsAr: [
      'هل تُستخدم داخل المنزل؟',
      'هل تُلبس على الوجه أو الجسم؟',
      'هل هي آلة موسيقية؟',
      'هل تُستخدم لمعرفة الوقت؟',
    ],
    suggestedQuestionsEn: [
      'Used at home?',
      'Worn on face or body?',
      'Is it a musical instrument?',
      'Does it tell time?',
    ],
    presetItems: [
      { id: 'o-glasses', nameAr: 'نظارة شمسية', nameEn: 'Sunglasses', category: 'objects', imageUrl: createItemSvg('🕶️', '#334155', '#0f172a', 'GLASSES · نظارة') },
      { id: 'o-umbrella', nameAr: 'مظلة', nameEn: 'Umbrella', category: 'objects', imageUrl: createItemSvg('☂️', '#FF4B82', '#be185d', 'UMBRELLA · مظلة') },
      { id: 'o-clock', nameAr: 'ساعة منبه', nameEn: 'Alarm Clock', category: 'objects', imageUrl: createItemSvg('⏰', '#dc2626', '#991b1b', 'CLOCK · ساعة') },
      { id: 'o-guitar', nameAr: 'جيتار', nameEn: 'Guitar', category: 'objects', imageUrl: createItemSvg('🎸', '#d97706', '#92400e', 'GUITAR · جيتار') },
    ],
  },
  {
    id: 'sports',
    nameAr: 'رياضة وألعاب بدنية',
    nameEn: 'Sports & Athletics',
    icon: '⚽',
    descriptionAr: 'كرة قدم، كرة سلة، تنس، ومعدات رياضية',
    descriptionEn: 'Football, basketball, tennis, and gear',
    suggestedQuestionsAr: [
      'هل تُستخدم فيها كرة؟',
      'هل هي رياضة جماعية؟',
      'هل تمارس في الماء؟',
      'هل تُستخدم فيها مضارب؟',
    ],
    suggestedQuestionsEn: [
      'Does it use a ball?',
      'Is it a team sport?',
      'Is it played in water?',
      'Does it use rackets?',
    ],
    presetItems: [
      { id: 's-football', nameAr: 'كرة قدم', nameEn: 'Football', category: 'sports', imageUrl: createItemSvg('⚽', '#16a34a', '#166534', 'FOOTBALL · كرة') },
      { id: 's-basketball', nameAr: 'كرة سلة', nameEn: 'Basketball', category: 'sports', imageUrl: createItemSvg('🏀', '#ea580c', '#9a3412', 'BASKETBALL · سلة') },
      { id: 's-tennis', nameAr: 'تنس', nameEn: 'Tennis', category: 'sports', imageUrl: createItemSvg('🎾', '#65a30d', '#4d7c0f', 'TENNIS · تنس') },
      { id: 's-boxing', nameAr: 'ملاكمة', nameEn: 'Boxing', category: 'sports', imageUrl: createItemSvg('🥊', '#dc2626', '#991b1b', 'BOXING · ملاكمة') },
    ],
  },
];

/**
 * Neutral round "category": players pick ANY picture (live search, upload or paste).
 * There are no suggested items. The old CATEGORIES (and their presetItems) are kept only as the
 * pool the AI bot picks its own picture from.
 */
export const GENERAL_CATEGORY: CategoryDefinition = {
  id: 'general',
  nameAr: 'أي شيء',
  nameEn: 'Anything',
  icon: '🎯',
  descriptionAr: 'اختر أي صورة تحبها',
  descriptionEn: 'Pick any picture you like',
  presetItems: [],
  // Only the AI bot uses these: generic yes/no questions that fit any picture.
  suggestedQuestionsAr: [
    'هل هو كائن حي؟',
    'هل بتستخدمه كل يوم؟',
    'هل هو أكبر من حجم الكف؟',
    'هل هو موجود في البيت؟',
    'هل هو متحرك أو بيتحرك؟',
    'هل ممكن تشوفه في الشارع؟',
    'هل هو غالي الثمن؟',
    'هل له لون واحد غالب؟',
    'هل بيشتغل بالكهرباء؟',
    'هل هو مشهور عالميًا؟',
  ],
  suggestedQuestionsEn: [
    'Is it a living thing?',
    'Do you use it every day?',
    'Is it bigger than a hand?',
    'Can it be found in a house?',
    'Does it move?',
    'Can you see it on the street?',
    'Is it expensive?',
    'Does it have one main color?',
    'Does it use electricity?',
    'Is it world famous?',
  ],
};
