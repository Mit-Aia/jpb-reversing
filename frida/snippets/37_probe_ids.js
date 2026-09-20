// Bone ids per grabbed body object (needs 30_grab_all.js first): do creatures sharing a node use DIFFERENT bone ids?
Object.values(globalThis.__objs).filter(o => o.nV > 10).forEach(o => {
  const res = ptr(o.res), w = i => res.add(i * 4).readU32(), nb = w(0), ids = [];
  for (let i = 0; i < nb; i++) ids.push(res.add(26 * 4 + w(26) + 0x68 - 26 * 4 + 0).add(i * 2).readU16());
  log("IDS obj=" + o.self + " res=" + o.res + " nb=" + nb + " ids=" + JSON.stringify(ids));
});
