import { TornadoLabel } from './utils'
import { MerkleTree } from './lib/MerkleTree'

export function rbigint(numberOfBytes: number): bigint

export function toHex(value: bigint | Buffer, length: number): `0x${string}`

interface Deposit {
	preimage: Buffer
	commitment: bigint
	commitmentHex: `0x${string}`
	nullifierHash: bigint
	nullifierHex: `0x${string}`
}
export function createDeposit(options: { nullifier: bigint, secret: bigint }): Deposit

interface ProofResult {
	proof: `0x${string}`
	root: `0x${string}`
}
type DepositEvent = {
	readonly blockNumber: number
	readonly transactionHash: `0x${string}`
	readonly returnValues: {
		readonly commitment: `0x${string}`
		readonly leafIndex: number
		readonly timestamp: string
	}
}
export function generateProof(
	merkleTree: MerkleTree,
	isSpent: (nullifierHash: bigint) => Promise<boolean>,
	deposit: {
		nullifierHash: bigint
		nullifier: bigint
		secret: bigint
		commitment: bigint
	},
	amount: TornadoLabel,
	recipient: bigint,
	relayerAddress: bigint,
	fee: bigint,
	refund: bigint,
): Promise<ProofResult>

export function generateMerkleTree(
	getDepositEvents: (lastBlockNumber: bigint) => Promise<readonly DepositEvent[]>,
	isKnownRoot: (root: bigint) => Promise<boolean>,
	amount: TornadoLabel,
): Promise<MerkleTree>