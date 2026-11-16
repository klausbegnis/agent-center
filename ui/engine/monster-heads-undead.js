// The heads of the undead and beast-blooded humanoid races (skeleton, zombie, vampire, werewolf,
// demon, lizard, minotaur), on the same 10 by 8 grid and with the same joints as
// monster-heads.js. Original drawings.

const head = (rows) => ({ slot: 'head', rows })

export const MONSTROUS_HEAD_PARTS = {
  'skull-plain': head([
    '..........',
    '...hsss...',
    '..ssssss..',
    '..spSSps..',
    '..ppsspp..',
    '...sppS...',
    '...pspS...',
    '....ss....'
  ]),
  'skull-cracked': head([
    '..........',
    '...hsps...',
    '..ssspss..',
    '..spSSps..',
    '..pesspe..',
    '...ssps...',
    '...pspS...',
    '....ss....'
  ]),
  'skull-horned': head([
    'b........b',
    'bb.hsss.bb',
    '.bssssssb.',
    '..sppSps..',
    '..pesspe..',
    '...sppS...',
    '...pspS...',
    '....ss....'
  ]),

  'zombie-slack': head([
    '...r.r....',
    '..rssss...',
    '..hssSss..',
    '.SsesSpsS.',
    '..sSSSss..',
    '..spppSs..',
    '...pbps...',
    '...sSSs...'
  ]),
  'zombie-stitched': head([
    '....r.r...',
    '...ssss...',
    '..hspSss..',
    '.SsespesS.',
    '..ssspss..',
    '..sppppS..',
    '...SssS...',
    '...sSSs...'
  ]),

  'vampire-widows-peak': head([
    '..rrrrrr..',
    '.rrrrrrrr.',
    '.rrhrrssr.',
    'SSsessesSS',
    '..ssSSss..',
    '..spbbps..',
    '...sbbs...',
    '...sSSs...'
  ]),
  'vampire-fanged': head([
    '...rrrr...',
    '..rrrrrr..',
    '.SrhsssrS.',
    'SSsessesSS',
    '..ssSSss..',
    '..spppps..',
    '...bppb...',
    '...sSSs...'
  ]),

  'wolf-snarl': head([
    '.R......R.',
    '.rR....Rr.',
    '.rrrrrrrr.',
    'rRrerrerRr',
    'RrrhsshrrR',
    '.rrsppsrr.',
    '..rbppbr..',
    '...rssr...'
  ]),
  'wolf-grizzled': head([
    'R........R',
    'rR......Rr',
    '.rRrrrrRr.',
    'rrrerrerrr',
    'rRrhsshrRr',
    'r.rsppsr.r',
    '..rsbbsr..',
    '...rRRr...'
  ]),

  'demon-horned': head([
    'b........b',
    'bB.ssss.Bb',
    '.bhsssssb.',
    '..SSSSSS..',
    '.SsessesS.',
    '..ssSSss..',
    '..spbbps..',
    '...sSSs...'
  ]),
  'demon-ram': head([
    '..........',
    '.bbssssbb.',
    'bBbhsssbBb',
    'bb.SSSS.bb',
    '.SsessesS.',
    '..ssSSss..',
    '..sppppS..',
    '...sSSs...'
  ]),

  'lizard-crested': head([
    '....aA....',
    '...aAas...',
    '..hssssS..',
    '.sesssseS.',
    '.ssssssss.',
    '..SSSSSS..',
    '..pbpbpp..',
    '...sSSs...'
  ]),
  'lizard-frilled': head([
    '..........',
    'a..ssss..a',
    'aAhssssSAa',
    'aAesSSseAa',
    '.ASsssssA.',
    '..sSSSSs..',
    '..ppbbpp..',
    '...sSSs...'
  ]),

  'bull-horned': head([
    'b........b',
    'bb......bb',
    '.bbhsssbb.',
    'SSssssssSS',
    '.SsessesS.',
    '..ssssss..',
    '..hSppSh..',
    '..sSSSSs..'
  ]),
  'bull-ringed': head([
    '..........',
    'bb......bb',
    '.bbrrrrbb.',
    'SssssssssS',
    '.SsessesS.',
    '..ssssss..',
    '..SpmmpS..',
    '..sSSSSs..'
  ])
}
