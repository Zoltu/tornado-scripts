import fetch from 'node-fetch'
import { secp256k1, ethereum, keccak256 } from '@zoltu/ethereum-crypto'
import { encodeMethod } from '@zoltu/ethereum-abi-encoder'
import { main, promptForAddress, promptForEnterKey, promptForGasFees, promptForInteger, promptForPrivateKey, promptForStringUnion } from './utils/script-helpers'
import { createDeposit, generateProof, rbigint, toHex } from './tornado'
import { addressString, attoString, bytes32String, bytesToUnsigned, nanoString } from './utils/bigint'
import { EthereumClient, waitForReceipt } from './utils/ethereum-client'
import { promptForNote, promptForNoteSize, promptForRelayer, sizeToLabel, TORNADO_PROXY_ADDRESS } from './tornado/utils'
import { signTransaction } from './utils/ethereum'
import { TORNADO_PROXY_DEPOSIT_INPUT_PARAMETERS, TORNADO_PROXY_WITHDRAW_INPUT_PARAMETERS } from './tornado/tornadoProxyAbi'
import { assertIsHexString, assertProperty, assertPropertyWithType, parseAddress, serializeAddress, serializeBytes32, serializeData } from './utils/wire'
import { sleep } from './utils/node'
import { toHexString, toUint8Array } from './utils/typed-arrays'
import { assertNever } from './utils/typescript'
import { agent } from './utils/agent'

const ETHEREUM_JSON_RPC_ENDPOINT = 'http://host.docker.internal:8545'
// const ETHEREUM_JSON_RPC_ENDPOINT = 'http://localhost:8545'
const EXTRA_HEADERS = {}

const GET_LOGS_BATCH_SIZE = 10_000n

async function getMe() {
	const privateKey = await promptForPrivateKey()
	const publicKey = await secp256k1.privateKeyToPublicKey(privateKey)
	const address = await ethereum.publicKeyToAddress(publicKey)
	return { privateKey, publicKey, address }
}

async function printBalance(client: EthereumClient, name: string, address: bigint) {
	const balance = await client.getBalance(address)
	console.log(`${name} Balance: ${attoString(balance)} ETH`)
}

export async function deposit() {
	const client = new EthereumClient(ETHEREUM_JSON_RPC_ENDPOINT, EXTRA_HEADERS)
	const { size, tornadoInstance } = await promptForNoteSize()
	const me = await getMe()
	const { maxFeePerGas, maxPriorityFeePerGas } = await promptForGasFees()
	const count = await promptForInteger(`Number of Notes: `)

	for (let i = 0; i < count; ++i) {
		const deposit = createDeposit({ nullifier: rbigint(31), secret: rbigint(31) })
		const note = toHex(deposit.preimage, 62)
		const noteString = `tornado-eth-${sizeToLabel(size)}-1-${note}`
	
		console.log(`Your note: ${noteString}`)
		await printBalance(client, 'Tornado', tornadoInstance)
		await printBalance(client, 'Sender', me.address)
		
		// deposit(address _tornado, bytes32 _commitment, bytes _encryptedNote)
		const data = encodeMethod(0x13d98d13, TORNADO_PROXY_DEPOSIT_INPUT_PARAMETERS, [tornadoInstance, deposit.commitment, new Uint8Array(0)])
		const nonce = await client.getTransactionCount(me.address)
		const signedTransaction = await signTransaction(me.privateKey, {
			accessList: [],
			data,
			from: me.address,
			gasLimit: 1_000_000n,
			maxFeePerGas,
			maxPriorityFeePerGas,
			nonce,
			to: TORNADO_PROXY_ADDRESS,
			type: '1559',
			chainId: 1n,
			value: size,
		})
	
		console.log(`Depositing ${attoString(size)} ETH with ${nanoString(maxFeePerGas)} max fee and ${nanoString(maxPriorityFeePerGas)} priority fee.`)
		await promptForEnterKey()
		
		console.log('Submitting deposit transaction')
		const transactionHash = await client.sendSignedTransaction(signedTransaction)
		console.log(`Transaction Hash: 0x${bytes32String(transactionHash)}`)
		const receipt = await waitForReceipt(client, transactionHash)
		if (receipt.status !== 'success') throw new Error(`Receipt status indicates failure.`)
	
		await printBalance(client, 'Tornado', tornadoInstance)
		await printBalance(client, 'Sender', me.address)
	}
}

