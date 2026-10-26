// Probe guard, not a general security sandbox. No live network is needed here.
'use strict';
const deny = () => { throw new Error('This research probe forbids network connections'); };
require('node:net').Socket.prototype.connect = deny;
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) {
  require('node:dns')[name] = deny;
}
