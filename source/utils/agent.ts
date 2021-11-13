import createProxyAgent from 'simple-proxy-agent'

const proxyUrl = process.env.SOCKS_SERVER
export const agent = (proxyUrl === undefined) ? undefined : createProxyAgent(`socks://${proxyUrl}`)
