const dns = require('node:dns');

function configureDns() {
  const servers = process.env.DNS_SERVERS
    ?.split(',')
    .map(server => server.trim())
    .filter(Boolean);

  if (servers?.length) {
    dns.setServers(servers);
  }
}

module.exports = configureDns;
