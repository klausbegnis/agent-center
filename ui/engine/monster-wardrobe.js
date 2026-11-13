// The humanoids' shared wardrobe: outfits, which are rules (see monster-outfit.js) so they fit
// every torso and legs, and headgear, drawn on the 10-pixel-wide head grid and placed on the
// head's corner with `at`. Original drawings.

const outfit = (rules) => ({ slot: 'outfit', outfit: rules })
const headgear = (at, rows) => ({ slot: 'headgear', rows, at })

export const OUTFIT_PARTS = {
  rags: outfit({
    chest: 'cloth', arms: 'cloth', sleeves: 1, legs: 'cloth', legRows: 2,
    texture: 'rags', textured: 'cloth', belt: 'leather'
  }),
  leather: outfit({
    chest: 'leather', arms: 'leather', sleeves: 2, legs: 'cloth', legRows: 4, feet: 'leather',
    texture: 'studs', textured: 'leather', belt: 'dark'
  }),
  chain: outfit({
    chest: 'metal', arms: 'metal', sleeves: 3, legs: 'cloth', legRows: 4, feet: 'leather',
    texture: 'chain', textured: 'metal', belt: 'leather'
  }),
  plate: outfit({
    chest: 'metal', arms: 'metal', sleeves: 99, hands: 'metal', legs: 'metal', legRows: 99,
    feet: 'metal', texture: 'plate', textured: 'metal', belt: 'leather'
  }),
  robe: outfit({
    chest: 'cloth', arms: 'cloth', sleeves: 99, legs: 'cloth', legRows: 99, skirt: 4,
    trim: 'accent', belt: 'leather'
  }),
  'cultist-robe': outfit({
    chest: 'cloth', arms: 'cloth', sleeves: 99, legs: 'cloth', legRows: 99, skirt: 5,
    hem: 'ragged', trim: 'accent', belt: 'dark'
  }),
  furs: outfit({
    chest: 'fur', arms: 'fur', sleeves: 1, legs: 'fur', legRows: 2, feet: 'leather', skirt: 2,
    hem: 'ragged', texture: 'fur', textured: 'fur', belt: 'leather'
  }),
  'bone-armour': outfit({
    chest: 'bone', arms: 'leather', sleeves: 2, legs: 'leather', legRows: 3, feet: 'leather',
    texture: 'ribs', textured: 'bone', collar: 'bone'
  }),
  'noble-coat': outfit({
    chest: 'cloth', arms: 'cloth', sleeves: 99, legs: 'leather', legRows: 99, feet: 'dark',
    skirt: 2, trim: 'accent', collar: 'accent'
  }),
  loincloth: outfit({ legs: 'cloth', legRows: 1, skirt: 2, hem: 'ragged', belt: 'leather' }),
  tabard: outfit({
    chest: 'cloth', arms: 'metal', sleeves: 99, legs: 'cloth', legRows: 2, feet: 'leather',
    skirt: 2, texture: 'chain', textured: 'metal', trim: 'accent', collar: 'metal', belt: 'leather'
  })
}

export const HEADGEAR_PARTS = {
  helm: headgear([0, 0], [
    '...mmmm...',
    '..mlmmmM..',
    '.mlmmmmMm.',
    '.Mm.mm.mM.'
  ]),
  'horned-helm': headgear([0, -2], [
    'B........B',
    'bb......bb',
    '.bbmmmmbb.',
    '..mlmmmM..',
    '.mlmmmmMm.',
    '.Mm.mm.mM.'
  ]),
  hood: headgear([0, -1], [
    '...cccc...',
    '..cccccc..',
    '.cCccccCc.',
    '.cC....Cc.',
    '.cC....Cc.',
    'cC......Cc',
    'cC......Cc',
    'C........C'
  ]),
  cowl: headgear([0, -3], [
    '....c.....',
    '....cc....',
    '...cCcc...',
    '..cccccc..',
    '.cCppppCc.',
    '.cC....Cc.',
    '.cC....Cc.',
    'cC......Cc',
    'cC......Cc',
    'C........C'
  ]),
  crown: headgear([0, -2], [
    '..a.aa.a..',
    '..aaaaaa..',
    '..AeAAeA..'
  ]),
  bandana: headgear([0, 1], [
    '...aaaa...',
    '..aaaaaaa.',
    '..AAAAAAaa',
    '.........a'
  ]),
  'skull-mask': headgear([0, 2], [
    '..bbbbbb..',
    '..bebbeb..',
    '..bbBBbb..',
    '...bppb...'
  ]),
  feathers: headgear([0, -3], [
    '.......a..',
    '......aAc.',
    '.....aAcC.',
    '....cAc...',
    '..wwwwww..'
  ]),
  'pointed-hat': headgear([0, -5], [
    '......c...',
    '.....cC...',
    '....ccC...',
    '...cccC...',
    '...ccccC..',
    '..aaaaaaa.',
    'cccccccccC'
  ])
}
