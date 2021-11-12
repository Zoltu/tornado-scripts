declare module 'simple-proxy-agent' {
	import * as http from 'http'
	export default function createProxyAgent(proxy: string): http.Agent
}
