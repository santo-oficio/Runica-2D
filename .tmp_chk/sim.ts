import { createInitialState } from '../engine/state.js';
import { playTurn } from '../engine/rules.js';
import { readFileSync } from 'node:fs';
const screens = JSON.parse(readFileSync('db/screens-tier-5.json','utf8'));
const s = screens.find((x:any) => x.id === 'l5-s1');
const st = createInitialState(s);
console.log('start player', st.player, 'enemigo', st.enemies[0]!.pos);
for (let t = 0; t < 12 && !st.solved && !st.failed; t++) {
  const es = st.enemies[0]!;
  playTurn(st, 'LEFT');
  console.log('tras turno', t+1, 'player', st.player, 'enemigo', es.pos, 'stun', st.enemyStunnedTurns[0]);
}
console.log('solved', st.solved, 'failed', st.failed);