export async function withdraw(testOnly: boolean) {
	const client = new EthereumClient(ETHEREUM_JSON_RPC_ENDPOINT, EXTRA_HEADERS)
	const { size, tornadoLabel, tornadoInstance, nullifier, secret } = await promptForNote()
	const relayer = testOnly ? undefined : await promptForRelayer()
	const { nullifierHash, commitment } = createDeposit({ nullifier, secret })

	async function getDepositEvents(startBlock: bigint) {
		console.log(`Fetching deposit events...`)
		const { number: latestBlockNumber } = await client.getLatestBlock()
		const logs = []
		while (true) {
			const endBlock = startBlock + GET_LOGS_BATCH_SIZE - 1n >= latestBlockNumber ? 'latest' : startBlock + GET_LOGS_BATCH_SIZE - 1n
			console.log(`... up to block ${endBlock} ...`)
			// event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
			const newLogs = await client.getLogs(startBlock, endBlock, tornadoInstance, [ 0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196n ])
			logs.push(...newLogs.map(log => ({
				blockNumber: Number(log.blockNumber),
				transactionHash: serializeBytes32(log.transactionHash),
				returnValues: {
					commitment: serializeBytes32(log.topics[1]),
					leafIndex: Number(bytesToUnsigned(log.data.slice(0, 32))),
					timestamp: bytesToUnsigned(log.data.slice(32, 64)).toString(10),
				},
			})))
			if (endBlock === 'latest') break
			startBlock = endBlock + 1n
		}
		console.log(`... done.`)
		return logs
	}

	async function isKnownRoot(root: bigint) {
		const data = await encodeMethod(keccak256.hash, 'isKnownRoot(bytes32 _root)', [root])
		const result = await client.call({ data, to: tornadoInstance })
		return Boolean(bytesToUnsigned(result))
	}

	async function isSpent(nullifierHash: bigint) {
		const data = await encodeMethod(keccak256.hash, 'isSpent(bytes32 _nullifierHash)', [nullifierHash])
		const result = await client.call({ data, to: tornadoInstance })
		return Boolean(bytesToUnsigned(result))
	}

	async function getProof(recipientAddress: bigint, relayerAddress: bigint, fee: bigint) {
		const { proof, root } = await generateProof(getDepositEvents, isKnownRoot, isSpent, { nullifier, secret, nullifierHash, commitment }, tornadoLabel, recipientAddress, relayerAddress, fee, 0n)
		return { proof: toUint8Array(proof), root: BigInt(root) }
	}

	if (relayer === undefined) {
		const me = testOnly ? { address: 0n, privateKey: 1n, } : await getMe()
		const { maxFeePerGas, maxPriorityFeePerGas } = testOnly ? { maxFeePerGas: 1n, maxPriorityFeePerGas: 1n } : await promptForGasFees()
		const { proof, root } = await getProof(me.address, 0n, 0n)
		// withdraw(address _tornado, bytes _proof, bytes32 _root, bytes32 _nullifierHash, address _recipient, address _relayer, uint256 _fee, uint256 _refund)
		const data = encodeMethod(0xb438689f, TORNADO_PROXY_WITHDRAW_INPUT_PARAMETERS, [ tornadoInstance, proof, root, nullifierHash, me.address, 0n, 0n, 0n ])
		const nonce = await client.getTransactionCount(me.address)
		const signedTransaction = await signTransaction(me.privateKey, {
			type: '1559',
			chainId: 1n,
			accessList: [],
			data,
			from: me.address,
			gasLimit: 1_000_000n,
			maxFeePerGas,
			maxPriorityFeePerGas,
			nonce,
			to: TORNADO_PROXY_ADDRESS,
			value: 0n,
		})

		if (testOnly) {
			const result = await client.call(signedTransaction)
			console.log(`Call Result (0x usually means success): ${toHexString(result)}`)
		} else {
			console.log(`Withdrawing ${attoString(size)} ETH without a relayer to ${addressString(me.address)} with priority fee of ${nanoString(maxFeePerGas)} and a max fee of ${nanoString(maxPriorityFeePerGas)}`)
			await promptForEnterKey()
			const transactionHash = await client.sendSignedTransaction(signedTransaction)
			console.log(`Transaction Hash: 0x${bytes32String(transactionHash)}`)
			const receipt = await waitForReceipt(client, transactionHash)
			if (receipt.status !== 'success') throw new Error(`Receipt status indicates failure.`)
		}
	} else {
		function parseStatusBody(body: unknown) {
			if (typeof body !== 'object' || body === null) throw new Error(`Expected an object but got a ${typeof body}\n${body}`)
			assertPropertyWithType(body, 'rewardAccount', assertIsHexString)
			return { rewardAccount: parseAddress(body.rewardAccount) }
		}

		async function getRelayerAddress() {
			const response = await fetch(`${relayer}/status`, { method: 'GET', agent })
			if (!response.ok) throw new Error(`Relayer status GET failed with ${response.status}: ${response.statusText}\n${await response.text()}`)
			const body = await response.json()
			const { rewardAccount } = parseStatusBody(body)
			return rewardAccount
		}

		function parseWithdrawResponse(response: unknown) {
			if (typeof response !== 'object' || response === null) throw new Error(`Expected an object but got a ${typeof response}\n${response}`)
			assertProperty(response, 'id')
			return { id: response.id } as const
		}

		function parseStatusResponse(response: unknown) {
			if (typeof response !== 'object' || response === null) throw new Error(`Expected an object but got a ${typeof response}\n${response}`)
			assertPropertyWithType(response, 'status', (status: unknown): asserts status is 'FAILED' | 'CONFIRMED' | 'ACCEPTED' | 'SENT' => {
				if (status !== 'FAILED' && status !== 'CONFIRMED' && status !== 'ACCEPTED' && status !== 'SENT' && status !== 'MINED') throw new Error(`Expected status to be either 'FAILED' or 'CONFIRMED' or 'ACCEPTED' but it was ${status}`)
			})
			return { status: response.status }
		}

		const relayerAddress = await getRelayerAddress()
		const { baseFeePerGas } = await client.getLatestBlock()
		const fee = baseFeePerGas * 500_000n + size / 10000n
		const recipientAddress = await promptForAddress(`Recipient: `)
		const { proof, root } = await getProof(recipientAddress, relayerAddress, fee)
		const body = {
			contract: serializeAddress(tornadoInstance),
			proof: serializeData(proof),
			args: [
				serializeBytes32(root),
				serializeBytes32(nullifierHash),
				serializeAddress(recipientAddress),
				serializeAddress(relayerAddress),
				serializeBytes32(fee),
				serializeBytes32(0n),
			]
		}

		console.log(`Withdrawing ${attoString(size)} ETH via relayer to ${addressString(recipientAddress)} with a relayer fee of ${attoString(fee)}`)
		await promptForEnterKey()
		const withdrawHttpResponse = await fetch(`${relayer}/v1/tornadoWithdraw`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			agent
		})
		if (!withdrawHttpResponse.ok) throw new Error(`tornadoWithdraw POST failed with ${withdrawHttpResponse.status}: ${withdrawHttpResponse.statusText}\n${await withdrawHttpResponse.text()}`)
		const { id } = parseWithdrawResponse(await withdrawHttpResponse.json())

		let transactionHash
		while (true) {
			const jobStatusHttpResponse = await fetch(`${relayer}/v1/jobs/${id}`, { method: 'GET', agent })
			if (!jobStatusHttpResponse.ok) throw new Error(`Job Status Check POST failed with ${jobStatusHttpResponse.status}: ${jobStatusHttpResponse.statusText}\n${await jobStatusHttpResponse.text()}`)
			const jobStatusBody = await jobStatusHttpResponse.json()
			const { status } = parseStatusResponse(jobStatusBody)
			if (status === 'FAILED') throw new Error(`Relayer says the withdraw job failed.\n${JSON.stringify(jobStatusBody)}`)
			if (status === 'CONFIRMED') {
				// FIXME: we need to better understand what is returned by this (can it be null | undefined sometimes?) and properly type check it
				transactionHash = BigInt(jobStatusBody['txHash'])
				break
			}
			console.log(`Relay job status: ${status}, transaction hash: ${jobStatusBody['txHash']}`)
			await sleep(3000)
		}

		if (transactionHash === undefined) throw new Error(`Somehow exited infinite loop without a transaction hash.`)
		const receipt = await waitForReceipt(client, transactionHash)
		console.log(`Transaction with hash ${bytes32String(receipt.transactionHash)} mined ${receipt.status === 'success' ? 'successfully' : 'unsuccessfully'} in block ${receipt.bolckNumber} at index ${receipt.transactionIndex} using ${receipt.gasUsed} gas.`)
	}

	// Groth16 library leaves dangling unfinished promises, so script will not exit on its own when done.
	console.log(`🎉`)
	process.exit(0)
}

async function entrypoint() {
	const mode = await promptForStringUnion(`🚆 deposit | withdraw | test: `, ['deposit', 'withdraw', 'test'])
	switch (mode) {
		case 'deposit': return deposit()
		case 'withdraw': return withdraw(false)
		case 'test': return withdraw(true)
		default: assertNever(mode)
	}
}

main(entrypoint)

// tornado-eth-0.1-1-0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
// tornado-eth-1-1-0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
// tornado-eth-10-1-0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
// tornado-eth-100-1-0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
