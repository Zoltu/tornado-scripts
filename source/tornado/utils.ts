import fetch from 'node-fetch'
import { bytesToUnsignedLittleEndian } from '../utils/bigint'
import { promptForStringUnion, withPrompt } from '../utils/script-helpers'
import { toUint8Array } from '../utils/typed-arrays'
import { assertNever } from '../utils/typescript'
import { agent } from '../utils/agent'

const DECIETH = 100_000_000_000_000_000n as const
const ETH = 1_000_000_000_000_000_000n as const
const DEKAETH = 10_000_000_000_000_000_000n as const
const HECTOETH = 100_000_000_000_000_000_000n as const

type Decieth = typeof DECIETH
type Eth = typeof ETH
type Dekaeth = typeof DEKAETH
type Hectoeth = typeof HECTOETH
type TornadoSize = Decieth | Eth | Dekaeth | Hectoeth

export type TornadoLabel = '0.1' | '1' | '10' | '100'

export const TORNADO_PROXY_ADDRESS = 0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31bn
const TORNADO_DECIETH_ADDRESS = 0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fcn
const TORNADO_ETH_ADDRESS = 0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936n
const TORNADO_DEKAETH_ADDRESS = 0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbFn
const TORNADO_HECTOETH_ADDRESS = 0xA160cdAB225685dA1d56aa342Ad8841c3b53f291n

const RELAYERS = [
	'http://eth.fsdhreu39jfk.com',
	'https://black-hardy.com',
	'https://eth.crelayer.xyz',
	'https://eth.maxstorn.xyz',
	'https://eth.reltor.su',
	'https://eth.t-relayer.com',
	'https://main-relayer.com',
	'https://main.gm777.xyz',
	'https://main.x-relayer.top',
	'https://mainnet-relayer.favorite-r.xyz',
	'https://mainnet-tornado.cheap-relayer.xyz',
	'https://mainnet-tornado.low-fee.xyz',
	'https://mainnet-tornado.relayernews.xyz',
	'https://mainnet.0x0relayer.xyz',
	'https://mainnet.firstrelayer.xyz',
	'https://relayer.wind-egg.com',
	'https://torn-city.com',
	'https://torn.relayersdao.finance',
	'https://torn.relayersdao.finance',
	'https://tornado.evmjunkie.xyz',
	'https://tornadocashdev-relayer.xyz',
	'https://tornima.xyz',
] as const

export async function promptForNoteSize() {
	return withPrompt(async prompt => {
		const valueAsString = await prompt(`💰 Note Size: `)
		assertTornadoLabel(valueAsString)
		return tornadoLabelToDetails(valueAsString)
	})
}

export async function promptForNote() {
	return withPrompt(async prompt => {
		const valueAsString = await prompt(`📝 Note: `)
		const match = /tornado-(?<currency>\w+)-(?<label>[\d.]+)-(?<netId>\d+)-0x(?<nullifier>[0-9a-fA-F]{62})(?<secret>[0-9a-fA-F]{62})/g.exec(valueAsString)
		if (!match) throw new Error(`That doesn't look like a note.`)

		const tornadoLabel = match.groups!['label']
		assertTornadoLabel(tornadoLabel)
		const { size, tornadoInstance } = tornadoLabelToDetails(tornadoLabel)
		const nullifier = bytesToUnsignedLittleEndian(toUint8Array(match.groups!['nullifier'], 32))
		const secret = bytesToUnsignedLittleEndian(toUint8Array(match.groups!['secret'], 32))
		return { size, tornadoLabel, tornadoInstance, nullifier, secret }
	})
}

export async function promptForRelayer() {
	const useRelayer = await promptForStringUnion(`🎭 Use Relayer (yes/no)?: `, ['yes', 'no'])
	switch (useRelayer) {
		case 'no': return undefined
		case 'yes':
			const testedRelayers: (typeof RELAYERS[number])[] = []
			while (testedRelayers.length !== RELAYERS.length) {
				const selectedRelayer = RELAYERS[Math.floor(Math.random() * RELAYERS.length)]
				if (testedRelayers.includes(selectedRelayer)) continue
				testedRelayers.push(selectedRelayer)
				console.log(`Testing relayer ${selectedRelayer}...`)
				const response = await fetch(`${selectedRelayer}/status`, { method: 'GET', agent })
				if (!response.ok) {
					console.log(`Relayer status GET failed with ${response.status}: ${response.statusText}`)
					continue
				}
				const tryGetBodyAsJson = async () => {
					try {
						return JSON.parse(await response.text()) as unknown
					} catch (error) {
						return undefined
					}
				}
				const body = await tryGetBodyAsJson()
				if (body === undefined) {
					console.log(`Relayer status returned non-JSON.`)
					continue
				}
				if (typeof body !== 'object' || body === null || Array.isArray(body) || !('tornadoServiceFee' in body)) {
					console.log(`Invalid status JSON from relayer.`)
					continue
				}
				if ((body as {tornadoServiceFee: number}).tornadoServiceFee > 0.5) {
					console.log(`Relayer fee too high (<0.5): ${(body as {tornadoServiceFee: number}).tornadoServiceFee}`)
					continue
				}
				return selectedRelayer
			}
			console.log(`No viable relayers found.`)
			process.exit(1)
		default: assertNever(useRelayer)
	}
}

export function sizeToLabel(size: TornadoSize): TornadoLabel {
	switch (size) {
		case DECIETH: return '0.1'
		case ETH: return '1'
		case DEKAETH: return '10'
		case HECTOETH: return '100'
		default: assertNever(size)
	}
}

function assertTornadoLabel(maybe: string): asserts maybe is TornadoLabel {
	if (maybe !== '0.1' && maybe !== '1' && maybe !== '10' && maybe !== '100') throw new Error(`Note size must be one of 0.1, 1, 10, or 100`)
}

function tornadoLabelToDetails(label: TornadoLabel) {
	switch (label) {
		case '0.1': return { size: DECIETH, tornadoInstance: TORNADO_DECIETH_ADDRESS }
		case '1': return { size: ETH, tornadoInstance: TORNADO_ETH_ADDRESS }
		case '10': return { size: DEKAETH, tornadoInstance: TORNADO_DEKAETH_ADDRESS }
		case '100': return { size: HECTOETH, tornadoInstance: TORNADO_HECTOETH_ADDRESS }
		default: assertNever(label)
	}
}
