import { bytesToUnsignedLittleEndian } from '../utils/bigint'
import { promptForStringUnion, withPrompt } from '../utils/script-helpers'
import { toUint8Array } from '../utils/typed-arrays'
import { assertNever } from '../utils/typescript'

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

export const TORNADO_PROXY_ADDRESS = 0x722122dF12D4e14e13Ac3b6895a86e84145b6967n
const TORNADO_DECIETH_ADDRESS = 0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fcn
const TORNADO_ETH_ADDRESS = 0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936n
const TORNADO_DEKAETH_ADDRESS = 0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbFn
const TORNADO_HECTOETH_ADDRESS = 0xA160cdAB225685dA1d56aa342Ad8841c3b53f291n

const RELAYERS = [
	'https://mainnet-v2.defidevotee.xyz',
	'https://mainnet-v2.torn.cash',
	'https://mainnet-relayer.hertz.zone',
	'https://mainnet-v2.therelayer.xyz',
	'https://mainnet.t-relay.online',
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
		case 'yes': return RELAYERS[Math.floor(Math.random() * RELAYERS.length)]
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
