// Security: the app fetches pages the user pastes (used-part listings) and news feeds. Never let
// those requests reach the user's own computer or home/office network (routers, printers, NAS...).
const net = require('node:net');
const dns = require('node:dns');

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return false;
}

function privateName(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return h === 'localhost' || /\.(localhost|local|internal|lan|home|intranet|corp)$/.test(h) || !h.includes('.') || privateIp(h);
}

/** Throws when the URL points at a local or private address (checked by name and by DNS). */
async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Bad URL');
  if (u.username || u.password) throw new Error('Bad URL');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (privateName(host)) throw new Error('Local network addresses are not allowed');
  if (!net.isIP(host)) {
    const addrs = await dns.promises.lookup(host, { all: true }).catch(() => []);
    if (addrs.some((a) => privateIp(a.address))) throw new Error('Local network addresses are not allowed');
  }
}

module.exports = { assertPublicUrl, privateName, privateIp };
