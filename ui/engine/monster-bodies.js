// Torsos (with arms) and legs of the three humanoid builds, in zone inks so any outfit fits
// them: `t T u` chest, `x X` arms, `n` hands, `y Y` legs, `z` feet, `o` a line drawn by hand.
// Each torso's top row meets the neck of every head, its bottom row the hips of every legs of
// its build; the hands sit where monster-rigs.js says. Original drawings.

const torso = (rig, rows) => ({ slot: 'torso', rigs: { [rig]: { rows } } })
const legs = (rig, rows) => ({ slot: 'legs', rigs: { [rig]: { rows } } })

export const BODY_PARTS = {
  'small-scrawny': torso('humanoid-small', [
    '..xttttx..',
    '.xxTttTxx.',
    '.x.tttt.x.',
    '.n.TttT.n.'
  ]),
  'small-potbelly': torso('humanoid-small', [
    '..xttttx..',
    '.xxtuttxx.',
    '.xttuttTx.',
    '.nTTttTTn.'
  ]),
  'small-hunched': torso('humanoid-small', [
    '.xxttttxx.',
    '.xXtuttXx.',
    '.x.tttT.x.',
    '.n.TTTT.n.'
  ]),
  'small-short': legs('humanoid-small', [
    '.yyyyyy.',
    '.yY..yY.',
    'zzz..zzz'
  ]),
  'small-bowed': legs('humanoid-small', [
    '.yyyyyy.',
    'yY....yY',
    'zz....zz'
  ]),

  'medium-lean': torso('humanoid-medium', [
    '..xxttttxx..',
    '.xxXtuttXxx.',
    '.xX.tutt.Xx.',
    '.xX.tttT.Xx.',
    '.xX.TttT.Xx.',
    '.nn.TTTT.nn.'
  ]),
  'medium-broad': torso('humanoid-medium', [
    '.xxxttttxxx.',
    'xxXttuttTXxx',
    'xX.ttuttT.Xx',
    'xX.ttttTT.Xx',
    'xX..TttT..Xx',
    'nn..TTTT..nn'
  ]),
  'medium-ribcage': torso('humanoid-medium', [
    '.xxttttttxx.',
    '.x.tpttpt.x.',
    '.x.tttttt.x.',
    '.x..pttp..x.',
    '.x...tt...x.',
    '.n..tttt..n.'
  ]),
  'medium-hunched': torso('humanoid-medium', [
    '.xxxttttxxx.',
    '.xXttuttTXx.',
    'xX.ttttTT.Xx',
    'xX..tttT..Xx',
    'X...TttT...X',
    'nn..TTTT..nn'
  ]),
  'medium-furred': torso('humanoid-medium', [
    '.xxrrrrrrxx.',
    'xxXrRrrRrXxx',
    'xX.trRRrt.Xx',
    'xX.tttttT.Xx',
    'xX..TttT..Xx',
    'nn..TTTT..nn'
  ]),
  'medium-scaled': torso('humanoid-medium', [
    '..xxttttxx..',
    '.xxXtbbtXxx.',
    '.xX.tBBt.Xx.',
    '.xX.tbbt.Xx.',
    '.xX.tBBT.Xx.',
    '.nn.TTTT.nn.'
  ]),
  'medium-straight': legs('humanoid-medium', [
    '..yyyyyy..',
    '..yyYyyY..',
    '..yY..yY..',
    '..yY..yY..',
    '.zzz..zzz.'
  ]),
  'medium-stance': legs('humanoid-medium', [
    '..yyyyyy..',
    '.yyY..yyY.',
    '.yY....yY.',
    '.yY....yY.',
    'zzz....zzz'
  ]),
  'medium-bony': legs('humanoid-medium', [
    '...yyyy...',
    '..yy..yy..',
    '..y....y..',
    '..yy..yy..',
    '.zzz..zzz.'
  ]),
  'medium-digitigrade': legs('humanoid-medium', [
    '..yyyyyy..',
    '.yyY..yyY.',
    '..yY..yY..',
    '.yY....yY.',
    'zzz....zzz'
  ]),

  'large-hulking': torso('humanoid-large', [
    '..xxxttttttxxx..',
    '.xxxXttuttttXxx.',
    'xxXX.ttuttTT.XXx',
    'xxX..tttttTT..Xx',
    'xxX..ttttTTT..Xx',
    'xX...TTttTTT...X',
    'nnn...TTTTT..nnn'
  ]),
  'large-potbelly': torso('humanoid-large', [
    '..xxxttttttxxx..',
    '.xxXXtttuttXXxx.',
    'xxX.ttttuuttT.Xx',
    'xX.tttttuutttT.X',
    'xX.ttttttttTTT.X',
    'xX..TTttttTTT..X',
    'nnn..TTTTTTT.nnn'
  ]),
  'large-stooped': torso('humanoid-large', [
    '.xxxxttttttxxxx.',
    'xxxXXttuttTXXxxx',
    'xxX..ttuttTT..Xx',
    'xX...tttttTT...X',
    'xX....tttTT....X',
    'xX....TTTTT....X',
    'nnn...TTTTT...nn'
  ]),
  'large-furred': torso('humanoid-large', [
    '..xxxrrrrrrxxx..',
    '.xxxXrRrrRrrXxx.',
    'xxXX.rrRRrrr.XXx',
    'xxX..trRRrtT..Xx',
    'xxX..ttttTTT..Xx',
    'xX...TTttTTT...X',
    'nnn...TTTTT..nnn'
  ]),
  'large-wolf': torso('humanoid-large', [
    '..rrrrrrrrrrrr..',
    '.rrRRrrttrrRRrr.',
    'rrR.rrttuttrr.Rr',
    'rR..rRttttRRr..R',
    'rR...rttttRr...R',
    'rR...RTttTRR...R',
    'nnn...TTTTT..nnn'
  ]),
  'large-thick': legs('humanoid-large', [
    '...yyyyyyyy...',
    '...yyyYYyyY...',
    '...yyY..yyY...',
    '...yyY..yyY...',
    '..zzzz..zzzz..'
  ]),
  'large-stance': legs('humanoid-large', [
    '...yyyyyyyy...',
    '..yyyY..yyyY..',
    '..yyY....yyY..',
    '.yyY......yyY.',
    'zzzz......zzzz'
  ]),
  'large-hooves': legs('humanoid-large', [
    '...yyyyyyyy...',
    '..yyyY..yyyY..',
    '...yY....yY...',
    '..yyY....yyY..',
    '..pp.p..pp.p..'
  ]),
  'large-wolf-legs': legs('humanoid-large', [
    '...rrrrrrrrr..',
    '..rrRR..rrRR..',
    '...rrR..rrR...',
    '..rrR....rrR..',
    '.zzzz....zzzz.'
  ]),
  'large-digitigrade': legs('humanoid-large', [
    '...yyyyyyyy...',
    '..yyyY..yyyY..',
    '...yyY..yyY...',
    '..yyY....yyY..',
    '.zzzz....zzzz.'
  ])
}
