import * as http from 'http'
import createProxyAgent from 'simple-proxy-agent'

const proxyUrl = process.env.SOCKS_SERVER
export const agent = (proxyUrl === undefined) ? new http.Agent() : createProxyAgent(`socks://${proxyUrl}`)
