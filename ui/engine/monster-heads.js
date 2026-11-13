// The heads of the goblin, orc, troll, ogre and human races, 10 by 8 pixels, facing the party. The skull sits in columns
// 2 to 7 from row 1, the eyes on row 3 or 4, the neck in the bottom row's middle, so headgear
// and every torso fit them all. Inks: `s S h` skin, `e` eyes, `p` dark, `b B` bone (tusks,
// teeth, horns), `r R` hair, `a` paint. Original drawings.

const head = (rows) => ({ slot: 'head', rows })

export const HEAD_PARTS = {
  'goblin-pointy': head([
    '..........',
    '...hsss...',
    'S.ssssss.S',
    'sSsessesSs',
    '.S.ssss.S.',
    '...sSSs...',
    '...pbbp...',
    '....ss....'
  ]),
  'goblin-warty': head([
    '..........',
    '...ssSs...',
    'SsshssSssS',
    '.Ssessess.',
    '..ssSSss..',
    '..sSssSs..',
    '...pbpp...',
    '....ss....'
  ]),
  'goblin-grin': head([
    '....rr....',
    '...rsss...',
    'S.ssssss.S',
    'sSsessesSs',
    '..sssSss..',
    '..pbbbbp..',
    '...pppp...',
    '....ss....'
  ]),

  'orc-tusked': head([
    '..........',
    '...ssss...',
    '..hsssss..',
    '.sSSSSSSs.',
    '.SsessesS.',
    '..bsSSsb..',
    '..bppppb..',
    '...ssss...'
  ]),
  'orc-scarred': head([
    '....rr....',
    '...rrrr...',
    '..hsssss..',
    '.sSSSpSSs.',
    '.SsesspsS.',
    '..ssSSss..',
    '..bpsspb..',
    '...ssss...'
  ]),
  'orc-topknot': head([
    '....rR....',
    '....rr....',
    '..hsrrss..',
    '.sSSSSSSs.',
    '.SsessesS.',
    '..ssSSss..',
    '..bppppb..',
    '...sSSs...'
  ]),

  'troll-long-nose': head([
    '...rRrr...',
    '..rrssrr..',
    '.Sssssssr.',
    'Ssesssess.',
    '.SssSSssS.',
    '...sSSs...',
    '..sppppsS.',
    '...ssss...'
  ]),
  'troll-tusked': head([
    '..rrrrrr..',
    '.rRrssrRr.',
    '.rssssssr.',
    'SsSessesSs',
    '..ssSSss..',
    '.bssSSssb.',
    '.bppppppb.',
    '...ssss...'
  ]),
  'troll-shaggy': head([
    '.r.rrrr.r.',
    '.rrRrrRrr.',
    'rRssssssRr',
    'rsseSSessr',
    'r.ssSSss.r',
    '.r.sSSs.r.',
    '..rppppr..',
    '...rssr...'
  ]),

  'ogre-dull': head([
    '..........',
    '...hsss...',
    '..ssssss..',
    '.Ssssssss.',
    'sSspsspsSs',
    '.SssSSssS.',
    '..spppps..',
    '...ssss...'
  ]),
  'ogre-underbite': head([
    '....rr....',
    '...rsss...',
    '..ssssss..',
    '.SSSSSSSS.',
    'sSspsspsSs',
    '..ssSSss..',
    '.Sbpbbpbs.',
    '..ssssss..'
  ]),

  'human-bearded': head([
    '...rrrr...',
    '..rrrrrr..',
    '..rhsssr..',
    '.SspsspsS.',
    '..ssSSss..',
    '..rsppsr..',
    '..rrrrrr..',
    '...rRRr...'
  ]),
  'human-shaven': head([
    '...rrrr...',
    '..rrrrRr..',
    '..rhsssr..',
    '.SspsspsS.',
    '..ssSSss..',
    '..ssppss..',
    '...ssss...',
    '...sSSs...'
  ]),
  'human-long-hair': head([
    '...rrrr...',
    '..rrrrrr..',
    '.rrhsssrr.',
    '.rspsspsr.',
    '.rssSSssr.',
    '.rssppssr.',
    '.rRssssRr.',
    '.R.sSSs.R.'
  ])
}
