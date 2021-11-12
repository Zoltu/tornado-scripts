import { promises as filesystem } from 'fs'

const assert = require('assert')
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const buildGroth16 = require('websnark/src/groth16')
const circuit = require('./circuit.json')
const merkleTree = require('./lib/MerkleTree')
const websnarkUtils = require('websnark/src/utils')

/** Generate random number of specified byte length */
export const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

/** Compute pedersen hash */
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

/** BigNumber to hex string of specified length */
export function toHex(number, length = 32) {
	const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16)
	return '0x' + str.padStart(length * 2, '0')
}

/**
 * Create deposit object from secret and nullifier
 */
export function createDeposit({ nullifier, secret }) {
	const deposit = { nullifier, secret }
	deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
	deposit.commitment = pedersenHash(deposit.preimage)
	deposit.commitmentHex = toHex(deposit.commitment)
	deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
	deposit.nullifierHex = toHex(deposit.nullifierHash)
	return deposit
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
 export async function generateProof(getDepositEvents, isKnownRoot, isSpent, deposit, amount, recipient, relayerAddress = 0n, fee = 0n, refund = 0n) {
	 // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
	const groth16 = await buildGroth16()
	const proving_key = await filesystem.readFile(`${__dirname}/proving-key.bin`)

	// Compute merkle proof of our commitment
	const { root, path_elements, path_index } = await generateMerkleProof(getDepositEvents, isKnownRoot, isSpent, deposit, amount)

	// Prepare circuit input
	const input = {
		// Public snark inputs
		root: root,
		nullifierHash: deposit.nullifierHash,
		recipient: recipient,
		relayer: relayerAddress,
		fee: fee,
		refund: refund,

		// Private snark inputs
		nullifier: deposit.nullifier,
		secret: deposit.secret,
		pathElements: path_elements,
		pathIndices: path_index
	}

	console.log('Generating SNARK proof')
	console.time('Proof time')
	const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key.buffer)
	const { proof } = websnarkUtils.toSolidityInput(proofData)
	console.timeEnd('Proof time')

	return { proof, root }
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the tornado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(getDepositEvents, isKnownRoot, isSpent, deposit, amount) {
	let leafIndex = -1
	// Get all deposit events from smart contract and assemble merkle tree from them

	const cachedEvents = loadCachedEvents({ type: 'Deposit', amount })

	const startBlock = BigInt(cachedEvents.lastBlock) + 1n

	let rpcEvents = await getDepositEvents(startBlock)

	rpcEvents = rpcEvents.map(({ blockNumber, transactionHash, returnValues }) => {
		const { commitment, leafIndex, timestamp } = returnValues
		return {
			blockNumber,
			transactionHash,
			commitment,
			leafIndex: Number(leafIndex),
			timestamp
		}
	})

	const events = cachedEvents.events.concat(rpcEvents)
	for (let i = 1; i < events.length; ++i) {
		if (events[i].leafIndex !== events[i-1].leafIndex + 1) {
			await writeEventsToCache('deposit', amount, events.slice(0, i))
			throw new Error(`Missing index ${events[i-1].leafIndex + 1}.`)
		}
	}
	await writeEventsToCache('deposit', amount, events)
	console.log('events', events.length)

	console.log(`Building merkle tree...`)
	const leaves = events
		.sort((a, b) => a.leafIndex - b.leafIndex) // Sort events in chronological order
		.map((e, i, array) => {
			const index = e.leafIndex
			const commitment = BigInt(e.commitment)

			if (commitment === deposit.commitment) {
				leafIndex = index
			}
			return commitment.toString(10)
		})
	const tree = new merkleTree(20, leaves)

	// Validate that our data is correct
	const root = await tree.root()
	assert(await isKnownRoot(BigInt(root)) === true, 'Merkle tree is corrupted')
	assert(await isSpent(deposit.nullifierHash) === false, 'The note is already spent')
	assert(leafIndex >= 0, 'The deposit is not found in the tree')
	console.log(`... done.`)

	// Compute merkle proof of our commitment
	return tree.path(leafIndex)
}

function loadCachedEvents({ type, amount }) {
	try {
		const module = require(`${__dirname}/cache/${type.toLowerCase()}s_eth_${amount}.json`)
		if (module) {
			const events = module
			return { events, lastBlock: events[events.length - 1].blockNumber }
		}
	} catch (err) {
		throw new Error(`Method loadCachedEvents has error: ${err.message}`)
	}
}

async function writeEventsToCache(type, amount, events) {
	await filesystem.writeFile(`${__dirname}/cache/${type.toLowerCase()}s_eth_${amount}.json`, JSON.stringify(events, undefined, '\t'))
}
